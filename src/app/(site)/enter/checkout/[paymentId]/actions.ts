"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { PENDING_PAYMENT_COOKIE } from "@/lib/competition/constants";
import { prisma } from "@/lib/db";
import { isDevPayments } from "@/lib/payments";
import { applyPaymentResult } from "@/lib/payments/fulfill";
import { hasCheckoutCapability } from "@/lib/payments/access";
import { consumeRateLimit, requestIp } from "@/lib/security/request";

/**
 * Drives the dev checkout. Guarded so it can never run once a real provider is
 * configured, and only for a payment this browser started (or an admin).
 */
export async function simulatePaymentAction(formData: FormData): Promise<void> {
  if (!isDevPayments()) throw new Error("Simulated payments are disabled.");

  const paymentId = String(formData.get("paymentId") ?? "");
  if (!/^[a-zA-Z0-9_-]{10,100}$/.test(paymentId)) redirect("/enter");
  const outcome = String(formData.get("outcome") ?? "");
  if (outcome !== "succeeded" && outcome !== "failed") {
    throw new Error("Unknown outcome.");
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      userId: true,
      amountCents: true,
      currency: true,
      checkoutTokenHash: true,
      checkoutTokenExpiresAt: true,
    },
  });
  if (!payment) redirect("/enter");

  const store = await cookies();
  const holdsCookie = hasCheckoutCapability(store.get(PENDING_PAYMENT_COOKIE)?.value, payment);
  const user = await getSessionUser();
  if (!holdsCookie && user?.id !== payment.userId) {
    redirect("/enter");
  }
  if (!(await consumeRateLimit("dev-payment", await requestIp(), 10, 60 * 60_000))) throw new Error("Too many payment attempts.");

  const result = await applyPaymentResult({
    kind: outcome,
    localPaymentId: payment.id,
    providerPaymentId: `dev_payment_${payment.id}`,
    eventId: `dev_evt_${randomBytes(8).toString("hex")}`,
    amountCents: payment.amountCents,
    currency: payment.currency.toLowerCase(),
  });

  if (!result.applied && result.reason !== "already settled") {
    redirect(`/enter/checkout/${paymentId}?unavailable=1`);
  }

  if (outcome === "failed") {
    redirect(`/enter/checkout/${paymentId}?failed=1`);
  }

  // Paid: the capability cookie has done its job.
  store.delete(PENDING_PAYMENT_COOKIE);
  // Same landing as the real provider: /enter/complete turns the campaign
  // cookie back into the private entry URL on our own origin.
  redirect("/enter/complete");
}
