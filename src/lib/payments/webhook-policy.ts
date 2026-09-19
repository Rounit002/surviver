/**
 * When a provider message may be tried again.
 *
 * Kept pure, and separate from the inbox that reads and writes it, so the rule
 * can be tested without a database — the same split `competition/readiness`
 * uses for the season start rule.
 */

/** A message that reached one of these is finished and never reprocessed. */
export const TERMINAL_STATUSES = ["PROCESSED", "EXHAUSTED"];

/**
 * Statuses a later delivery or sweep may pick up again.
 *
 * NEEDS_REVIEW belongs here: it is the verdict for a message whose payment
 * could not be settled *yet* — a webhook that overtook its own checkout, a row
 * written moments later, a season lock held elsewhere — and those clear on
 * their own. Treating it as final is what strands a paid entry.
 */
export const RETRYABLE_STATUSES = ["RECEIVED", "FAILED", "NEEDS_REVIEW"];

/** A claim older than this is assumed to belong to a worker that died. */
export const STALE_CLAIM_MS = 5 * 60_000;

/** Give up after this many attempts so a permanently broken message settles. */
export const MAX_ATTEMPTS = 8;

/** 1m, 2m, 4m … capped, so a transient fault clears fast and a broken one backs off. */
export function retryDelayMs(attempts: number): number {
  return Math.min(60_000 * 2 ** Math.max(0, attempts - 1), 30 * 60_000);
}

/** Reasons that are a correct "nothing to do", not a fault worth retrying. */
export const BENIGN_REASONS = ["duplicate event", "already settled", "ignored"];

/** The verdict to store for a refusal that `applyPaymentResult` returned. */
export function statusForRefusal(reason: string): string {
  return BENIGN_REASONS.includes(reason) ? "PROCESSED" : "NEEDS_REVIEW";
}
