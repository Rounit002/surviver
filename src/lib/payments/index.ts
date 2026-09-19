import "server-only";

import { randomBytes } from "node:crypto";
import { env } from "@/lib/env";
import type { CheckoutInput, CheckoutSession, PaymentProvider, WebhookResult } from "@/lib/payments/types";

const dodoProvider: PaymentProvider = {
  name: "dodo",
  async createCheckout(input) {
    if (!env.dodoApiKey || !env.dodoProductId) throw new Error("Dodo Payments is not configured. Set DODO_PAYMENTS_API_KEY and DODO_PAYMENTS_PRODUCT_ID.");
    const base = env.dodoEnvironment === "test_mode" ? "https://test.dodopayments.com" : "https://live.dodopayments.com";
    const response = await fetch(`${base}/checkouts`, { method: "POST", headers: { Authorization: `Bearer ${env.dodoApiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ product_cart: [{ product_id: env.dodoProductId, quantity: 1 }], ...(input.customerEmail ? { customer: { email: input.customerEmail } } : {}), return_url: input.successUrl, metadata: { payment_id: input.paymentId } }), signal: AbortSignal.timeout(15_000) });
    if (!response.ok) {
      // Dodo explains rejections (bad key, unknown product, wrong mode) in the
      // body. Log it server-side: the founder never sees provider internals.
      console.error("[surviver] dodo checkout rejected", response.status, (await response.text().catch(() => "")).slice(0, 500));
      throw new Error(`Dodo checkout failed (${response.status}).`);
    }
    const data = (await response.json()) as { session_id?: string; checkout_url?: string };
    if (!data.checkout_url || !data.session_id) throw new Error("Dodo returned an incomplete checkout session.");
    return { url: data.checkout_url, providerCheckoutId: data.session_id };
  },
  async parseWebhook(rawBody, context) {
    const payload = JSON.parse(rawBody) as { type?: string; business_id?: string; data?: { payment_id?: string; total_amount?: number; amount?: number; currency?: string; business_id?: string; metadata?: Record<string, unknown> } };
    const providerPaymentId = payload.data?.payment_id;
    if (!providerPaymentId) return { kind: "ignored", reason: "missing payment id" };
    const businessId = payload.data?.business_id ?? payload.business_id;
    if (env.dodoBusinessId && businessId !== env.dodoBusinessId) return { kind: "ignored", reason: "wrong business" };
    const localPaymentId = typeof payload.data?.metadata?.payment_id === "string" ? payload.data.metadata.payment_id : undefined;
    const common = { providerPaymentId, localPaymentId, eventId: context.eventId, businessId, currency: payload.data?.currency?.toLowerCase() };
    if (payload.type === "payment.succeeded") return { kind: "succeeded", ...common, amountCents: payload.data?.total_amount ?? payload.data?.amount };
    if (payload.type === "payment.failed" || payload.type === "payment.cancelled") return { kind: "failed", ...common };
    if (payload.type === "refund.succeeded") return { kind: "refunded", ...common, amountCents: payload.data?.amount ?? 0 };
    return { kind: "ignored", reason: "unsupported event" };
  },
  async requestRefund(providerPaymentId, reason) {
    const base = env.dodoEnvironment === "test_mode" ? "https://test.dodopayments.com" : "https://live.dodopayments.com";
    const response = await fetch(`${base}/refunds`, { method: "POST", headers: { Authorization: `Bearer ${env.dodoApiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ payment_id: providerPaymentId, reason: reason.slice(0, 3000) }), signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`Dodo refund request failed (${response.status}).`);
  },
};

/**
 * Local provider used until a real one is connected in Phase 11. It mints an
 * identifier and hands the founder to an internal page that simulates the
 * provider's hosted checkout, so the entry flow exercises exactly the same
 * states as production: pending, succeeded, failed.
 */
const devProvider: PaymentProvider = {
  name: "dev",

  async createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
    return {
      url: `/enter/checkout/${input.paymentId}`,
      providerCheckoutId: `dev_checkout_${randomBytes(10).toString("hex")}`,
    };
  },

  async parseWebhook(rawBody: string, context): Promise<WebhookResult> {
    try {
      const parsed = JSON.parse(rawBody) as {
        type?: string;
        paymentId?: string;
          amountCents?: number;
      };
      if (!parsed.paymentId) return { kind: "ignored" };

      switch (parsed.type) {
        case "succeeded":
          return {
            kind: "succeeded",
            localPaymentId: parsed.paymentId,
            providerPaymentId: `dev_payment_${parsed.paymentId}`,
            eventId: context.eventId,
          };
        case "failed":
          return { kind: "failed", localPaymentId: parsed.paymentId, providerPaymentId: `dev_payment_${parsed.paymentId}`, eventId: context.eventId };
        case "refunded":
          return {
            kind: "refunded",
            localPaymentId: parsed.paymentId,
            providerPaymentId: `dev_payment_${parsed.paymentId}`,
            eventId: context.eventId,
            amountCents: parsed.amountCents ?? 0,
          };
        default:
          return { kind: "ignored" };
      }
    } catch {
      return { kind: "ignored" };
    }
  },
  async requestRefund() {},
};

const providers: Record<string, PaymentProvider> = {
  dev: devProvider,
  dodo: dodoProvider,
};

export function getPaymentProvider(): PaymentProvider {
  if (env.isProduction && env.paymentProvider === "dev") throw new Error("Simulated payments are disabled in production.");
  const provider = providers[env.paymentProvider];
  if (!provider) {
    throw new Error(
      `Unknown PAYMENT_PROVIDER "${env.paymentProvider}". Available: ${Object.keys(providers).join(", ")}`,
    );
  }
  return provider;
}

export function isDevPayments(): boolean {
  return !env.isProduction && env.paymentProvider === "dev";
}
