import "server-only";

import { createHmac } from "node:crypto";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { requestIp } from "@/lib/security/request";

let checksSincePrune = 0;

/** Apply a distributed fixed-window limit to the current request. */
export async function checkRequestLimit(
  scope: string,
  maximum: number,
  windowMs: number,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  return consumeLimit(scope, await requestIp(), maximum, windowMs);
}

/** Separate subject input keeps the database counter deterministic in tests. */
export async function consumeLimit(
  scope: string,
  subject: string,
  maximum: number,
  windowMs: number,
  now = new Date(),
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  if (!Number.isInteger(maximum) || maximum < 1 || !Number.isFinite(windowMs) || windowMs < 1) {
    throw new Error("Invalid rate-limit policy.");
  }

  const key = createHmac("sha256", env.ipHashSalt).update(`${scope}:${subject || "unknown"}`).digest("hex");
  const cutoff = new Date(now.getTime() - windowMs);
  const expiry = new Date(now.getTime() + windowMs);
  const [bucket] = await prisma.$queryRaw<Array<{ hitCount: number; windowStartedAt: Date }>>`
    INSERT INTO "rate_limit_buckets" ("key", "hitCount", "windowStartedAt", "expiresAt")
    VALUES (${key}, 1, ${now}, ${expiry})
    ON CONFLICT ("key") DO UPDATE SET
      "hitCount" = CASE WHEN "rate_limit_buckets"."windowStartedAt" <= ${cutoff}
        THEN 1 ELSE "rate_limit_buckets"."hitCount" + 1 END,
      "windowStartedAt" = CASE WHEN "rate_limit_buckets"."windowStartedAt" <= ${cutoff}
        THEN ${now} ELSE "rate_limit_buckets"."windowStartedAt" END,
      "expiresAt" = CASE WHEN "rate_limit_buckets"."windowStartedAt" <= ${cutoff}
        THEN ${expiry} ELSE "rate_limit_buckets"."expiresAt" END
    RETURNING "hitCount", "windowStartedAt"
  `;

  // Cleanup is opportunistic and request-driven; it does not create a timer or
  // background job while the season is still filling.
  checksSincePrune += 1;
  if (checksSincePrune >= 64) {
    checksSincePrune = 0;
    void prisma.rateLimitBucket.deleteMany({ where: { expiresAt: { lte: now } } }).catch((error: unknown) => {
      console.warn("[surviver] expired rate-limit cleanup failed", error);
    });
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.windowStartedAt.getTime() + windowMs - now.getTime()) / 1000));
  return { allowed: bucket.hitCount <= maximum, retryAfterSeconds };
}
