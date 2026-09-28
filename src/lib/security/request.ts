import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import ipaddr from "ipaddr.js";
import { env } from "@/lib/env";

/**
 * The single source of truth for "who is this request from".
 *
 * Exactly one header is trusted: the one the ingress in front of the app
 * overwrites. Reading a list of fallbacks is the classic mistake — any header
 * the ingress does *not* set passes straight through from the client, so a
 * forged `X-Real-IP` or `CF-Connecting-IP` would let one machine present as
 * endless addresses and walk past every rate limit and fraud check keyed on it.
 *
 * Render rewrites `X-Forwarded-For` so its first entry is the real client, so
 * that is the default. `CLIENT_IP_HEADER` names a different one when the app
 * sits behind something else (e.g. `cf-connecting-ip` behind Cloudflare).
 */
export async function requestIp(): Promise<string> {
  const h = await headers();
  const raw = h.get(env.clientIpHeader);
  const candidate = env.clientIpHeader === "x-forwarded-for" ? raw?.split(",")[0] : raw;
  return candidate?.trim().slice(0, 128) || "unknown";
}

/**
 * The unit a "one per IP" rule should count.
 *
 * An IPv4 address is one subscriber. An IPv6 subscriber, though, is handed a
 * whole /64 — 18 quintillion addresses — and phones rotate through it on their
 * own, so keying on the full IPv6 address would give one person endless
 * "different IPs". The /64 prefix is the IPv6 equivalent of one IPv4 address.
 */
export function networkKey(ip: string): string {
  try {
    const parsed = ipaddr.parse(ip.trim());
    if (parsed.kind() === "ipv6") {
      const v6 = parsed as ipaddr.IPv6;
      if (v6.isIPv4MappedAddress()) return v6.toIPv4Address().toString();
      return `${v6.parts.slice(0, 4).map((part) => part.toString(16)).join(":")}::/64`;
    }
    return parsed.toString();
  } catch {
    return ip;
  }
}

/** Addresses are only ever stored hashed; the salt keeps them unlinkable. */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip || ip === "unknown") return null;
  return createHash("sha256").update(`${env.ipHashSalt}:${networkKey(ip)}`).digest("hex").slice(0, 32);
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
