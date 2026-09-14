import "server-only";

import { cookies, headers } from "next/headers";
import {
  RALLY_COOKIE,
  SESSION_COOKIE,
  VISITOR_COOKIE,
} from "@/lib/competition/constants";
import { hashIp, requestIp } from "@/lib/security/request";
import { verifySignedValue } from "@/lib/security/tokens";

export type VisitorContext = {
  visitorId: string;
  sessionId: string;
  /** Rally code the visitor arrived through, if any. */
  rallyCode: string | null;
  userAgent: string | null;
  ipHash: string | null;
};

/**
 * Reads the identifiers assigned by the proxy. Falls back to an ephemeral id
 * when a client refuses cookies, so a page still renders; such a visitor
 * simply never accumulates scoring events.
 */
export async function getVisitorContext(): Promise<VisitorContext> {
  const store = await cookies();
  const h = await headers();

  return {
    visitorId: verifySignedValue(store.get(VISITOR_COOKIE)?.value, /^[a-f0-9]{32}$/) ?? "anonymous",
    sessionId: verifySignedValue(store.get(SESSION_COOKIE)?.value, /^[a-f0-9]{32}$/) ?? "anonymous",
    rallyCode: verifySignedValue(store.get(RALLY_COOKIE)?.value, /^[a-z0-9-]{1,40}$/i),
    userAgent: h.get("user-agent"),
    ipHash: hashIp(await requestIp()),
  };
}

/** Visitors without a real cookie must never generate scoring events. */
export function isScorable(ctx: VisitorContext): boolean {
  return ctx.visitorId !== "anonymous" && ctx.sessionId !== "anonymous";
}
