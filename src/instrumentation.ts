/**
 * Boot hook (Next.js `instrumentation`).
 *
 * `register` runs once per server instance before it serves requests, which is
 * where the competition clock is picked back up after a deploy or a restart.
 * Nothing here may throw: a scheduler that cannot start must not take the site
 * down with it.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  try {
    const { resumeCompetitionScheduler } = await import("@/lib/competition/scheduler");
    await resumeCompetitionScheduler();
  } catch (error) {
    console.error("[surviver] competition scheduler could not be resumed at boot", error);
  }
}
