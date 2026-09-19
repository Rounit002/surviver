import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Rally landing (PRD 13).
 *
 * A founder's share link. It stamps the referring entry on the visit and drops
 * the spectator on the board, where their Rally code is picked up by the proxy
 * so their traffic can be told apart from ordinary discovery.
 */
export async function GET(request: Request, ctx: RouteContext<"/rally/[code]">) {
  const { code } = await ctx.params;
  const url = new URL("/board", request.url);

  // Bound the parameter before it reaches the database. This is an
  // unauthenticated endpoint, and the proxy only accepts this same shape when
  // it stamps the cookie, so anything else cannot be a real rally code.
  if (!/^[a-z0-9-]{1,40}$/i.test(code)) return NextResponse.redirect(url, 302);
  const entry = await prisma.seasonEntry.findUnique({
    where: { rallyCode: code },
    select: { id: true },
  });

  if (entry) url.searchParams.set("rally", code);

  return NextResponse.redirect(url, 302);
}
