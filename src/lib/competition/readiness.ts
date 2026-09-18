import type { SeasonStatus } from "@/generated/prisma";

/**
 * A season starts with a complete field or it does not start at all.
 *
 * The bracket is fixed at `capacity` products and every round's elimination
 * count is derived from it (PRD 6). A lineup of 30 or 31 would quietly reshape
 * the whole tournament and shorten it for everyone who already paid, so a short
 * field waits for its last slot instead of playing a different competition.
 *
 * The rule is pure so the engine, the cron job and the admin screen all reach
 * the same verdict from the same counts, and so it can be tested without a
 * database.
 */

/** Season statuses from which a start is even conceivable. */
export const STARTABLE_SEASON_STATUSES: SeasonStatus[] = ["REGISTRATION_OPEN", "REGISTRATION_CLOSED"];

export type StartCounts = {
  status: SeasonStatus;
  capacity: number;
  /** Entries holding a slot. Payment claims it; nothing else does. */
  claimed: number;
  /** Paid entries ready to take the field. */
  ready: number;
};

export type StartReadiness = StartCounts & {
  remaining: number;
  isFull: boolean;
  canStart: boolean;
  /** Why the season is still waiting, or null once it can start. */
  blockedReason: string | null;
};

export function evaluateStartReadiness(counts: StartCounts): StartReadiness {
  const remaining = Math.max(0, counts.capacity - counts.claimed);
  const isFull = counts.capacity > 0 && remaining === 0;
  const blockedReason = startBlocker(counts, remaining, isFull);

  return { ...counts, remaining, isFull, canStart: blockedReason === null, blockedReason };
}

function startBlocker(counts: StartCounts, remaining: number, isFull: boolean): string | null {
  if (!STARTABLE_SEASON_STATUSES.includes(counts.status)) return "This season cannot be started.";
  if (!isFull) {
    return `${remaining} of ${counts.capacity} spots are still open. The season starts once the field is full.`;
  }
  // A slot is claimed the moment money lands, so this catches a row holding
  // capacity that never became startable — a refund mid-flight, or an entry
  // left over from when the site still had a manual review stage.
  if (counts.ready !== counts.capacity) {
    return `Only ${counts.ready} of ${counts.capacity} entries are approved and paid.`;
  }
  return null;
}
