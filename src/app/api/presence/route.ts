import { touchVisitor } from "@/lib/tracking/presence";
import { isSameOrigin } from "@/lib/security/origin";
import { getVisitorContext } from "@/lib/tracking/visitor";

/**
 * The presence heartbeat: records that this visitor is here, and answers with
 * the current counts.
 *
 * POST rather than GET because it writes, which also keeps it out of any
 * intermediary's cache. Same-origin checks prevent cross-site writes.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return new Response(null, { status: 403 });
  }

  const presence = await touchVisitor(await getVisitorContext());

  return Response.json(presence, {
    headers: { "Cache-Control": "no-store" },
  });
}
