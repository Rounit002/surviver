import { touchVisitor } from "@/lib/tracking/presence";
import { getVisitorContext } from "@/lib/tracking/visitor";
import { consumeRateLimit, requestIp } from "@/lib/security/request";

/**
 * The presence heartbeat: records that this visitor is here, and answers with
 * the current counts.
 *
 * POST rather than GET because it writes, which also keeps it out of any
 * intermediary's cache. Same-origin only, and rate limited per IP — the write
 * is a single keyed upsert, but the read behind it is two counts, and an
 * unmetered endpoint that runs two counts is a free way to load the database.
 *
 * The limit is deliberately generous relative to the sixty-second heartbeat:
 * a visitor with several tabs open is normal, not abuse.
 */
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return new Response(null, { status: 403 });
  }

  if (!(await consumeRateLimit("presence-ip", await requestIp(), 60, 60_000))) {
    return new Response(null, { status: 429 });
  }

  const presence = await touchVisitor(await getVisitorContext());

  return Response.json(presence, {
    headers: { "Cache-Control": "no-store" },
  });
}
