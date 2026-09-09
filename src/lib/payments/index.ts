import "server-only";

import { randomBytes } from "node:crypto";
import { env } from "@/lib/env";
import type { CheckoutInput, CheckoutSession, PaymentProvider, WebhookResult } from "@/lib/payments/types";

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
