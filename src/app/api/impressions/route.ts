import { getVisitorContext } from "@/lib/tracking/visitor";
import { recordInteraction } from "@/lib/tracking/events";
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return new Response(null, { status: 403 });
  let body;
  try { body = JSON.parse(await request.text()); } catch { return new Response(null, { status: 400 }); }
  if (!body || typeof body.entryId !== "string" || body.entryId.length > 100 || typeof body.dwellMs !== "number") return new Response(null, { status: 400 });
  const recorded = await recordInteraction(body.entryId, await getVisitorContext(), "impression", body.dwellMs);
  return Response.json({ recorded });
}
