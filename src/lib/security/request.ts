import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { hashCapability } from "@/lib/security/tokens";

/**
 * The single source of truth for "who is this request from".
 *
 * Every one of these headers is client-supplied unless the ingress overwrites
 * it, so this is only as trustworthy as the proxy in front of the app. Prefer
 * the header the edge provider sets itself (`cf-connecting-ip`) over the
 * append-only `x-forwarded-for` chain, and take the *first* hop of that chain
 * only as a last resort.
 */
export async function requestIp(): Promise<string> {
  const h = await headers();
  const candidate =
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0] ??
    "unknown";
  return candidate.trim().slice(0, 128) || "unknown";
}

/** Addresses are only ever stored hashed; the salt keeps them unlinkable. */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip || ip === "unknown") return null;
  return createHash("sha256").update(`${env.ipHashSalt}:${ip}`).digest("hex").slice(0, 32);
}

export async function consumeRateLimit(
  scope: string,
  identity: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowMs);
  const key = `${scope}:${hashCapability(identity).slice(0, 40)}`;
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "rate_limit_buckets" ("key", "windowStart", "count", "expiresAt")
    VALUES (${key}, ${now}, 1, ${expiresAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "rate_limit_buckets"."expiresAt" <= ${now} THEN 1 ELSE "rate_limit_buckets"."count" + 1 END,
      "windowStart" = CASE WHEN "rate_limit_buckets"."expiresAt" <= ${now} THEN ${now} ELSE "rate_limit_buckets"."windowStart" END,
      "expiresAt" = CASE WHEN "rate_limit_buckets"."expiresAt" <= ${now} THEN ${expiresAt} ELSE "rate_limit_buckets"."expiresAt" END
    RETURNING "count"
  `;
  return (rows[0]?.count ?? limit + 1) <= limit;
}

export async function readLimitedText(request: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(output);
}
