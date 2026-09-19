import { Webhook } from "standardwebhooks";
import { env } from "@/lib/env";
import { readLimitedText } from "@/lib/security/request";
import { claimWebhookEvent, releaseWebhookEvent } from "@/lib/payments/webhook-inbox";
import { processWebhookPayload } from "@/lib/payments/webhook-processing";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const rawBody = await readLimitedText(request, 256 * 1024);
  if (rawBody === null) return Response.json({ error: "Payload too large" }, { status: 413 });
  if (!env.dodoWebhookKey) return Response.json({ error: "Webhook is not configured" }, { status: 503 });
  const eventId = request.headers.get("webhook-id") ?? "";
  if (!/^[A-Za-z0-9_.:-]{1,200}$/.test(eventId)) return Response.json({ error: "Invalid webhook" }, { status: 401 });
  try {
    await new Webhook(env.dodoWebhookKey).verify(rawBody, { "webhook-id": eventId, "webhook-signature": request.headers.get("webhook-signature") ?? "", "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "" });
  } catch {
    return Response.json({ error: "Invalid webhook" }, { status: 401 });
  }

  let payload: ({ type?: unknown } & Prisma.InputJsonObject);
  try { payload = JSON.parse(rawBody) as typeof payload; }
  catch { return Response.json({ error: "Invalid payload" }, { status: 400 }); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return Response.json({ error: "Invalid payload" }, { status: 400 });

  const inboxId = `dodo:${eventId}`;
  const type = typeof payload.type === "string" ? payload.type.slice(0, 100) : "unknown";
  const claimedAt = new Date();
  const claimed = await claimWebhookEvent(inboxId, "dodo", type, payload, claimedAt).catch(error => {
    console.error("[surviver] webhook inbox unavailable", error);
    return null;
  });
  if (claimed === null) return Response.json({ error: "Processing unavailable" }, { status: 500 });
  if (!claimed) {
    const existing = await prisma.webhookEvent.findUnique({ where: { id: inboxId }, select: { status: true } });
    // Do not acknowledge another worker's unfinished claim as successfully
    // processed. Provider redelivery recovers it even before competition starts.
    return Response.json({ received: true, duplicate: true }, { status: existing?.status === "PROCESSING" ? 503 : 200 });
  }

  try {
    const stored = await prisma.webhookEvent.findUniqueOrThrow({ where: { id: inboxId }, select: { payload: true } });
    const outcome = await processWebhookPayload(eventId, JSON.stringify(stored.payload));
    await releaseWebhookEvent(inboxId, outcome.status, outcome.reason, new Date(), claimedAt);
    return Response.json({ received: true }, { status: outcome.reason === "unknown payment" ? 503 : 200 });
  } catch (error) {
    // Left retryable on purpose: the scheduler sweep picks it up again, and a
    // 500 also asks the provider to redeliver.
    await releaseWebhookEvent(inboxId, "FAILED", "processing failed", new Date(), claimedAt).catch(() => undefined);
    console.error("[surviver] authenticated webhook processing failed", error);
    return Response.json({ error: "Processing failed" }, { status: 500 });
  }
}
