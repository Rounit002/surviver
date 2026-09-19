import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { lockSeason, startSeason } from "@/lib/competition/engine";
import { activateCompetitionScheduler } from "@/lib/competition/scheduler";
import { CLAIMED_ENTRY_STATUSES } from "@/lib/competition/season";
import type { WebhookResult } from "./types";

/** Applies confirmed provider outcomes atomically; never trusts a success redirect. */
export async function applyPaymentResult(input: WebhookResult): Promise<{ applied: boolean; reason?: string }> {
  if (input.kind === "ignored") return { applied: false, reason: "ignored" };
  // Bind the narrowed value to a const: TypeScript discards narrowing of a
  // parameter inside the transaction callback below, and the refund branch
  // depends on `amountCents` being known present.
  const result = input;
  const [localIdentity, providerIdentity] = await Promise.all([
    result.localPaymentId ? prisma.payment.findFirst({ where: { id: result.localPaymentId, provider: env.paymentProvider }, select: { id: true, seasonId: true } }) : null,
    prisma.payment.findFirst({ where: { provider: env.paymentProvider, providerPaymentId: result.providerPaymentId }, select: { id: true, seasonId: true } }),
  ]);
  if (result.localPaymentId && !localIdentity) return { applied: false, reason: "unknown payment" };
  if (localIdentity && providerIdentity && localIdentity.id !== providerIdentity.id) return { applied: false, reason: "payment identity mismatch" };
  const identity = localIdentity ?? providerIdentity;
  if (!identity) return { applied: false, reason: "unknown payment" };
  const outcome = await prisma.$transaction(async tx => {
    await lockSeason(tx, identity.seasonId);
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: identity.id }, include: { entry: true, season: true } });
    const eventId = `${payment.provider}:${result.eventId}`;
    if (await tx.paymentEvent.findUnique({ where: { id: eventId } })) return { applied: false, reason: "duplicate event" };
    if (result.kind === "succeeded") {
      if (!Number.isSafeInteger(result.amountCents) || result.amountCents !== payment.amountCents || result.currency !== payment.currency.toLowerCase()) return { applied: false, reason: "financial mismatch" };
      if (payment.providerPaymentId && payment.providerPaymentId !== result.providerPaymentId) return { applied: false, reason: "provider id mismatch" };
      if (!["PENDING", "FAILED"].includes(payment.status)) return { applied: false, reason: "already settled" };
      if (!payment.entry || payment.entry.status !== "AWAITING_PAYMENT") return { applied: false, reason: "entry unavailable" };
      const now = new Date();
      const season = payment.season;
      if (season.status !== "REGISTRATION_OPEN" || (season.registrationStart && season.registrationStart > now) || (season.registrationEnd && season.registrationEnd <= now)) return { applied: false, reason: "registration closed" };
      const claimed = await tx.seasonEntry.count({ where: { seasonId: season.id, status: { in: CLAIMED_ENTRY_STATUSES } } });
      if (claimed >= season.capacity) return { applied: false, reason: "season full" };
      await tx.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED", chargedAmountCents: result.chargedAmountCents ?? result.amountCents, providerPaymentId: result.providerPaymentId, lastWebhookEventId: result.eventId, checkoutTokenHash: null, checkoutTokenExpiresAt: null } });
      // There is no review stage: the site has no administrator surface, so a
      // confirmed payment puts the entry straight onto the field. It holds its
      // slot from this moment, and the season starts itself once all of them
      // are taken.
      await tx.seasonEntry.update({ where: { id: payment.entry.id }, data: { status: "UPCOMING" } });
      await tx.product.update({ where: { id: payment.entry.productId }, data: { approvalStatus: "APPROVED" } });
      await tx.paymentEvent.create({ data: { id: eventId, paymentId: payment.id, kind: result.kind } });
      return { applied: true, startSeasonId: claimed + 1 === season.capacity ? season.id : undefined };
    } else if (result.kind === "failed") {
      if (payment.providerPaymentId && payment.providerPaymentId !== result.providerPaymentId) return { applied: false, reason: "provider id mismatch" };
      if (!["PENDING", "FAILED"].includes(payment.status)) return { applied: false, reason: "already settled" };
      await tx.payment.update({ where: { id: payment.id }, data: { status: "FAILED", providerPaymentId: result.providerPaymentId, lastWebhookEventId: result.eventId } });
    } else if (result.kind === "refunded") {
      if (!["SUCCEEDED", "PARTIALLY_REFUNDED"].includes(payment.status)) return { applied: false, reason: "not refundable" };
      if (payment.providerPaymentId !== result.providerPaymentId || !Number.isSafeInteger(result.amountCents) || result.amountCents <= 0 || (result.currency && result.currency !== payment.currency.toLowerCase())) return { applied: false, reason: "invalid refund" };
      const refundable = payment.chargedAmountCents ?? payment.amountCents;
      if (payment.refundedCents + result.amountCents > refundable) return { applied: false, reason: "invalid refund" };
      const refundedCents = payment.refundedCents + result.amountCents;
      await tx.payment.update({ where: { id: payment.id }, data: { refundedCents, status: refundedCents === refundable ? "REFUNDED" : "PARTIALLY_REFUNDED", lastWebhookEventId: result.eventId } });
      if (refundedCents === refundable && payment.entry && !["SURVIVOR", "ELIMINATED"].includes(payment.entry.status)) await tx.seasonEntry.update({ where: { id: payment.entry.id }, data: { status: "WITHDRAWN", manageTokenRevokedAt: new Date() } });
    } else {
      return { applied: false, reason: "ignored" };
    }
    await tx.paymentEvent.create({ data: { id: eventId, paymentId: payment.id, kind: result.kind } });
    return { applied: true, startSeasonId: undefined };
  });
  if (outcome.applied) {
    if (outcome.startSeasonId) {
      try {
        await startSeason(outcome.startSeasonId);
      } catch (error) {
        // Payment is already durably fulfilled. A start failure is retried by
        // the scheduler below, the authenticated cron endpoint, or the next
        // process boot — never rolled back.
        console.error("[surviver] full season could not start after payment", error);
      }
    }
    // The clock is permitted only for a full or already-running field.
    await activateCompetitionScheduler().catch(error => console.error("[surviver] scheduler activation failed", error));
  }
  return { applied: outcome.applied, ...(outcome.reason ? { reason: outcome.reason } : {}) };
}
