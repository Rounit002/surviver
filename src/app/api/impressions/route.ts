import { getVisitorContext } from "@/lib/tracking/visitor";
import { recordInteraction } from "@/lib/tracking/events";
import { readLimitedText } from "@/lib/security/request";
import { verifyInteractionProof } from "@/lib/security/tokens";
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return new Response(null, { status: 403 });
  let body;
  const raw = await readLimitedText(request, 4096);
  if (raw === null) return new Response(null, { status: 413 });
  try { body = JSON.parse(raw); } catch { return new Response(null, { status: 400 }); }
  if (!body || typeof body.entryId !== "string" || body.entryId.length > 100 || typeof body.proof !== "string" || body.proof.length > 1024 || typeof body.dwellMs !== "number") return new Response(null, { status: 400 });
  const visitor = await getVisitorContext();
  if (!verifyInteractionProof(body.proof, body.entryId, visitor)) return new Response(null, { status: 403 });
  const recorded = await recordInteraction(body.entryId, visitor, "impression", body.dwellMs);
  return Response.json({ recorded });
}
