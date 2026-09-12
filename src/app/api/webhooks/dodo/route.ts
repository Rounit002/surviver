import { headers } from "next/headers";
import { Webhook } from "standardwebhooks";
import { env } from "@/lib/env";
import { getPaymentProvider } from "@/lib/payments";
import { applyPaymentResult } from "@/lib/payments/fulfill";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const h = await headers();
  if (!env.dodoWebhookKey) return Response.json({ error: "Webhook is not configured" }, { status: 503 });
  try {
    await new Webhook(env.dodoWebhookKey).verify(rawBody, { "webhook-id": h.get("webhook-id") ?? "", "webhook-signature": h.get("webhook-signature") ?? "", "webhook-timestamp": h.get("webhook-timestamp") ?? "" });
    const result = await getPaymentProvider().parseWebhook(rawBody, h.get("webhook-signature"));
    if (result.kind !== "ignored") await applyPaymentResult(result);
    return Response.json({ received: true });
  } catch {
    return Response.json({ error: "Invalid webhook" }, { status: 401 });
  }
}
