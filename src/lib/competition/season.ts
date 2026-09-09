import "server-only";

import { prisma } from "@/lib/db";
import type { EntryStatus, Season } from "@/generated/prisma";

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

  return prisma.season.findFirst({ orderBy: { number: "desc" } });
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
