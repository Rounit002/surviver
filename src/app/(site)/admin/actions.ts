"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { startSeason, advanceSeason, lockSeason } from "@/lib/competition/engine";
import { getPaymentProvider } from "@/lib/payments";

/**
 * Review decisions. Every one writes an audit row: manual intervention in a
 * paid competition must always be traceable (PRD 30).
 */

export async function approveEntryAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const entryId = String(formData.get("entryId") ?? "");

  const entry = await prisma.seasonEntry.findUnique({
    where: { id: entryId },
    select: { id: true, seasonId: true, productId: true, status: true, season: { select: { status: true } } },
  });
  if (!entry || entry.status !== "AWAITING_APPROVAL") return;

  if (entry.season.status === "RUNNING" || entry.season.status === "COMPLETED") throw new Error("Review must finish before the season starts.");
  await prisma.$transaction(async (tx) => {
    await lockSeason(tx, entry.seasonId);
    const current = await tx.seasonEntry.findUnique({ where: { id: entry.id }, include: { season: true, payment: true } });
    if (!current || current.status !== "AWAITING_APPROVAL" || current.payment?.status !== "SUCCEEDED" || !["REGISTRATION_OPEN", "REGISTRATION_CLOSED"].includes(current.season.status)) throw new Error("Entry is no longer available for review.");
    await tx.product.update({
      where: { id: entry.productId },
      data: { approvalStatus: "APPROVED", reviewNote: null },
    });
    // Review is completed before the first round.
    await tx.seasonEntry.update({
      where: { id: entry.id },
      data: { status: "UPCOMING" },
    });
    await tx.adminAction.create({ data: { adminUserId: admin.id, actionType: "entry.approve", targetType: "season_entry", targetId: entry.id } });
  });
  revalidatePath("/admin");
  revalidatePath("/board");
}

export async function rejectEntryAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const entryId = String(formData.get("entryId") ?? "");
  const reason = String(formData.get("reason") ?? "").slice(0, 500) || "Did not meet the entry policy.";

  const entry = await prisma.seasonEntry.findUnique({
    where: { id: entryId },
    select: { id: true, seasonId: true, productId: true, status: true, payment: { select: { id: true, status: true, providerPaymentId: true } } },
  });
  if (!entry || entry.status !== "AWAITING_APPROVAL") return;

  await prisma.$transaction(async (tx) => {
    await lockSeason(tx, entry.seasonId);
    const current = await tx.seasonEntry.findUnique({ where: { id: entry.id }, include: { season: true, payment: true } });
    if (!current || current.status !== "AWAITING_APPROVAL" || !["REGISTRATION_OPEN", "REGISTRATION_CLOSED"].includes(current.season.status)) throw new Error("Entry is no longer available for review.");
    await tx.product.update({
      where: { id: entry.productId },
      data: { approvalStatus: "REJECTED", reviewNote: reason },
    });
    await tx.seasonEntry.update({ where: { id: entry.id }, data: { status: "REJECTED" } });
    if (current.payment?.status === "SUCCEEDED") await tx.payment.update({ where: { id: current.payment.id }, data: { refundRequestedAt: new Date() } });
    await tx.adminAction.create({ data: { adminUserId: admin.id, actionType: "entry.reject", targetType: "season_entry", targetId: entry.id, metadata: { reason, refundRequested: current.payment?.status === "SUCCEEDED" } } });
  });
  if (entry.payment?.status === "SUCCEEDED" && entry.payment.providerPaymentId) {
    try {
      await getPaymentProvider().requestRefund(entry.payment.providerPaymentId, reason);
    } catch (error) {
      await prisma.adminAction.create({ data: { adminUserId: admin.id, actionType: "refund.request_failed", targetType: "payment", targetId: entry.payment.id } });
      throw error;
    }
  }
  revalidatePath("/admin");
}

export async function startSeasonAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  await startSeason(String(formData.get("seasonId") ?? ""), admin.id);
  revalidatePath("/", "layout");
}
export async function advanceSeasonAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const seasonId = String(formData.get("seasonId") ?? "");
  await advanceSeason(seasonId, admin.id);
  revalidatePath("/", "layout");
}
