import "server-only";

import { randomBytes } from "node:crypto";
import { env } from "@/lib/env";
import type { CheckoutInput, CheckoutSession, PaymentProvider, WebhookResult } from "@/lib/payments/types";

const dodoProvider: PaymentProvider = {
  name: "dodo",
  async createCheckout(input) {
    if (!env.dodoApiKey || !env.dodoProductId) throw new Error("Dodo Payments is not configured. Set DODO_PAYMENTS_API_KEY and DODO_PAYMENTS_PRODUCT_ID.");
    const base = env.dodoEnvironment === "test_mode" ? "https://test.dodopayments.com" : "https://live.dodopayments.com";
    const response = await fetch(`${base}/checkouts`, { method: "POST", headers: { Authorization: `Bearer ${env.dodoApiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ product_cart: [{ product_id: env.dodoProductId, quantity: 1 }], customer: { email: input.customerEmail }, return_url: input.successUrl, metadata: { payment_id: input.paymentId } }) });
    if (!response.ok) throw new Error(`Dodo checkout failed (${response.status}).`);
    const data = (await response.json()) as { session_id?: string; checkout_url?: string };
    if (!data.checkout_url || !data.session_id) throw new Error("Dodo returned an incomplete checkout session.");
    return { url: data.checkout_url, providerPaymentId: data.session_id };
  },
  async parseWebhook(rawBody, signature) {
    if (!env.dodoWebhookKey || !signature) return { kind: "ignored" };
    // Signature verification is performed in the route with Standard Webhooks.
    const payload = JSON.parse(rawBody) as { type?: string; id?: string; data?: { payment_id?: string; paymentId?: string; amount?: number; amount_cents?: number } };
    const providerPaymentId = payload.data?.payment_id ?? payload.data?.paymentId;
    if (!providerPaymentId || !payload.id) return { kind: "ignored" };
    if (payload.type === "payment.succeeded") return { kind: "succeeded", providerPaymentId, eventId: payload.id };
    if (payload.type === "payment.failed" || payload.type === "payment.cancelled") return { kind: "failed", providerPaymentId, eventId: payload.id };
    if (payload.type === "refund.succeeded") return { kind: "refunded", providerPaymentId, eventId: payload.id, amountCents: payload.data?.amount_cents ?? payload.data?.amount ?? 0 };
    return { kind: "ignored" };
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
      providerPaymentId: `dev_${randomBytes(10).toString("hex")}`,
    };
  },

  async parseWebhook(rawBody: string): Promise<WebhookResult> {
    try {
      const parsed = JSON.parse(rawBody) as {
        type?: string;
        paymentId?: string;
        eventId?: string;
        amountCents?: number;
      };
      if (!parsed.paymentId || !parsed.eventId) return { kind: "ignored" };

      switch (parsed.type) {
        case "succeeded":
          return {
            kind: "succeeded",
            providerPaymentId: parsed.paymentId,
            eventId: parsed.eventId,
          };
        case "failed":
          return { kind: "failed", providerPaymentId: parsed.paymentId, eventId: parsed.eventId };
        case "refunded":
          return {
            kind: "refunded",
            providerPaymentId: parsed.paymentId,
            eventId: parsed.eventId,
            amountCents: parsed.amountCents ?? 0,
          };
        default:
          return { kind: "ignored" };
      }
    } catch {
      return { kind: "ignored" };
    }
  },
};

const providers: Record<string, PaymentProvider> = {
  dev: devProvider,
  dodo: dodoProvider,
};

export function getPaymentProvider(): PaymentProvider {
  const provider = providers[env.paymentProvider];
  if (!provider) {
    throw new Error(
      `Unknown PAYMENT_PROVIDER "${env.paymentProvider}". Available: ${Object.keys(providers).join(", ")}`,
    );
  }
  return provider;
}

export function isDevPayments(): boolean {
  return env.paymentProvider === "dev";
}
