import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

const SIGNATURE_BYTES = 32;

export function hashCapability(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function signValue(value: string): string {
  const signature = createHmac("sha256", env.securitySecret).update(value).digest("base64url");
  return `${value}.${signature}`;
}

export function verifySignedValue(signed: string | undefined, pattern: RegExp): string | null {
  if (!signed || signed.length > 256) return null;
  const split = signed.lastIndexOf(".");
  if (split <= 0) return null;
  const value = signed.slice(0, split);
  const signature = signed.slice(split + 1);
  if (!pattern.test(value)) return null;
  const expected = createHmac("sha256", env.securitySecret).update(value).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  return actual.length === SIGNATURE_BYTES && timingSafeEqual(actual, expected) ? value : null;
}

export type InteractionIdentity = { visitorId: string; sessionId: string };

export function createInteractionProof(entryId: string, identity: InteractionIdentity): string {
  const payload = Buffer.from(JSON.stringify({
    e: entryId,
    v: identity.visitorId,
    s: identity.sessionId,
    i: Date.now(),
  })).toString("base64url");
  return signValue(payload);
}

export function verifyInteractionProof(
  proof: string | undefined,
  entryId: string,
  identity: InteractionIdentity,
): boolean {
  const payload = verifySignedValue(proof, /^[A-Za-z0-9_-]{1,512}$/);
  if (!payload) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      e?: unknown; v?: unknown; s?: unknown; i?: unknown;
    };
    return parsed.e === entryId && parsed.v === identity.visitorId && parsed.s === identity.sessionId &&
      typeof parsed.i === "number" && Date.now() - parsed.i >= 0 && Date.now() - parsed.i <= 10 * 60_000;
  } catch {
    return false;
  }
}
