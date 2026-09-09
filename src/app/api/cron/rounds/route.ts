import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { advanceSeason } from "@/lib/competition/engine";
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return new Response(null, { status: 401 });
  const seasons = await prisma.season.findMany({ where: { status: "RUNNING" }, select: { id: true } });
  const results = [];
  for (const season of seasons) results.push({ seasonId: season.id, outcome: await advanceSeason(season.id) });
  return Response.json({ results });
}
