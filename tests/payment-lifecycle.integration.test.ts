import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;

test("only verified, approved upcoming entries are publicly listed before competition starts", {
  skip: !databaseUrl,
}, async () => {
  const [{ prisma }, { applyPaymentResult }, { autoStartFullSeasons, advanceSeason }, { getActiveRound, getPublicUpcomingEntries }, { getStandings }, { claimWebhookEvent, releaseWebhookEvent }, { processWebhookPayload, retryPendingWebhooks }, { MAX_ATTEMPTS }] = await Promise.all([
    import("../src/lib/db"),
    import("../src/lib/payments/fulfill"),
    import("../src/lib/competition/engine"),
    import("../src/lib/competition/season"),
    import("../src/lib/competition/standings"),
    import("../src/lib/payments/webhook-inbox"),
    import("../src/lib/payments/webhook-processing"),
    import("../src/lib/payments/webhook-policy"),
  ]);

  const marker = randomUUID();
  const capacity = Number(process.env.TEST_SEASON_CAPACITY ?? "32");
  assert.ok(Number.isInteger(capacity) && capacity >= 2);
  let userId: string | undefined;
  let seasonId: string | undefined;
  let lateSeasonId: string | undefined;

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

    assert.equal((await prisma.seasonEntry.findUniqueOrThrow({ where: { id: first.entryId } })).status, capacity === 1 ? "SURVIVOR" : "ACTIVE");
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: first.productId } })).approvalStatus, "APPROVED");
    const activeRound = await getActiveRound(season.id);
    assert.ok(activeRound);
    assert.deepEqual(await autoStartFullSeasons(), []);
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
    const crossedIdentity = await applyPaymentResult({
      kind: "succeeded",
      localPaymentId: fixtures[1]!.paymentId,
      providerPaymentId,
      eventId: `${marker}-crossed-identity`,
      amountCents: season.entryPriceCents,
      currency: "usd",
    });
    assert.deepEqual(crossedIdentity, { applied: false, reason: "payment identity mismatch" });
    assert.equal(await prisma.productRoundStats.count({ where: { roundId: activeRound.id } }), capacity);

    const webhookId = `dodo:retry-${marker}`;
    assert.equal(await claimWebhookEvent(webhookId, "dodo", "payment.succeeded", { marker }), true);
    assert.equal(await claimWebhookEvent(webhookId, "dodo", "payment.succeeded", { marker }), false);
    // A processing failure is not the end of the story: the same event id has to
    // be claimable again, by a redelivery or by the sweep.
    await prisma.webhookEvent.update({ where: { id: webhookId }, data: { status: "FAILED" } });
    assert.equal(await claimWebhookEvent(webhookId, "dodo", "payment.succeeded", { marker }), true);
    // The same is true of a message parked for review.
    await prisma.webhookEvent.update({ where: { id: webhookId }, data: { status: "NEEDS_REVIEW" } });
    assert.equal(await claimWebhookEvent(webhookId, "dodo", "payment.succeeded", { marker }), true);
    // A finished one is never reopened, and neither is one that ran out of tries.
    await prisma.webhookEvent.update({ where: { id: webhookId }, data: { status: "PROCESSED" } });
    assert.equal(await claimWebhookEvent(webhookId, "dodo", "payment.succeeded", { marker }), false);
    await prisma.webhookEvent.update({ where: { id: webhookId }, data: { status: "FAILED", attempts: MAX_ATTEMPTS } });
    assert.equal(await claimWebhookEvent(webhookId, "dodo", "payment.succeeded", { marker }), false);

    // ---------------------------------------------------------------------
    // A message that could not be settled on arrival recovers on a retry.
    //
    // This is the production failure it was written for: a webhook overtook its
    // own payment row, the handler recorded NEEDS_REVIEW, and because every
    // existing inbox row was treated as finished the entry stayed unpublished
    // forever. The retry has to reach the verdict the first delivery would
    // have, once the condition that blocked it has cleared — and it has to do
    // so without the provider redelivering anything.
    // ---------------------------------------------------------------------
    const lateSeason = await prisma.season.create({
      data: {
        number: (latestSeason._max.number ?? -1) + 2,
        name: `Retry Integration ${marker}`,
        status: "REGISTRATION_OPEN",
        capacity: 2,
        entryPriceCents: season.entryPriceCents,
        currency: "usd",
        registrationStart: new Date(Date.now() - 60_000),
        registrationEnd: new Date(Date.now() + 86_400_000),
      },
    });
    lateSeasonId = lateSeason.id;

    const lateEntries = [];
    for (let i = 0; i < 2; i++) {
      const product = await prisma.product.create({
        data: { ownerId: user.id, name: `Retry Product ${i}`, slug: `retry-test-${marker}-${i}`, url: `https://retry-${marker}-${i}.invalid/`, tagline: "Retry fixture", description: "Retry fixture only", category: i === 0 ? "DESIGN" : "ANALYTICS" },
      });
      const entry = await prisma.seasonEntry.create({
        data: { seasonId: lateSeason.id, productId: product.id, rallyCode: `retry-${marker}-${i}`, status: "AWAITING_PAYMENT" },
      });
      lateEntries.push({ productId: product.id, entryId: entry.id, paymentId: `retry-payment-${marker}-${i}` });
    }

    // The first slot is paid for normally.
    await prisma.payment.create({
      data: { id: lateEntries[0]!.paymentId, userId: user.id, seasonId: lateSeason.id, seasonEntryId: lateEntries[0]!.entryId, provider: "dev", amountCents: lateSeason.entryPriceCents, currency: "usd", status: "PENDING" },
    });
    assert.equal((await applyPaymentResult({ kind: "succeeded", localPaymentId: lateEntries[0]!.paymentId, providerPaymentId: `dev_payment_${lateEntries[0]!.paymentId}`, eventId: `retry-${marker}-paid`, amountCents: lateSeason.entryPriceCents, currency: "usd" })).applied, true);

    // Public listing filters by category, so only the matching product shows.
    assert.equal((await getPublicUpcomingEntries(lateSeason.id)).length, 1);
    assert.equal((await getPublicUpcomingEntries(lateSeason.id, "DESIGN")).length, 1);
    assert.equal((await getPublicUpcomingEntries(lateSeason.id, "ANALYTICS")).length, 0);

    // The second arrives as a webhook that overtakes its own payment row.
    const strandedEventId = `stranded-${marker}`;
    const strandedInboxId = `dev:${strandedEventId}`;
    const strandedBody = { type: "succeeded", paymentId: lateEntries[1]!.paymentId, amountCents: lateSeason.entryPriceCents, currency: "usd" };
    assert.equal(await claimWebhookEvent(strandedInboxId, "dev", "succeeded", strandedBody), true);
    const firstPass = await processWebhookPayload(strandedEventId, JSON.stringify(strandedBody));
    assert.deepEqual(firstPass, { status: "NEEDS_REVIEW", reason: "unknown payment" });
    await releaseWebhookEvent(strandedInboxId, firstPass.status, firstPass.reason);
    assert.equal((await prisma.webhookEvent.findUniqueOrThrow({ where: { id: strandedInboxId } })).status, "NEEDS_REVIEW");

    // Its backoff has not elapsed, so the sweep leaves it where it is.
    assert.deepEqual(await retryPendingWebhooks(), []);

    // The slower request finishes committing.
    await prisma.payment.create({
      data: { id: lateEntries[1]!.paymentId, userId: user.id, seasonId: lateSeason.id, seasonEntryId: lateEntries[1]!.entryId, provider: "dev", amountCents: lateSeason.entryPriceCents, currency: "usd", status: "PENDING" },
    });

    await prisma.webhookEvent.update({ where: { id: strandedInboxId }, data: { nextAttemptAt: new Date(Date.now() - 1000) } });
    assert.deepEqual(await retryPendingWebhooks(), [{ id: strandedInboxId, status: "PROCESSED" }]);

    const settled = await prisma.webhookEvent.findUniqueOrThrow({ where: { id: strandedInboxId } });
    assert.equal(settled.status, "PROCESSED");
    assert.equal(settled.nextAttemptAt, null);
    assert.equal((await prisma.payment.findUniqueOrThrow({ where: { id: lateEntries[1]!.paymentId } })).status, "SUCCEEDED");

    // Recovering that payment completed the field, so the season started itself
    // — no cron, no administrator, no provider redelivery.
    assert.equal((await prisma.season.findUniqueOrThrow({ where: { id: lateSeason.id } })).status, "RUNNING");
    for (const late of lateEntries) {
      assert.equal((await prisma.seasonEntry.findUniqueOrThrow({ where: { id: late.entryId } })).status, "FINALIST");
    }
    // Once competing, they are no longer part of the "waiting" listing.
    assert.equal((await getPublicUpcomingEntries(lateSeason.id)).length, 0);

    // Settled means settled: a redelivery of the same message changes nothing.
    assert.equal(await claimWebhookEvent(strandedInboxId, "dev", "succeeded", strandedBody), false);
    assert.deepEqual(await retryPendingWebhooks(), []);

    // ---------------------------------------------------------------------
    // The provider's word on the amount is checked against what was quoted.
    //
    // A checkout that settled for less than the season price must never
    // publish an entry, however many times it is retried — it is parked for
    // review and eventually exhausted, not quietly accepted.
    // ---------------------------------------------------------------------
    const underpaidEventId = `underpaid-${marker}`;
    const underpaidInboxId = `dev:${underpaidEventId}`;
    const underpaidBody = { type: "succeeded", paymentId: `underpaid-payment-${marker}`, amountCents: 50, currency: "usd" };
    const shortSeason = await prisma.season.findUniqueOrThrow({ where: { id: lateSeason.id } });
    const underpaidProduct = await prisma.product.create({
      data: { ownerId: user.id, name: "Underpaid Product", slug: `underpaid-${marker}`, url: `https://underpaid-${marker}.invalid/`, tagline: "Underpaid fixture", description: "Underpaid fixture only", category: "AI" },
    });
    const underpaidEntry = await prisma.seasonEntry.create({
      data: { seasonId: shortSeason.id, productId: underpaidProduct.id, rallyCode: `underpaid-${marker}`, status: "AWAITING_PAYMENT" },
    });
    await prisma.payment.create({
      data: { id: underpaidBody.paymentId, userId: user.id, seasonId: shortSeason.id, seasonEntryId: underpaidEntry.id, provider: "dev", amountCents: shortSeason.entryPriceCents, currency: "usd", status: "PENDING" },
    });
    assert.equal(await claimWebhookEvent(underpaidInboxId, "dev", "succeeded", underpaidBody), true);
    const underpaid = await processWebhookPayload(underpaidEventId, JSON.stringify(underpaidBody));
    assert.deepEqual(underpaid, { status: "NEEDS_REVIEW", reason: "financial mismatch" });
    await releaseWebhookEvent(underpaidInboxId, underpaid.status, underpaid.reason);
    assert.equal((await prisma.payment.findUniqueOrThrow({ where: { id: underpaidBody.paymentId } })).status, "PENDING");
    assert.equal((await prisma.seasonEntry.findUniqueOrThrow({ where: { id: underpaidEntry.id } })).status, "AWAITING_PAYMENT");
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: underpaidProduct.id } })).approvalStatus, "DRAFT");

    // Retrying cannot talk it into settling, and the attempts are bounded.
    for (let attempt = 0; attempt < MAX_ATTEMPTS + 2; attempt++) {
      await prisma.webhookEvent.updateMany({ where: { id: underpaidInboxId }, data: { nextAttemptAt: new Date(Date.now() - 1000) } });
      await retryPendingWebhooks();
    }
    const exhausted = await prisma.webhookEvent.findUniqueOrThrow({ where: { id: underpaidInboxId } });
    assert.equal(exhausted.status, "EXHAUSTED");
    assert.equal(exhausted.attempts, MAX_ATTEMPTS);
    assert.equal(exhausted.failureReason, "financial mismatch");
    assert.equal((await prisma.seasonEntry.findUniqueOrThrow({ where: { id: underpaidEntry.id } })).status, "AWAITING_PAYMENT");

    // ---------------------------------------------------------------------
    // A product withdrawn during a live round leaves the competition for good.
    //
    // Its figures stay on the record, but they must not be ranked against the
    // products still playing, and finalization must never write ACTIVE back
    // over a terminal status — that is how a refunded entry came back.
    // ---------------------------------------------------------------------
    const withdrawn = fixtures[1]!;
    await prisma.seasonEntry.update({ where: { id: withdrawn.entryId }, data: { status: "WITHDRAWN" } });
    // Give it figures that would win the round outright if it were ranked.
    await prisma.productRoundStats.updateMany({
      where: { roundId: activeRound.id, seasonEntryId: withdrawn.entryId },
      data: { qualifiedImpressions: 100, verifiedVisits: 100 },
    });
    await prisma.season.update({ where: { id: season.id }, data: { minSampleImpressions: 0 } });
    await prisma.round.update({ where: { id: activeRound.id }, data: { endAt: new Date(Date.now() - 1000) } });
    await advanceSeason(season.id);

    assert.equal((await prisma.seasonEntry.findUniqueOrThrow({ where: { id: withdrawn.entryId } })).status, "WITHDRAWN");
    // Not ranked: it was finalized out of the round rather than scored in it.
    const withdrawnStats = await prisma.productRoundStats.findFirstOrThrow({ where: { roundId: activeRound.id, seasonEntryId: withdrawn.entryId } });
    assert.equal(withdrawnStats.finalized, true);
    assert.equal(withdrawnStats.status, "ELIMINATED");
    assert.equal(withdrawnStats.rank, null, "a withdrawn product is never given a rank");
    // And it does not take a place in the next round.
    assert.equal(await prisma.productRoundStats.count({ where: { seasonEntryId: withdrawn.entryId, round: { roundNumber: 2 } } }), 0);
    const nextRound = await prisma.round.findFirstOrThrow({ where: { seasonId: season.id, roundNumber: 2 } });
    const advanced = await prisma.productRoundStats.findMany({ where: { roundId: nextRound.id }, select: { seasonEntryId: true } });
    assert.ok(!advanced.some(row => row.seasonEntryId === withdrawn.entryId));
    // A second pass must not resurrect it either.
    await prisma.round.update({ where: { id: nextRound.id }, data: { endAt: new Date(Date.now() - 1000) } });
    await advanceSeason(season.id);
    assert.equal((await prisma.seasonEntry.findUniqueOrThrow({ where: { id: withdrawn.entryId } })).status, "WITHDRAWN");
  } finally {
    await prisma.webhookEvent.deleteMany({ where: { id: { contains: marker } } });
    if (lateSeasonId) await prisma.season.delete({ where: { id: lateSeasonId } });
    if (seasonId) await prisma.season.delete({ where: { id: seasonId } });
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  }
});
