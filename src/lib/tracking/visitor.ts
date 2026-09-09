import "server-only";

import { cookies, headers } from "next/headers";
import {
  RALLY_COOKIE,
  SESSION_COOKIE,
  VISITOR_COOKIE,
} from "@/lib/competition/constants";

export type VisitorContext = {
  visitorId: string;
  sessionId: string;
  /** Rally code the visitor arrived through, if any. */
  rallyCode: string | null;
  userAgent: string | null;
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
    visitorId: store.get(VISITOR_COOKIE)?.value ?? "anonymous",
    sessionId: store.get(SESSION_COOKIE)?.value ?? "anonymous",
    rallyCode: store.get(RALLY_COOKIE)?.value ?? null,
    userAgent: h.get("user-agent"),
  };
}

/** Visitors without a real cookie must never generate scoring events. */
export function isScorable(ctx: VisitorContext): boolean {
  return ctx.visitorId !== "anonymous" && ctx.sessionId !== "anonymous";
}
