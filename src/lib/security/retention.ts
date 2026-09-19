import "server-only";

import { prisma } from "@/lib/db";

/**
 * Scheduled housekeeping.
 *
 * Without this, expired session rows and processed webhook records grow without
 * bound. Abandoned checkouts are also cleared so an unpaid submission stops
 * holding a product URL.
 */

const SESSION_GRACE_MS = 24 * 60 * 60 * 1000;
const WEBHOOK_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const FAILED_CHECKOUT_GRACE_MS = 2 * 60 * 60 * 1000;
/** How long after its capability lapsed an unsettled checkout is written off. */
const ABANDONED_CHECKOUT_GRACE_MS = 24 * 60 * 60 * 1000;

export type RetentionReport = {
  sessions: number;
  webhookEvents: number;
  abandonedEntries: number;
};

export async function runRetention(now = new Date()): Promise<RetentionReport> {
  const [sessions, webhookEvents] = await Promise.all([
    // Keep a short grace window so a just-expired session can still be
    // distinguished from one that never existed while debugging.
    prisma.session.deleteMany({
      where: { absoluteExpiresAt: { lte: new Date(now.getTime() - SESSION_GRACE_MS) } },
    }),
    // Processed provider messages are kept long enough to reconcile a dispute.
    prisma.webhookEvent.deleteMany({
      where: {
        status: "PROCESSED",
        receivedAt: { lte: new Date(now.getTime() - WEBHOOK_RETENTION_MS) },
      },
    }),
  ]);

  // A checkout stops holding its product URL once it can no longer be
  // completed. An explicit cancellation is released after a short grace. A
  // declined or never-finished attempt may still settle, so it is only written
  // off a day after the capability that opens its checkout lapsed — and never
  // while the provider has already named a payment for it, because that one is
  // part of a live settlement conversation rather than an abandoned tab.
  const abandonedEntries = await prisma.seasonEntry.updateMany({
    where: {
      status: "AWAITING_PAYMENT",
      OR: [
        {
          createdAt: { lte: new Date(now.getTime() - FAILED_CHECKOUT_GRACE_MS) },
          payment: { status: "CANCELLED" },
        },
        {
          payment: {
            status: { in: ["PENDING", "FAILED"] },
            providerPaymentId: null,
            checkoutTokenExpiresAt: { lte: new Date(now.getTime() - ABANDONED_CHECKOUT_GRACE_MS) },
          },
        },
      ],
    },
    data: { status: "WITHDRAWN", manageTokenRevokedAt: now },
  });

  return {
    sessions: sessions.count,
    webhookEvents: webhookEvents.count,
    abandonedEntries: abandonedEntries.count,
  };
}
