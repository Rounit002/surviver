import { timingSafeEqual } from "node:crypto";
import { runCompetitionTick } from "@/lib/competition/scheduler";

/**
 * Optional external reinforcement for the in-process scheduler.
 *
 * The server already drives itself (see `lib/competition/scheduler`), so this
 * endpoint runs exactly the same pass: it is safe to call at any frequency,
 * and it shares a pass already in flight rather than duplicating work.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return new Response(null, { status: 401 });
  return Response.json(await runCompetitionTick({ retention: true }));
}
