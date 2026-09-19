import "server-only";

import { prisma } from "@/lib/db";
export { PUBLIC_SEASON_STATUSES, publicSeasonFilter, parseSeasonNumber } from "@/lib/competition/constants";
import type { EntryStatus, Prisma, Season } from "@/generated/prisma";
import { evaluateStartReadiness, type StartReadiness } from "@/lib/competition/readiness";
import { PUBLIC_SEASON_STATUSES } from "@/lib/competition/constants";
export { evaluateStartReadiness, STARTABLE_SEASON_STATUSES } from "@/lib/competition/readiness";
export type { StartReadiness } from "@/lib/competition/readiness";

/**
 * A slot counts as claimed once money has been taken, whether or not the
 * product has cleared review. Unpaid drafts must never occupy capacity, or a
 * founder could reserve the season without paying.
 */
export const CLAIMED_ENTRY_STATUSES: EntryStatus[] = [
  "AWAITING_APPROVAL",
  "UPCOMING",
  "ACTIVE",
  "ELIMINATED",
  "FINALIST",
  "SURVIVOR",
];

/** Entries that are actually competing right now. */
export const LIVE_ENTRY_STATUSES: EntryStatus[] = ["ACTIVE", "FINALIST"];

/**
 * The season the public site is about: a running season first, then one taking
 * entries, then the most recent one that existed.
 */
export async function getCurrentSeason(): Promise<Season | null> {
  const running = await prisma.season.findFirst({
    where: { status: "RUNNING" },
    orderBy: { number: "desc" },
  });
  if (running) return running;

  const open = await prisma.season.findFirst({
    where: { status: { in: ["REGISTRATION_OPEN", "REGISTRATION_CLOSED"] } },
    orderBy: { number: "desc" },
  });
  if (open) return open;

  return prisma.season.findFirst({ where: { status: { in: PUBLIC_SEASON_STATUSES } }, orderBy: { number: "desc" } });
}

/**
 * The season new entries are actually sold into.
 *
 * This is deliberately separate from getCurrentSeason: while Season 0 plays
 * out, entries are already being taken for Season 1, and a page that shows the
 * running season's capacity next to an "Enter" button would quote the wrong
 * price and the wrong number of remaining slots.
 */
export async function getOpenSeason(): Promise<Season | null> {
  return prisma.season.findFirst({
    where: { status: "REGISTRATION_OPEN", AND: [
      { OR: [{ registrationStart: null }, { registrationStart: { lte: new Date() } }] },
      { OR: [{ registrationEnd: null }, { registrationEnd: { gt: new Date() } }] },
    ] },
    orderBy: { number: "asc" },
  });
}

export type SeasonSummary = {
  season: Season;
  claimed: number;
  remaining: number;
  isFull: boolean;
  acceptingEntries: boolean;
};

export async function getSeasonSummary(season: Season): Promise<SeasonSummary> {
  const claimed = await prisma.seasonEntry.count({
    where: { seasonId: season.id, status: { in: CLAIMED_ENTRY_STATUSES } },
  });

  const remaining = Math.max(0, season.capacity - claimed);

  return {
    season,
    claimed,
    remaining,
    isFull: remaining === 0,
    acceptingEntries: season.status === "REGISTRATION_OPEN" && remaining > 0 && (!season.registrationStart || season.registrationStart <= new Date()) && (!season.registrationEnd || season.registrationEnd > new Date()),
  };
}

/**
 * How close a season is to fielding a full bracket.
 *
 * Takes a client rather than reaching for the global one so the engine can ask
 * the same question inside the season lock, where the answer is authoritative.
 */
export async function getStartReadiness(
  client: Prisma.TransactionClient,
  season: Pick<Season, "id" | "status" | "capacity">,
): Promise<StartReadiness> {
  // Sequential rather than concurrent: an interactive transaction holds one
  // connection, and these are cheap indexed counts.
  const claimed = await client.seasonEntry.count({
    where: { seasonId: season.id, status: { in: CLAIMED_ENTRY_STATUSES } },
  });
  const ready = await client.seasonEntry.count({ where: startableEntryFilter(season.id) });

  return evaluateStartReadiness({ status: season.status, capacity: season.capacity, claimed, ready });
}

/** The entries that actually take the field: paid, approved and not yet playing. */
export function startableEntryFilter(seasonId: string): Prisma.SeasonEntryWhereInput {
  return {
    seasonId,
    status: "UPCOMING",
    product: { approvalStatus: "APPROVED" },
    payment: { status: "SUCCEEDED" },
  };
}

/**
 * The entries that stop a URL being entered into a season again.
 *
 * A live entry blocks its address, and so does a checkout that is still in
 * flight — but only while that checkout can still be completed. The capability
 * that opens it lives two hours; once it has lapsed the founder cannot reach
 * their own checkout any more, and a tab someone closed must not lock their
 * address out of the season for good.
 */
export function blockingEntryFilter(seasonId: string, url: string, now = new Date()): Prisma.SeasonEntryWhereInput {
  return {
    seasonId,
    product: { url },
    OR: [
      { status: { notIn: ["REJECTED", "WITHDRAWN", "AWAITING_PAYMENT"] } },
      { status: "AWAITING_PAYMENT", payment: { status: "PENDING", checkoutTokenExpiresAt: { gt: now } } },
    ],
  };
}

/** Paid, approved entries are public while waiting for the field to fill. */
export async function getPublicUpcomingEntries(seasonId: string, category?: Prisma.EnumProductCategoryFilter["equals"]) {
  return prisma.seasonEntry.findMany({
    where: {
      seasonId,
      status: "UPCOMING",
      payment: { status: "SUCCEEDED" },
      product: { approvalStatus: "APPROVED", ...(category ? { category } : {}) },
      season: { status: { in: ["REGISTRATION_OPEN", "REGISTRATION_CLOSED"] } },
    },
    orderBy: { createdAt: "asc" },
    include: { product: true },
  });
}

/** The round currently accepting scoring events, if any. */
export async function getActiveRound(seasonId: string) {
  return prisma.round.findFirst({
    where: { seasonId, status: "ACTIVE" },
    orderBy: { roundNumber: "desc" },
  });
}

export async function getSeasonRounds(seasonId: string) {
  return prisma.round.findMany({
    where: { seasonId },
    orderBy: { roundNumber: "asc" },
  });
}
