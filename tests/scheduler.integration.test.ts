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
  const capacity = 3;
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

    // Once the round falls due the same tick closes it, with no elimination
    // decided by hand.
    await prisma.round.update({ where: { id: round.id }, data: { endAt: new Date(Date.now() - 1000) } });
    const closed = await runCompetitionTick();
    assert.deepEqual(closed.results, [{ seasonId: season.id, outcome: "advanced" }]);
    const second = await getActiveRound(season.id);
    assert.ok(second);
    assert.equal(second.roundNumber, 2);
    assert.equal(second.name, "Final", "three entrants leave two finalists");
  } finally {
    if (seasonId) await prisma.season.delete({ where: { id: seasonId } });
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  }
});
