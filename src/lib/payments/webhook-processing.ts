import "server-only";
import { getPaymentProvider } from "@/lib/payments";
import { applyPaymentResult } from "@/lib/payments/fulfill";
import { claimWebhookRetries, releaseWebhookEvent } from "@/lib/payments/webhook-inbox";
import { statusForRefusal } from "@/lib/payments/webhook-policy";

/**
 * Turning one claimed inbox message into a settled payment.
 *
 * The live request handler and the background sweep share this so a retry
 * reaches exactly the same verdict the original delivery would have. The
 * signature was verified when the message was first accepted; a retry replays
 * the stored payload and never re-opens the network.
 */

export type ProcessOutcome = { status: string; reason?: string };

export async function processWebhookPayload(eventId: string, rawBody: string): Promise<ProcessOutcome> {
  const result = await getPaymentProvider().parseWebhook(rawBody, { eventId });
  if (result.kind === "ignored") return { status: "PROCESSED", reason: result.reason ?? "ignored" };
  const outcome = await applyPaymentResult(result);
  if (outcome.applied) return { status: "PROCESSED" };
  // A benign refusal is the final answer; anything else may still settle once
  // the condition that blocked it clears, so it stays in the retry queue.
  const reason = outcome.reason ?? "not applied";
  return { status: statusForRefusal(reason), reason };
}

/**
 * Re-run every message that is due for another attempt.
 *
 * Runs on the competition scheduler's tick, so a payment stranded by a
 * transient fault recovers without a cron job and without the provider having
 * to redeliver.
 */
export async function retryPendingWebhooks(limit = 20): Promise<Array<{ id: string; status: string; reason?: string }>> {
  const claimed = await claimWebhookRetries(limit);
  const results = [];
  for (const row of claimed) {
    const eventId = row.id.startsWith(`${row.provider}:`) ? row.id.slice(row.provider.length + 1) : row.id;
    try {
      const outcome = await processWebhookPayload(eventId, JSON.stringify(row.payload));
      await releaseWebhookEvent(row.id, outcome.status, outcome.reason, new Date(), row.claimedAt);
      results.push({ id: row.id, ...outcome });
    } catch (error) {
      console.error("[surviver] webhook retry failed", row.id, error);
      await releaseWebhookEvent(row.id, "FAILED", "processing failed", new Date(), row.claimedAt).catch(() => undefined);
      results.push({ id: row.id, status: "FAILED", reason: "processing failed" });
    }
  }
  return results;
}
