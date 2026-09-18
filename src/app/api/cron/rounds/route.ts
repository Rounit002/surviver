import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { advanceSeason, autoStartFullSeasons } from "@/lib/competition/engine";
import { runRetention } from "@/lib/security/retention";
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return new Response(null, { status: 401 });
  // Seasons begin here rather than by hand: the field is complete and reviewed,
  // so the first round opens on the next tick without waiting for an admin.
  const started = await autoStartFullSeasons();
  const seasons = await prisma.season.findMany({ where: { status: "RUNNING" }, select: { id: true } });
  const results = [];
  for (const season of seasons) results.push({ seasonId: season.id, outcome: await advanceSeason(season.id) });
  // Housekeeping runs on the same authenticated schedule; a failure here must
  // not make a completed round transition look like it failed.
  let retention;
  try {
    retention = await runRetention();
  } catch (error) {
    console.error("[surviver] retention sweep failed", error);
  }
  return Response.json({ started, results, retention });
}
