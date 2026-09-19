import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;

test("only verified, approved upcoming entries are publicly listed before competition starts", {
  skip: !databaseUrl,
}, async () => {
  const [{ prisma }, { applyPaymentResult }, { autoStartFullSeasons }, { getActiveRound, getPublicUpcomingEntries }, { getStandings }] = await Promise.all([
    import("../src/lib/db"),
    import("../src/lib/payments/fulfill"),
    import("../src/lib/competition/engine"),
    import("../src/lib/competition/season"),
    import("../src/lib/competition/standings"),
  ]);

  const marker = randomUUID();
  const capacity = Number(process.env.TEST_SEASON_CAPACITY ?? "35");
  assert.ok(Number.isInteger(capacity) && capacity >= 2);
  let userId: string | undefined;
  let seasonId: string | undefined;

  try {
    const user = await prisma.user.create({
      data: { email: `payment-test-${marker}@integration.invalid`, name: "Integration Test" },
    });
    userId = user.id;
    const latestSeason = await prisma.season.aggregate({ _max: { number: true } });
    const season = await prisma.season.create({
      data: {
        number: (latestSeason._max.number ?? -1) + 1,
        name: `Payment Integration ${marker}`,
        status: "REGISTRATION_OPEN",
        capacity,
        entryPriceCents: 2900,
        currency: "usd",
        registrationStart: new Date(Date.now() - 60_000),
        registrationEnd: new Date(Date.now() + 86_400_000),
      },
    });
    seasonId = season.id;

    const fixtures: Array<{ productId: string; entryId: string; paymentId: string }> = [];
    for (let i = 0; i < capacity; i++) {
      const product = await prisma.product.create({
        data: {
          ownerId: user.id,
          name: `Test Product ${i}`,
          slug: `payment-test-${marker}-${i}`,
          url: `https://example-${marker}-${i}.invalid/`,
          tagline: "Integration fixture",
          description: "Integration fixture only",
          category: "AI",
        },
      });
      const entry = await prisma.seasonEntry.create({
        data: {
          seasonId: season.id,
          productId: product.id,
          rallyCode: `payment-${marker}-${i}`,
          status: "AWAITING_PAYMENT",
        },
      });
      const payment = await prisma.payment.create({
        data: {
          userId: user.id,
          seasonId: season.id,
          seasonEntryId: entry.id,
          provider: "dev",
          amountCents: season.entryPriceCents,
          currency: season.currency,
          status: "PENDING",
        },
      });
      fixtures.push({ productId: product.id, entryId: entry.id, paymentId: payment.id });
    }

    assert.equal((await getPublicUpcomingEntries(season.id)).length, 0);

    const first = fixtures[0]!;
    const providerPaymentId = `provider-${marker}-0`;
    const failed = await applyPaymentResult({
      kind: "failed",
      localPaymentId: first.paymentId,
      providerPaymentId,
      eventId: `${marker}-failed`,
    });
    assert.equal(failed.applied, true);
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: first.productId } })).approvalStatus, "DRAFT");
    assert.equal((await prisma.seasonEntry.findUniqueOrThrow({ where: { id: first.entryId } })).status, "AWAITING_PAYMENT");

    for (let i = 0; i < fixtures.length; i++) {
      const fixture = fixtures[i]!;
      const result = await applyPaymentResult({
        kind: "succeeded",
        localPaymentId: fixture.paymentId,
        providerPaymentId: i === 0 ? providerPaymentId : `provider-${marker}-${i}`,
        eventId: `${marker}-success-${i}`,
        amountCents: season.entryPriceCents,
        currency: "usd",
      });
      assert.equal(result.applied, true);
      if (i === 0) {
        const publicEntries = await getPublicUpcomingEntries(season.id);
        assert.equal(publicEntries.length, 1);
        assert.equal(publicEntries[0]?.id, fixture.entryId);
      }
    }

    assert.equal((await prisma.seasonEntry.findUniqueOrThrow({ where: { id: first.entryId } })).status, "UPCOMING");
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: first.productId } })).approvalStatus, "APPROVED");
    assert.equal(await getActiveRound(season.id), null);
    assert.equal((await getPublicUpcomingEntries(season.id)).length, capacity);
    assert.deepEqual(await autoStartFullSeasons(), [{ seasonId: season.id, entrants: capacity }]);

    const activeRound = await getActiveRound(season.id);
    assert.ok(activeRound);
    assert.equal((await getPublicUpcomingEntries(season.id)).length, 0);
    const standings = await getStandings(season, activeRound);
    assert.equal(standings.rows.length, capacity);

    const duplicate = await applyPaymentResult({
      kind: "succeeded",
      localPaymentId: first.paymentId,
      providerPaymentId,
      eventId: `${marker}-success-0`,
      amountCents: season.entryPriceCents,
      currency: "usd",
    });
    assert.deepEqual(duplicate, { applied: false, reason: "duplicate event" });
    assert.equal(await prisma.productRoundStats.count({ where: { roundId: activeRound.id } }), capacity);
  } finally {
    if (seasonId) await prisma.season.delete({ where: { id: seasonId } });
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  }
});
