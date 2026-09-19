import "server-only";

import { prisma } from "@/lib/db";
import { isScorable, type VisitorContext } from "./visitor";

/**
 * Site presence: how many people are here now, and how many have ever been.
 *
 * Both numbers come from this project's own database and its own cookie. There
 * is no analytics provider involved, nothing is sent anywhere, and the only
 * thing stored is the opaque random id the proxy already assigns — so this adds
 * no third-party dependency and nothing new to disclose.
 *
 * ## Why not reuse the scoring tables
 *
 * `ImpressionEvent` looks like it should answer this and cannot. It is only
 * written while a round is active and only for product cards, so it is blind to
 * a visitor reading the rules, and blind to every visitor during registration.
 * It is also the competition's evidence: shaping it to feed a counter would put
 * a display concern inside the thing that decides who is eliminated.
 */

/**
 * How recently a visitor must have checked in to count as online.
 *
 * Three minutes against a sixty-second heartbeat, so a visitor has to miss
 * three in a row before they drop off. A window this much larger than the
 * interval is what stops the number flickering as beats land slightly late.
 */
export const ONLINE_WINDOW_MS = 3 * 60_000;

export type Presence = {
  /** Distinct visitors seen within `ONLINE_WINDOW_MS`. */
  online: number;
  /** Distinct visitors ever recorded. */
  total: number;
};

export async function readPresence(now = new Date()): Promise<Presence> {
  const [online, total] = await Promise.all([
    prisma.siteVisitor.count({
      where: { lastSeenAt: { gte: new Date(now.getTime() - ONLINE_WINDOW_MS) } },
    }),
    prisma.siteVisitor.count(),
  ]);
  return { online, total };
}

/**
 * Records that this visitor is here, and returns the counts including them.
 *
 * A visitor with no cookie is not recorded. That is the same rule the scoring
 * path uses, and it matters for the same reason: without an identity there is
 * nothing to deduplicate against, so every request would look like a new
 * person and the total would climb on its own.
 */
export async function touchVisitor(visitor: VisitorContext, now = new Date()): Promise<Presence> {
  const isBot = /bot|crawler|spider|headless|preview|fetch/i.test(visitor.userAgent ?? "");

  if (isScorable(visitor) && !isBot) {
    await prisma.siteVisitor.upsert({
      where: { visitorId: visitor.visitorId },
      create: { visitorId: visitor.visitorId, firstSeenAt: now, lastSeenAt: now },
      update: { lastSeenAt: now },
    });
  }

  return readPresence(now);
}
