import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma";
import { rankScores, eliminationFor } from "./scoring";
import { getStartReadiness, startableEntryFilter, STARTABLE_SEASON_STATUSES } from "@/lib/competition/season";

// One lock order for scoring, settlement and administration prevents concurrent
// clicks or jobs from crossing a round's finalization boundary.
export async function lockSeason(tx: Prisma.TransactionClient, seasonId: string) {
  await tx.$queryRaw`SELECT id FROM seasons WHERE id = ${seasonId} FOR UPDATE`;
}
export async function refreshRanks(tx: Prisma.TransactionClient, roundId: string, minimum: number, eliminate: number) {
  const stats = await tx.productRoundStats.findMany({ where: { roundId, finalized: false } });
  const ranked = rankScores(stats, minimum, eliminate);
  for (const row of ranked) await tx.productRoundStats.update({ where: { id: row.id }, data: { rank: row.rank, prevRank: row.prevRank, interestRate: row.interestRate, status: row.status } });
  return ranked;
}
/**
 * A start either happened or it is still waiting on a full, reviewed field.
 * Returning the reason rather than throwing lets the scheduled job treat "not
 * yet" as the ordinary case it is, while the admin screen still surfaces it.
 */
export type StartOutcome = { started: true; entrants: number } | { started: false; reason: string };

/**
 * Begin a season, but only with every slot filled.
 *
 * Always called by the scheduled job: there is no administrator surface, so a
 * complete field is the only signal a season needs to begin.
 */
export async function startSeason(seasonId: string): Promise<StartOutcome> {
  return prisma.$transaction(async tx => {
    await lockSeason(tx, seasonId);
    const season = await tx.season.findUniqueOrThrow({ where: { id: seasonId } });
    // Readiness is read under the season lock, so a payment or an approval
    // landing at the same moment cannot start a season one entry short.
    const readiness = await getStartReadiness(tx, season);
    if (!readiness.canStart) return { started: false, reason: readiness.blockedReason ?? "This season cannot be started." };
    const entries = await tx.seasonEntry.findMany({ where: startableEntryFilter(seasonId) });
    const now = new Date();
    const round = await tx.round.create({ data: { seasonId, roundNumber: 1, name: entries.length === 2 ? "Final" : "Round 1", startAt: now, endAt: new Date(now.getTime() + (entries.length === 2 ? season.finalRoundHours : season.defaultRoundHours) * 3600000), eliminationCount: eliminationFor(entries.length), status: "ACTIVE" } });
    await tx.seasonEntry.updateMany({ where: { id: { in: entries.map(e => e.id) } }, data: { status: entries.length === 2 ? "FINALIST" : "ACTIVE" } });
    await tx.productRoundStats.createMany({ data: entries.map(e => ({ roundId: round.id, seasonEntryId: e.id })) });
    await tx.season.update({ where: { id: seasonId }, data: { status: "RUNNING", seasonStart: now, registrationEnd: now } });
    await tx.activityEvent.create({ data: { roundId: round.id, type: "season.started", message: `All ${entries.length} spots are filled. ${season.name} has begun.` } });
    return { started: true, entrants: entries.length };
  });
}

/**
 * Start every season whose field is complete and fully reviewed.
 *
 * Runs on the same schedule that closes due rounds, so a season begins shortly
 * after its last slot is paid for, without anyone having to be at a keyboard.
 */
export async function autoStartFullSeasons() {
  const candidates = await prisma.season.findMany({ where: { status: { in: STARTABLE_SEASON_STATUSES } }, select: { id: true } });
  const results = [];
  for (const { id } of candidates) {
    try {
      const outcome = await startSeason(id);
      // A waiting season is the normal state; only report the ones that moved.
      if (outcome.started) results.push({ seasonId: id, entrants: outcome.entrants });
    } catch (error) {
      console.error("[surviver] auto-start failed", id, error);
    }
  }
  return results;
}

export async function advanceSeason(seasonId: string) {
  return prisma.$transaction(async tx => {
    await lockSeason(tx, seasonId);
    const season = await tx.season.findUniqueOrThrow({ where: { id: seasonId } });
    const round = await tx.round.findFirst({ where: { seasonId, status: "ACTIVE" } });
    const now = new Date();
    if (season.status !== "RUNNING" || !round || round.endAt > now) {
      return "not due";
    }
    const ranked = await refreshRanks(tx, round.id, season.minSampleImpressions, round.eliminationCount);
    if (ranked.length < 2 || ranked.some(s => s.rank === null)) {
      await tx.round.update({ where: { id: round.id }, data: { endAt: new Date(now.getTime() + 3600000) } });
      await tx.activityEvent.create({ data: { roundId: round.id, type: "round.extended", message: `${round.name} extended by one hour so every product can reach the minimum sample.` } });
      return "extended";
    }
    const survivors = ranked.slice(0, ranked.length - round.eliminationCount);
    for (const row of ranked) {
      const won = survivors.length === 1 && row.seasonEntryId === survivors[0].seasonEntryId;
      const eliminated = !survivors.some(s => s.seasonEntryId === row.seasonEntryId);
      await tx.productRoundStats.update({ where: { id: row.id }, data: { finalized: true, finalizedAt: now, status: won ? "SURVIVOR" : eliminated ? "ELIMINATED" : "SAFE" } });
      await tx.seasonEntry.update({ where: { id: row.seasonEntryId }, data: { status: won ? "SURVIVOR" : eliminated ? "ELIMINATED" : survivors.length === 2 ? "FINALIST" : "ACTIVE", ...(won || eliminated ? { finalRank: row.rank, eliminatedRoundId: eliminated ? round.id : null } : {}) } });
    }
    await tx.round.update({ where: { id: round.id }, data: { status: "COMPLETED", finalizedAt: now } });
    await tx.activityEvent.create({ data: { roundId: round.id, type: "round.completed", message: `${round.name} complete. ${survivors.length} ${survivors.length === 1 ? "survivor remains" : "products advance"}.` } });
    if (survivors.length === 1) {
      await tx.season.update({ where: { id: seasonId }, data: { status: "COMPLETED", seasonEnd: now } });
      return "completed";
    }
    const next = await tx.round.create({ data: { seasonId, roundNumber: round.roundNumber + 1, name: survivors.length === 2 ? "Final" : `Round ${round.roundNumber + 1}`, status: "ACTIVE", startAt: now, endAt: new Date(now.getTime() + (survivors.length === 2 ? season.finalRoundHours : season.defaultRoundHours) * 3600000), eliminationCount: eliminationFor(survivors.length) } });
    await tx.productRoundStats.createMany({ data: survivors.map(s => ({ roundId: next.id, seasonEntryId: s.seasonEntryId })) });
    return "advanced";
  }, { timeout: 20000 });
}
