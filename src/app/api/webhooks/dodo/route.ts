import { headers } from "next/headers";
import { Webhook } from "standardwebhooks";
import { env } from "@/lib/env";
import { getPaymentProvider } from "@/lib/payments";
import { applyPaymentResult } from "@/lib/payments/fulfill";
import { prisma } from "@/lib/db";
import { readLimitedText } from "@/lib/security/request";
import type { Prisma } from "@/generated/prisma";

export async function POST(request: Request) {
  const rawBody = await readLimitedText(request, 256 * 1024);
  if (rawBody === null) return Response.json({ error: "Payload too large" }, { status: 413 });
  const h = await headers();
  if (!env.dodoWebhookKey) return Response.json({ error: "Webhook is not configured" }, { status: 503 });
  try {
    const eventId = h.get("webhook-id") ?? "";
    if (!/^[A-Za-z0-9_.:-]{1,200}$/.test(eventId)) throw new Error("Invalid event id");
    await new Webhook(env.dodoWebhookKey).verify(rawBody, { "webhook-id": eventId, "webhook-signature": h.get("webhook-signature") ?? "", "webhook-timestamp": h.get("webhook-timestamp") ?? "" });
    const payload = JSON.parse(rawBody) as { type?: unknown } & Prisma.InputJsonObject;
    const type = typeof payload.type === "string" ? payload.type.slice(0, 100) : "unknown";
    const existing = await prisma.webhookEvent.findUnique({ where: { id: `dodo:${eventId}` }, select: { id: true } });
    if (existing) return Response.json({ received: true, duplicate: true });
    await prisma.webhookEvent.create({ data: { id: `dodo:${eventId}`, provider: "dodo", type, payload } });
    try {
      const result = await getPaymentProvider().parseWebhook(rawBody, { eventId });
      const outcome = result.kind === "ignored" ? { applied: false, reason: result.reason ?? "ignored" } : await applyPaymentResult(result);
      const benign = outcome.applied || outcome.reason === "duplicate event" || outcome.reason === "already settled" || result.kind === "ignored";
      await prisma.webhookEvent.update({ where: { id: `dodo:${eventId}` }, data: { status: benign ? "PROCESSED" : "NEEDS_REVIEW", failureReason: outcome.reason, processedAt: new Date() } });
      return Response.json({ received: true });
    } catch (error) {
      await prisma.webhookEvent.update({ where: { id: `dodo:${eventId}` }, data: { status: "FAILED", failureReason: "processing failed" } }).catch(() => undefined);
      console.error("[surviver] authenticated webhook processing failed", error);
      return Response.json({ error: "Processing failed" }, { status: 500 });
    }
  } catch {
    return Response.json({ error: "Invalid webhook" }, { status: 401 });
  }
}
