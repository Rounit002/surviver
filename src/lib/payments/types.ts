/**
 * Payment provider abstraction (PRD 33).
 *
 * Application code never talks to a provider SDK directly. Season 0 runs on the
 * dev provider; a real one is added in Phase 11 by implementing this interface,
 * with no changes to the entry flow.
 */

export type CheckoutInput = {
  paymentId: string;
  amountCents: number;
  currency: string;
  description: string;
  customerEmail: string;
  /** Where the provider should return the founder after paying. */
  successUrl: string;
  cancelUrl: string;
};

export type CheckoutSession = {
  /** Where to send the founder to complete payment. */
  url: string;
  /** The provider's own identifier, stored for reconciliation. */
  providerPaymentId: string | null;
};

export type WebhookResult =
  | { kind: "succeeded"; providerPaymentId: string; eventId: string }
  | { kind: "failed"; providerPaymentId: string; eventId: string }
  | { kind: "refunded"; providerPaymentId: string; eventId: string; amountCents: number }
  | { kind: "ignored" };

export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: CheckoutInput): Promise<CheckoutSession>;
  /**
   * Verifies the signature and returns what happened. Never trust a client
   * redirect as proof of payment (PRD 33).
   */
  parseWebhook(rawBody: string, signature: string | null): Promise<WebhookResult>;
}
