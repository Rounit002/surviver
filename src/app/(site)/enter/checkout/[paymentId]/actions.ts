"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { PENDING_PAYMENT_COOKIE } from "@/lib/competition/constants";
import { prisma } from "@/lib/db";
import { isDevPayments } from "@/lib/payments";
import { applyPaymentResult } from "@/lib/payments/fulfill";

/**
 * Drives the dev checkout. Guarded so it can never run once a real provider is
 * configured, and only for a payment this browser started (or an admin).
 */
export async function simulatePaymentAction(formData: FormData): Promise<void> {
  if (!isDevPayments()) throw new Error("Simulated payments are disabled.");

  const paymentId = String(formData.get("paymentId") ?? "");
  const outcome = String(formData.get("outcome") ?? "");
  if (outcome !== "succeeded" && outcome !== "failed") {
    throw new Error("Unknown outcome.");
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      userId: true,
      providerPaymentId: true,
      entry: { select: { manageToken: true } },
    },
  });
  if (!payment?.providerPaymentId) redirect("/enter");

  const store = await cookies();
  const holdsCookie = store.get(PENDING_PAYMENT_COOKIE)?.value === payment.id;
  const user = await getSessionUser();
  if (!holdsCookie && user?.id !== payment.userId && user?.role !== "ADMIN") {
    redirect("/enter");
  }

  const result = await applyPaymentResult({
    kind: outcome,
    providerPaymentId: payment.providerPaymentId,
    eventId: `dev_evt_${randomBytes(8).toString("hex")}`,
  });

  if (!result.applied && result.reason !== "already settled") {
    redirect(`/enter/checkout/${paymentId}?unavailable=1`);
  }

  if (outcome === "failed") {
    redirect(`/enter/checkout/${paymentId}?failed=1`);
  }

  // Paid: the capability cookie has done its job.
  store.delete(PENDING_PAYMENT_COOKIE);
  redirect(
    payment.entry?.manageToken ? `/entry/${payment.entry.manageToken}?paid=1` : "/board",
  );
}
