import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma";
import { rankByClicks } from "./scoring";
import { getStartReadiness, startableEntryFilter, STARTABLE_SEASON_STATUSES } from "@/lib/competition/season";

/**
 * The season lifecycle.
 *
 *   registration ──(all 32 paid)──▶ running ──(seasonLengthHours)──▶ completed
 *
 * Nothing starts until every spot is paid. Once it starts, all 32 products stay
 * on the board for the whole season and are ranked live by clicks. When the
 * window closes, #1 is the season's Survivor and everyone else is FINISHED with
 * their final rank. There are no elimination rounds.
 *
 * Internally the ranking window is still one `Round` row, because every scoring
 * event and stat is keyed to a round; a season simply has exactly one.
 */

// One lock order for scoring, settlement and lifecycle changes prevents
// concurrent clicks or jobs from crossing the season's finalization boundary.
export async function lockSeason(tx: Prisma.TransactionClient, seasonId: string) {
  await tx.$queryRaw`SELECT id FROM seasons WHERE id = ${seasonId} FOR UPDATE`;
}

/** Re-rank every live product in the window. Called after each scored event. */
export async function refreshRanks(tx: Prisma.TransactionClient, roundId: string) {
  const stats = await tx.productRoundStats.findMany({
    where: { roundId, finalized: false, entry: { status: { in: ["ACTIVE", "FINALIST"] } } },
  });
  const ranked = rankByClicks(stats);
  for (const row of ranked) {
    await tx.productRoundStats.update({ where: { id: row.id }, data: { rank: row.rank, prevRank: row.prevRank, interestRate: row.interestRate, status: row.status } });
  }
  return ranked;
}

/**
 * A start either happened or it is still waiting on a full field. Returning
 * the reason rather than throwing lets the scheduled job treat "not yet" as
 * the ordinary case it is.
 */
export type StartOutcome = { started: true; entrants: number } | { started: false; reason: string };

/** Begin a season, but only with every one of its 32 spots paid. */
export async function startSeason(seasonId: string): Promise<StartOutcome> {
  return prisma.$transaction(async tx => {
    await lockSeason(tx, seasonId);
    const season = await tx.season.findUniqueOrThrow({ where: { id: seasonId } });
    // Readiness is read under the season lock, so a payment landing at the same
    // moment cannot start a season one entry short.
    const readiness = await getStartReadiness(tx, season);
    if (!readiness.canStart) return { started: false, reason: readiness.blockedReason ?? "This season cannot be started." };
    const entries = await tx.seasonEntry.findMany({ where: startableEntryFilter(seasonId) });
    const now = new Date();
    const endAt = new Date(now.getTime() + season.seasonLengthHours * 3_600_000);
    const round = await tx.round.create({ data: { seasonId, roundNumber: 1, name: "Live ranking", startAt: now, endAt, eliminationCount: 0, status: "ACTIVE" } });
    await tx.seasonEntry.updateMany({ where: { id: { in: entries.map(e => e.id) } }, data: { status: "ACTIVE" } });
    await tx.productRoundStats.createMany({ data: entries.map(e => ({ roundId: round.id, seasonEntryId: e.id, status: "SAFE" as const })) });
    await tx.season.update({ where: { id: seasonId }, data: { status: "RUNNING", seasonStart: now, registrationEnd: now } });
    await tx.activityEvent.create({ data: { roundId: round.id, type: "season.started", message: `All ${entries.length} spots are filled. ${season.name} is live — ranked by clicks.` } });
    return { started: true, entrants: entries.length };
  });
}

/** Start every season whose field is complete. */
export async function autoStartFullSeasons() {
  const candidates = await prisma.season.findMany({ where: { status: { in: STARTABLE_SEASON_STATUSES } }, select: { id: true } });
  const results = [];
  for (const { id } of candidates) {
    try {
      const outcome = await startSeason(id);
      if (outcome.started) results.push({ seasonId: id, entrants: outcome.entrants });
    } catch (error) {
      console.error("[surviver] auto-start failed", id, error);
    }
  }
  return results;
}

/**
 * Close a season whose ranking window has ended. Idempotent: returns
 * "not due" until the window is over, and does nothing once it is closed.
 */
export async function advanceSeason(seasonId: string) {
  return prisma.$transaction(async tx => {
    await lockSeason(tx, seasonId);
    const season = await tx.season.findUniqueOrThrow({ where: { id: seasonId } });
    const round = await tx.round.findFirst({ where: { seasonId, status: "ACTIVE" } });
    const now = new Date();
    if (season.status !== "RUNNING" || !round || round.endAt > now) return "not due";

    // A refunded or withdrawn entry keeps its history but is never ranked.
    await tx.productRoundStats.updateMany({
      where: { roundId: round.id, finalized: false, entry: { status: { notIn: ["ACTIVE", "FINALIST"] } } },
      data: { finalized: true, finalizedAt: now },
    });

    const ranked = await refreshRanks(tx, round.id);
    // Live ranks share ties; final placings do not. A tie at the top is broken
    // by Interest Rate (see rankByClicks), so there is always one Survivor and
    // every other product gets a distinct final position.
    const winner = ranked[0];
    for (const [index, row] of ranked.entries()) {
      const won = index === 0;
      await tx.productRoundStats.update({ where: { id: row.id }, data: { finalized: true, finalizedAt: now, rank: index + 1, status: won ? "SURVIVOR" : "SAFE" } });
      await tx.seasonEntry.update({ where: { id: row.seasonEntryId }, data: { status: won ? "SURVIVOR" : "FINISHED", finalRank: index + 1 } });
    }

    await tx.round.update({ where: { id: round.id }, data: { status: "COMPLETED", finalizedAt: now } });
    await tx.season.update({ where: { id: seasonId }, data: { status: "COMPLETED", seasonEnd: now } });
    await tx.activityEvent.create({
      data: {
        roundId: round.id,
        seasonEntryId: winner?.seasonEntryId,
        type: "season.completed",
        message: winner ? `${season.name} is over. The most-clicked product is crowned.` : `${season.name} ended with no eligible products.`,
      },
    });
    return "completed";
  }, { timeout: 20000 });
}
