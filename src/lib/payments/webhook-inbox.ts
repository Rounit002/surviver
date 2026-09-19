import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma";
import { env } from "@/lib/env";
import { MAX_ATTEMPTS, RETRYABLE_STATUSES, STALE_CLAIM_MS, TERMINAL_STATUSES, retryDelayMs } from "@/lib/payments/webhook-policy";

/**
 * Durable inbox for authenticated provider messages.
 *
 * A message is claimed before it is processed and released with a terminal
 * status afterwards. Anything that did not reach a terminal status is
 * retryable: a redelivery from the provider and the in-process sweep both go
 * through the same claim, so exactly one worker ever holds a message.
 */

/** A claim whose worker died: nobody is going to release it. */
function abandonedClaim(now: Date): Prisma.WebhookEventWhereInput {
  return { status: "PROCESSING", processedAt: { lt: new Date(now.getTime() - STALE_CLAIM_MS) } };
}

/** What a redelivery of this exact message is allowed to reopen. */
function redeliveryFilter(id: string, now: Date): Prisma.WebhookEventWhereInput {
  return {
    id,
    OR: [{ status: { in: RETRYABLE_STATUSES } }, abandonedClaim(now)],
    attempts: { lt: MAX_ATTEMPTS },
  };
}

/**
 * Atomically claim a message for processing, recording it first if it is new.
 *
 * Returns false when another worker holds it or it is already finished, which
 * is the caller's cue to acknowledge the delivery without doing the work twice.
 */
export async function claimWebhookEvent(id: string, provider: string, type: string, payload: Prisma.InputJsonObject, now = new Date()): Promise<boolean> {
  const inserted = await prisma.webhookEvent.createMany({
    data: [{ id, provider, type, payload, status: "PROCESSING", processedAt: now, attempts: 1, nextAttemptAt: new Date(now.getTime() + retryDelayMs(1)) }],
    skipDuplicates: true,
  });
  if (inserted.count === 1) return true;

  // A redelivery is the provider telling us it still expects this to settle, so
  // it is not held back by the sweep's backoff — only by the attempt ceiling.
  const claimed = await prisma.webhookEvent.updateMany({
    where: redeliveryFilter(id, now),
    data: { status: "PROCESSING", failureReason: null, processedAt: now, attempts: { increment: 1 }, nextAttemptAt: new Date(now.getTime() + retryDelayMs(1)) },
  });
  return claimed.count === 1;
}

/** Release a claimed message with the verdict its processing produced. */
export async function releaseWebhookEvent(id: string, status: string, failureReason: string | undefined, now = new Date(), claimedAt?: Date): Promise<void> {
  const settled = TERMINAL_STATUSES.includes(status);
  const row = settled ? null : await prisma.webhookEvent.findUnique({ where: { id }, select: { attempts: true } });
  const attempts = row?.attempts ?? MAX_ATTEMPTS;
  await prisma.webhookEvent.updateMany({
    where: { id, ...(claimedAt ? { status: "PROCESSING", processedAt: claimedAt } : {}) },
    data: {
      status: !settled && attempts >= MAX_ATTEMPTS ? "EXHAUSTED" : status,
      failureReason: failureReason ?? null,
      processedAt: now,
      nextAttemptAt: settled || attempts >= MAX_ATTEMPTS ? null : new Date(now.getTime() + retryDelayMs(attempts)),
    },
  });
}

export type RetryCandidate = { id: string; provider: string; type: string; payload: Prisma.JsonValue; attempts: number; claimedAt: Date };

/**
 * Claim up to `limit` messages whose backoff has elapsed.
 *
 * Each is claimed individually and guarded on the state it was read in, so two
 * servers sweeping at the same moment never both take the same message.
 */
export async function claimWebhookRetries(limit = 20, now = new Date()): Promise<RetryCandidate[]> {
  await prisma.webhookEvent.updateMany({
    where: { provider: env.paymentProvider, attempts: { gte: MAX_ATTEMPTS }, ...abandonedClaim(now) },
    data: { status: "EXHAUSTED", failureReason: "last processing attempt was interrupted", nextAttemptAt: null },
  });
  const due = await prisma.webhookEvent.findMany({
    where: {
      // Only the provider in force can be replayed: its adapter is the one that
      // knows how to read the stored payload.
      provider: env.paymentProvider,
      attempts: { lt: MAX_ATTEMPTS },
      OR: [
        // Waiting on its backoff.
        { AND: [{ status: { in: RETRYABLE_STATUSES } }, { OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] }] },
        // Abandoned mid-flight: recovered on sight, whatever its backoff says,
        // because no one else is coming back for it.
        abandonedClaim(now),
      ],
    },
    orderBy: { receivedAt: "asc" },
    take: limit,
    select: { id: true, provider: true, type: true, payload: true, attempts: true, status: true },
  });

  const claimed: RetryCandidate[] = [];
  for (const row of due) {
    const taken = await prisma.webhookEvent.updateMany({
      where: { id: row.id, status: row.status, attempts: row.attempts },
      data: { status: "PROCESSING", failureReason: null, processedAt: now, attempts: { increment: 1 }, nextAttemptAt: new Date(now.getTime() + retryDelayMs(row.attempts + 1)) },
    });
    if (taken.count === 1) claimed.push({ id: row.id, provider: row.provider, type: row.type, payload: row.payload, attempts: row.attempts + 1, claimedAt: now });
  }
  return claimed;
}
