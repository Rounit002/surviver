import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { advanceSeason, autoStartFullSeasons } from "@/lib/competition/engine";
import { STARTABLE_SEASON_STATUSES } from "@/lib/competition/readiness";
import { getStartReadiness } from "@/lib/competition/season";
import { MAX_ATTEMPTS, RETRYABLE_STATUSES } from "@/lib/payments/webhook-policy";

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

/**
 * Whether the clock has anything to come back for.
 *
 * A season is the obvious answer, but a provider message still owed a retry is
 * the other one: that message can be the payment that puts a founder who has
 * already been charged onto the board. Waiting for the field to fill before
 * looking at it is exactly backwards — the message may be what fills it.
 */
async function hasPendingWork(): Promise<boolean> {
  if (await pendingSeasonCount()) return true;
  return (await prisma.webhookEvent.count({
    where: { provider: env.paymentProvider, status: { in: RETRYABLE_STATUSES }, attempts: { lt: MAX_ATTEMPTS } },
  })) > 0;
}

/** Idempotent: safe to call from a request path whenever a season may have moved. */
export async function activateCompetitionScheduler() {
  if (!(await hasPendingWork())) return;
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
    // Order matters: a stranded payment can be the entry that completes the
    // field, so retries run before anything reads the counts. They run while
    // registration is still open too — that is precisely when a payment the
    // provider has stopped redelivering would otherwise sit unsettled, with a
    // founder charged and nothing on the board to show for it.
    report.webhooks = await sweepWebhooks();

    // Registration alone must not start any recurring competition work.
    if (await pendingSeasonCount()) {
      report.started = await autoStartFullSeasons();

      const seasons = await prisma.season.findMany({ where: { status: "RUNNING" }, select: { id: true } });
      for (const { id } of seasons) {
        try {
          report.results.push({ seasonId: id, outcome: await advanceSeason(id) });
        } catch (error) {
          console.error("[surviver] round transition failed", id, error);
        }
      }
    }

    if (options.retention ?? ticks % RETENTION_EVERY_TICKS === 0) report.retention = await sweepRetention();

    // Nothing left to watch: stop the timer rather than poll an idle database.
    // A new payment brings it back through activateCompetitionScheduler.
    if (!(await hasPendingWork())) stopTimer();
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
