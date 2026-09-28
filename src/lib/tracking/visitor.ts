import "server-only";

import { cookies, headers } from "next/headers";
import {
  HUMAN_COOKIE,
  RALLY_COOKIE,
  SESSION_COOKIE,
  VISITOR_COOKIE,
} from "@/lib/competition/constants";
import { env } from "@/lib/env";
import { hashIp, requestIp } from "@/lib/security/request";
import { signValue, verifySignedValue } from "@/lib/security/tokens";

export type VisitorContext = {
  visitorId: string;
  sessionId: string;
  /** Rally code the visitor arrived through, if any. */
  rallyCode: string | null;
  userAgent: string | null;
  ipHash: string | null;
  /** Passed the invisible human check recently, in this browser. */
  human?: boolean;
};

/** How long one passed human check vouches for a browser. */
export const HUMAN_PASS_MS = 12 * 60 * 60_000;

/**
 * Reads the identifiers assigned by the proxy. Falls back to an ephemeral id
 * when a client refuses cookies, so a page still renders; such a visitor
 * simply never accumulates scoring events.
 */
export async function getVisitorContext(): Promise<VisitorContext> {
  const store = await cookies();
  const h = await headers();
  const visitorId = verifySignedValue(store.get(VISITOR_COOKIE)?.value, /^[a-f0-9]{32}$/) ?? "anonymous";

  return {
    visitorId,
    sessionId: verifySignedValue(store.get(SESSION_COOKIE)?.value, /^[a-f0-9]{32}$/) ?? "anonymous",
    rallyCode: verifySignedValue(store.get(RALLY_COOKIE)?.value, /^[a-z0-9-]{1,40}$/i),
    userAgent: h.get("user-agent"),
    ipHash: hashIp(await requestIp()),
    human: readHumanPass(store.get(HUMAN_COOKIE)?.value, visitorId),
  };
}

/**
 * The human pass is `<visitorId>.<expiry>`, signed. Binding it to the visitor
 * id means a pass cannot be lifted from one browser and replayed in another
 * cookie jar, and the expiry makes each one lapse on its own.
 */
export function humanPassValue(visitorId: string, now = Date.now()): string {
  return signValue(`${visitorId}.${now + HUMAN_PASS_MS}`);
}

function readHumanPass(raw: string | undefined, visitorId: string): boolean {
  const value = verifySignedValue(raw, /^[a-f0-9]{32}\.\d{10,16}$/);
  if (!value) return false;
  const [id, expiry] = value.split(".");
  return id === visitorId && Number(expiry) > Date.now();
}

/** Visitors without a real cookie must never generate scoring events. */
export function isScorable(ctx: VisitorContext): boolean {
  return ctx.visitorId !== "anonymous" && ctx.sessionId !== "anonymous";
}

/**
 * Whether a click from this visitor may count at all.
 *
 * A real cookie; a known network, so "one per IP" can apply; and — whenever
 * the human check is switched on — a recent pass of it.
 */
export function canCountClicks(ctx: VisitorContext): boolean {
  if (!isScorable(ctx) || !ctx.ipHash) return false;
  if (/bot|crawler|spider|headless|puppeteer|playwright|selenium|phantom/i.test(ctx.userAgent ?? "")) return false;
  return env.turnstileEnabled ? ctx.human === true : true;
}
