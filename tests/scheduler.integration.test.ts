import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;

/**
 * The competition has to start itself.
 *
 * There is no administrator surface and no guaranteed external cron, so a
 * season reaching a full field is the only signal there is. This drives the
 * scheduler exactly as a server boot does and asserts that the season starts,
 * that rounds then close on their own, and that the clock stands down when
 * there is nothing left to watch.
 */
test("a full field starts and runs itself without any cron call", { skip: !databaseUrl }, async () => {
  const [{ prisma }, { resumeCompetitionScheduler, runCompetitionTick, isCompetitionSchedulerRunning }, { getActiveRound }] = await Promise.all([
    import("../src/lib/db"),
    import("../src/lib/competition/scheduler"),
    import("../src/lib/competition/season"),
  ]);

  const marker = randomUUID();
  // The database only accepts a 32-spot field, so the test uses a real one.
  const capacity = 32;
  let userId: string | undefined;
  let seasonId: string | undefined;

  try {
    const user = await prisma.user.create({ data: { email: `scheduler-${marker}@integration.invalid`, name: "Scheduler Test" } });
    userId = user.id;
    const latest = await prisma.season.aggregate({ _max: { number: true } });
    const season = await prisma.season.create({
      data: {
        number: (latest._max.number ?? -1) + 1,
        name: `Scheduler Integration ${marker}`,
        status: "REGISTRATION_OPEN",
        capacity,
        entryPriceCents: 2900,
        currency: "usd",
        minSampleImpressions: 0,
        registrationStart: new Date(Date.now() - 60_000),
        registrationEnd: new Date(Date.now() + 86_400_000),
      },
    });
    seasonId = season.id;

    await resumeCompetitionScheduler();
    assert.equal(isCompetitionSchedulerRunning(), false, "registration alone never starts the clock");
    // Registration alone starts no recurring work.
    assert.deepEqual(await runCompetitionTick(), { started: [], results: [] });

    // A complete field: every slot paid for and approved, nothing started.
    for (let i = 0; i < capacity; i++) {
      const product = await prisma.product.create({
        data: { ownerId: user.id, name: `Scheduler Product ${i}`, slug: `scheduler-${marker}-${i}`, url: `https://scheduler-${marker}-${i}.invalid/`, tagline: "Scheduler fixture", description: "Scheduler fixture only", category: "AI", approvalStatus: "APPROVED" },
      });
      const entry = await prisma.seasonEntry.create({
        data: { seasonId: season.id, productId: product.id, rallyCode: `scheduler-${marker}-${i}`, status: "UPCOMING" },
      });
      await prisma.payment.create({
        data: { userId: user.id, seasonId: season.id, seasonEntryId: entry.id, provider: "dev", amountCents: season.entryPriceCents, currency: "usd", status: "SUCCEEDED" },
      });
    }

    assert.equal((await prisma.season.findUniqueOrThrow({ where: { id: season.id } })).status, "REGISTRATION_OPEN");
    assert.equal(await getActiveRound(season.id), null);

    // A server boot is the only trigger. Nothing calls the cron endpoint.
    await resumeCompetitionScheduler();
    // Reaching capacity has to enable a clock, not merely satisfy a guard: a
    // season taking entries is exactly when the start check needs to be running.
    assert.equal(isCompetitionSchedulerRunning(), true, "the boot path started the clock");
    const boot = await runCompetitionTick();

    assert.deepEqual(boot.started, [{ seasonId: season.id, entrants: capacity }]);
    assert.equal((await prisma.season.findUniqueOrThrow({ where: { id: season.id } })).status, "RUNNING");
    const round = await getActiveRound(season.id);
    assert.ok(round, "the first round opened");
    assert.equal(round.roundNumber, 1);
    assert.equal(await prisma.productRoundStats.count({ where: { roundId: round.id } }), capacity);

    // A tick with nothing due changes nothing, and never starts a second season.
    const idle = await runCompetitionTick();
    assert.deepEqual(idle.started, []);
    assert.deepEqual(idle.results, [{ seasonId: season.id, outcome: "not due" }]);

    // One ranking window for the whole season: nobody is cut along the way.
    assert.equal(round.eliminationCount, 0);
    const window = round.endAt.getTime() - round.startAt.getTime();
    assert.equal(window, season.seasonLengthHours * 3_600_000);

    // Give one product the most clicks, then let the window fall due.
    const stats = await prisma.productRoundStats.findMany({ where: { roundId: round.id }, orderBy: { id: "asc" } });
    const leader = stats[5]!;
    await prisma.productRoundStats.update({ where: { id: leader.id }, data: { verifiedVisits: 40, qualifiedImpressions: 400 } });
    await prisma.productRoundStats.update({ where: { id: stats[9]!.id }, data: { verifiedVisits: 12, qualifiedImpressions: 300 } });
    await prisma.round.update({ where: { id: round.id }, data: { endAt: new Date(Date.now() - 1000) } });
    const closed = await runCompetitionTick();
    assert.deepEqual(closed.results, [{ seasonId: season.id, outcome: "completed" }]);

    // The season ends in one step: the most-clicked product is the Survivor,
    // every other product finishes with a distinct final rank, and no second
    // round is ever opened.
    assert.equal((await prisma.season.findUniqueOrThrow({ where: { id: season.id } })).status, "COMPLETED");
    assert.equal(await prisma.round.count({ where: { seasonId: season.id } }), 1);
    const entries = await prisma.seasonEntry.findMany({ where: { seasonId: season.id } });
    const winner = entries.find(e => e.id === leader.seasonEntryId)!;
    assert.equal(winner.status, "SURVIVOR");
    assert.equal(winner.finalRank, 1);
    assert.equal(entries.find(e => e.id === stats[9]!.seasonEntryId)!.finalRank, 2);
    const others = entries.filter(e => e.id !== winner.id);
    assert.ok(others.every(e => e.status === "FINISHED"));
    assert.equal(new Set(entries.map(e => e.finalRank)).size, capacity, "final placings are distinct");
    assert.equal(await prisma.seasonEntry.count({ where: { seasonId: season.id, status: "ELIMINATED" } }), 0);
  } finally {
    if (seasonId) await prisma.season.delete({ where: { id: seasonId } });
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  }
});
