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

  // Only explicitly cancelled checkouts may be released. A declined attempt
  // can later succeed, so FAILED and PENDING must remain recoverable.
  const abandonedEntries = await prisma.seasonEntry.updateMany({
    where: {
      status: "AWAITING_PAYMENT",
      createdAt: { lte: new Date(now.getTime() - FAILED_CHECKOUT_GRACE_MS) },
      payment: { status: "CANCELLED" },
    },
    data: { status: "WITHDRAWN", manageTokenRevokedAt: now },
  });

  return {
    sessions: sessions.count,
    webhookEvents: webhookEvents.count,
    abandonedEntries: abandonedEntries.count,
  };
}
