import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { publicUrl } from "@/lib/security/origin";
import { getVisitorContext } from "@/lib/tracking/visitor";
import { recordInteraction } from "@/lib/tracking/events";
import { verifyInteractionProof } from "@/lib/security/tokens";

/**
 * Outbound tracking redirect (PRD 9).
 *
 * Every click on a contestant leaves through here so the visit can be verified
 * before the visitor is handed to the destination. Only the first visit from a
 * given visitor to a given product within a round scores; later ones are still
 * recorded for analytics.
 */

/** Only ever redirect to a plain web address we stored ourselves. */
function isSafeDestination(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export async function GET(request: Request, ctx: RouteContext<"/go/[slug]">) {
  const { slug } = await ctx.params;
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return NextResponse.redirect(publicUrl("/board"), 302);

  const product = await prisma.product.findUnique({
    where: { slug },
    select: {
      id: true,
      url: true,
      approvalStatus: true,
      entries: {
        where: {
          OR: [
            { status: { in: ["ACTIVE", "FINALIST", "SURVIVOR", "ELIMINATED"] } },
            {
              status: "UPCOMING",
              payment: { status: "SUCCEEDED" },
              season: { status: { in: ["REGISTRATION_OPEN", "REGISTRATION_CLOSED"] } },
            },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          rallyCode: true,
          season: { select: { id: true } },
        },
      },
    },
  });

  if (!product || !product.entries.length || product.approvalStatus !== "APPROVED" || !isSafeDestination(product.url)) {
    return NextResponse.redirect(publicUrl("/board"), 302);
  }

  const entry = product.entries[0];

  // Record the interaction, but never let a tracking failure block the visitor
  // from reaching the destination they asked for.
  if (entry) {
    try {
      const visitor = await getVisitorContext();
      const proof = new URL(request.url).searchParams.get("proof") ?? undefined;
      if (entry.status !== "UPCOMING" && verifyInteractionProof(proof, entry.id, visitor)) {
        await recordInteraction(entry.id, visitor, "visit");
      }
    } catch (error) {
      console.error("[surviver] failed to record outbound visit", error);
    }
  }

  return NextResponse.redirect(product.url, 302);
}
