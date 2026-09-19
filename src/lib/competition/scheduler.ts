import "server-only";
import { prisma } from "@/lib/db";
import { advanceSeason, autoStartFullSeasons } from "@/lib/competition/engine";
import { STARTABLE_SEASON_STATUSES } from "@/lib/competition/readiness";
import { getStartReadiness } from "@/lib/competition/season";

/**
 * In-process competition clock.
 *
 * The site has no administrator surface and no guaranteed external cron, so the
 * server drives itself: it starts a season the moment its field is complete,
 * closes rounds when they fall due, retries stranded provider messages and runs
 * retention. `/api/cron/rounds` calls the same tick, so an external scheduler is
 * a reinforcement rather than a dependency.
 */

const TICK_MS = 60_000;
const RETENTION_EVERY_TICKS = 60; // hourly

const scheduler = globalThis as unknown as {
  surviverCompetitionTimer?: ReturnType<typeof setInterval>;
  surviverCompetitionTick?: Promise<CompetitionTickReport> | undefined;
  surviverCompetitionTicks?: number;
};

export type CompetitionTickReport = {
  webhooks?: Array<{ id: string; status: string; reason?: string }>;
  started: Array<{ seasonId: string; entrants: number }>;
  results: Array<{ seasonId: string; outcome: string }>;
  retention?: { sessions: number; webhookEvents: number; abandonedEntries: number };
};

/**
 * Only full, eligible fields or running seasons may enable recurring work.
 */
async function pendingSeasonCount(): Promise<number> {
  if (await prisma.season.count({ where: { status: "RUNNING" } })) return 1;
  const seasons = await prisma.season.findMany({ where: { status: { in: STARTABLE_SEASON_STATUSES } } });
  for (const season of seasons) {
    if ((await getStartReadiness(prisma, season)).canStart) return 1;
  }
  return 0;
}

/** Idempotent: safe to call from a request path whenever a season may have moved. */
export async function activateCompetitionScheduler() {
  if (!(await pendingSeasonCount())) return;
  if (scheduler.surviverCompetitionTimer) return;
  scheduler.surviverCompetitionTimer = setInterval(() => void runCompetitionTick(), TICK_MS);
  scheduler.surviverCompetitionTimer.unref?.();
  void runCompetitionTick();
}

/** Whether the clock is currently ticking. */
export function isCompetitionSchedulerRunning(): boolean {
  return scheduler.surviverCompetitionTimer !== undefined;
}

/**
 * Called once per server boot. A database that is not up yet must not stop the
 * server from starting: the next payment activates the clock anyway.
 */
export async function resumeCompetitionScheduler() {
  try {
    await activateCompetitionScheduler();
  } catch (error) {
    console.error("[surviver] could not resume the competition scheduler", error);
  }
}

/**
 * One full pass, awaitable.
 *
 * Concurrent callers share the pass already in flight rather than queueing a
 * second one, so a cron call landing on top of a timer tick cannot double up.
 */
export function runCompetitionTick(options: { retention?: boolean } = {}): Promise<CompetitionTickReport> {
  if (scheduler.surviverCompetitionTick) return scheduler.surviverCompetitionTick;
  const pass = tick(options).finally(() => { scheduler.surviverCompetitionTick = undefined; });
  scheduler.surviverCompetitionTick = pass;
  return pass;
}

async function tick(options: { retention?: boolean }): Promise<CompetitionTickReport> {
  const ticks = (scheduler.surviverCompetitionTicks ?? 0) + 1;
  scheduler.surviverCompetitionTicks = ticks;
  const report: CompetitionTickReport = { started: [], results: [] };
  try {
    // Registration alone must not start any recurring competition work.
    if (!(await pendingSeasonCount())) {
      stopTimer();
      return report;
    }
    // Order matters: a stranded payment can be the entry that completes the
    // field, so retries run before the start check reads the counts.
    report.webhooks = await sweepWebhooks();
    report.started = await autoStartFullSeasons();

    const seasons = await prisma.season.findMany({ where: { status: "RUNNING" }, select: { id: true } });
    for (const { id } of seasons) {
      try {
        report.results.push({ seasonId: id, outcome: await advanceSeason(id) });
      } catch (error) {
        console.error("[surviver] round transition failed", id, error);
      }
    }

    if (options.retention ?? ticks % RETENTION_EVERY_TICKS === 0) report.retention = await sweepRetention();

    // Nothing left to watch: stop the timer rather than poll an idle database.
    // A new payment brings it back through activateCompetitionScheduler.
    if (!(await pendingSeasonCount())) stopTimer();
  } catch (error) {
    console.error("[surviver] competition scheduler tick failed", error);
  }
  return report;
}

function stopTimer() {
  if (scheduler.surviverCompetitionTimer) clearInterval(scheduler.surviverCompetitionTimer);
  scheduler.surviverCompetitionTimer = undefined;
}

/** Imported lazily: payment fulfilment reaches back into this module. */
async function sweepWebhooks() {
  try {
    const { retryPendingWebhooks } = await import("@/lib/payments/webhook-processing");
    return await retryPendingWebhooks();
  } catch (error) {
    console.error("[surviver] webhook retry sweep failed", error);
  }
}

async function sweepRetention() {
  try {
    const { runRetention } = await import("@/lib/security/retention");
    return await runRetention();
  } catch (error) {
    // Housekeeping must never make a completed round transition look failed.
    console.error("[surviver] retention sweep failed", error);
  }
}
