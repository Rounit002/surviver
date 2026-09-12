import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { lockSeason } from "@/lib/competition/engine";
import { CLAIMED_ENTRY_STATUSES } from "@/lib/competition/season";
import type { WebhookResult } from "./types";

/** Applies confirmed provider outcomes atomically; never trusts a success redirect. */
export async function applyPaymentResult(result: WebhookResult): Promise<{ applied: boolean; reason?: string }> {
  if (result.kind === "ignored") return { applied: false, reason: "ignored" };
  const identity = await prisma.payment.findFirst({ where: { provider: env.paymentProvider, providerPaymentId: result.providerPaymentId }, select: { id: true, seasonId: true } });
  if (!identity) return { applied: false, reason: "unknown payment" };
  return prisma.$transaction(async tx => {
    await lockSeason(tx, identity.seasonId);
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: identity.id }, include: { entry: true, season: true } });
    const eventId = `${payment.provider}:${result.eventId}`;
    if (await tx.paymentEvent.findUnique({ where: { id: eventId } })) return { applied: false, reason: "duplicate event" };
    if (result.kind === "succeeded") {
      if (!["PENDING", "FAILED"].includes(payment.status)) return { applied: false, reason: "already settled" };
      if (!payment.entry || payment.entry.status !== "AWAITING_PAYMENT") return { applied: false, reason: "entry unavailable" };
      const now = new Date();
      const season = payment.season;
      if (season.status !== "REGISTRATION_OPEN" || (season.registrationStart && season.registrationStart > now) || (season.registrationEnd && season.registrationEnd <= now)) return { applied: false, reason: "registration closed" };
      const claimed = await tx.seasonEntry.count({ where: { seasonId: season.id, status: { in: CLAIMED_ENTRY_STATUSES } } });
      if (claimed >= season.capacity) return { applied: false, reason: "season full" };
      await tx.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED", lastWebhookEventId: result.eventId } });
      // Keep paid entries private until an administrator publishes them. The
      // owner can still use the private campaign link immediately after payment.
      await tx.seasonEntry.update({ where: { id: payment.entry.id }, data: { status: "AWAITING_APPROVAL" } });
      await tx.product.update({ where: { id: payment.entry.productId }, data: { approvalStatus: "PENDING" } });
    } else if (result.kind === "failed") {
      if (!["PENDING", "FAILED"].includes(payment.status)) return { applied: false, reason: "already settled" };
      await tx.payment.update({ where: { id: payment.id }, data: { status: "FAILED", lastWebhookEventId: result.eventId } });
    } else {
      if (!["SUCCEEDED", "PARTIALLY_REFUNDED"].includes(payment.status)) return { applied: false, reason: "not refundable" };
      if (!Number.isSafeInteger(result.amountCents) || result.amountCents <= 0) return { applied: false, reason: "invalid refund" };
      const refundedCents = Math.min(payment.amountCents, payment.refundedCents + result.amountCents);
      await tx.payment.update({ where: { id: payment.id }, data: { refundedCents, status: refundedCents === payment.amountCents ? "REFUNDED" : "PARTIALLY_REFUNDED", lastWebhookEventId: result.eventId } });
      if (refundedCents === payment.amountCents && payment.entry && ["AWAITING_APPROVAL", "UPCOMING"].includes(payment.entry.status)) await tx.seasonEntry.update({ where: { id: payment.entry.id }, data: { status: "WITHDRAWN" } });
    }
    await tx.paymentEvent.create({ data: { id: eventId, paymentId: payment.id, kind: result.kind } });
    return { applied: true };
  });
}
