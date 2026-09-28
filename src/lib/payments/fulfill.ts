import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { lockSeason, startSeason } from "@/lib/competition/engine";
import { activateCompetitionScheduler } from "@/lib/competition/scheduler";
import { CLAIMED_ENTRY_STATUSES } from "@/lib/competition/season";
import { getPaymentProvider } from "@/lib/payments";
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
      if (!payment.entry) return { applied: false, reason: "entry unavailable" };
      const now = new Date();
      // The checkout was written off (abandoned, or its creation failed) but the
      // founder paid anyway. They get their money back, not a stranded charge.
      if (payment.entry.status === "WITHDRAWN") {
        await tx.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED", chargedAmountCents: result.chargedAmountCents ?? result.amountCents, providerPaymentId: result.providerPaymentId, lastWebhookEventId: result.eventId, checkoutTokenHash: null, checkoutTokenExpiresAt: null, refundRequestedAt: now } });
        await tx.paymentEvent.create({ data: { id: eventId, paymentId: payment.id, kind: "succeeded:refund-owed" } });
        return { applied: true, refundOwed: true, startSeasonId: undefined };
      }
      if (payment.entry.status !== "AWAITING_PAYMENT") return { applied: false, reason: "entry unavailable" };
      const season = payment.season;
      const closed = season.status !== "REGISTRATION_OPEN" || (season.registrationStart && season.registrationStart > now) || (season.registrationEnd && season.registrationEnd <= now);
      const claimed = await tx.seasonEntry.count({ where: { seasonId: season.id, status: { in: CLAIMED_ENTRY_STATUSES } } });
      if (closed || claimed >= season.capacity) {
        // Money has already moved, so refusing is not enough — that used to
        // leave the founder charged with no spot and nothing to retry. Record
        // the payment honestly, release the entry, and owe the refund. It is
        // sent after this transaction commits and retried until it lands.
        await tx.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED", chargedAmountCents: result.chargedAmountCents ?? result.amountCents, providerPaymentId: result.providerPaymentId, lastWebhookEventId: result.eventId, checkoutTokenHash: null, checkoutTokenExpiresAt: null, refundRequestedAt: now } });
        // The campaign link stays valid so the founder can open it and read
        // that the season filled and their money is on its way back.
        await tx.seasonEntry.update({ where: { id: payment.entry.id }, data: { status: "WITHDRAWN" } });
        await tx.paymentEvent.create({ data: { id: eventId, paymentId: payment.id, kind: "succeeded:refund-owed" } });
        return { applied: true, refundOwed: true, startSeasonId: undefined };
      }
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
      if (refundedCents === refundable && payment.entry && !["SURVIVOR", "ELIMINATED", "FINISHED"].includes(payment.entry.status)) await tx.seasonEntry.update({ where: { id: payment.entry.id }, data: { status: "WITHDRAWN", manageTokenRevokedAt: new Date() } });
    } else {
      return { applied: false, reason: "ignored" };
    }
    await tx.paymentEvent.create({ data: { id: eventId, paymentId: payment.id, kind: result.kind } });
    return { applied: true, startSeasonId: undefined };
  });
  if (outcome.applied && "refundOwed" in outcome && outcome.refundOwed) {
    await sendOwedRefunds(identity.id).catch(error => console.error("[surviver] owed refund not sent yet", error));
  }
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

/**
 * Send every refund that is owed but not yet accepted by the provider.
 *
 * Each payment is claimed by stamping `refundSentAt` first with a conditional
 * update, so two concurrent sweeps can never both ask the provider to refund
 * the same charge. If the provider call fails the stamp is removed again and
 * the next sweep retries.
 */
export async function sendOwedRefunds(onlyPaymentId?: string): Promise<number> {
  const owed = await prisma.payment.findMany({
    where: { refundRequestedAt: { not: null }, refundSentAt: null, status: "SUCCEEDED", refundedCents: 0, providerPaymentId: { not: null }, ...(onlyPaymentId ? { id: onlyPaymentId } : {}) },
    select: { id: true, providerPaymentId: true },
    take: 20,
  });
  const provider = getPaymentProvider();
  let sent = 0;
  for (const payment of owed) {
    const claim = await prisma.payment.updateMany({ where: { id: payment.id, refundSentAt: null }, data: { refundSentAt: new Date() } });
    if (claim.count !== 1) continue;
    try {
      await provider.requestRefund(payment.providerPaymentId!, "Surviver.lol: the season was already full when this payment completed. Automatic full refund.");
      sent += 1;
    } catch (error) {
      await prisma.payment.update({ where: { id: payment.id }, data: { refundSentAt: null } });
      console.error("[surviver] refund request failed; will retry", payment.id, error);
    }
  }
  return sent;
}
