import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;

/**
 * A URL is held by a live entry, and by a checkout that can still be paid —
 * but not by one that can no longer be reached.
 *
 * The capability that opens a checkout lives two hours. Before this was true,
 * a founder who closed the tab could never enter that address again: the
 * pending row blocked it forever, their cookie had expired, and the retention
 * sweep only released checkouts a provider had explicitly cancelled, which
 * nothing ever records.
 */
test("an unreachable checkout stops holding its product URL", { skip: !databaseUrl }, async () => {
  const [{ prisma }, { blockingEntryFilter }, { runRetention }] = await Promise.all([
    import("../src/lib/db"),
    import("../src/lib/competition/season"),
    import("../src/lib/security/retention"),
  ]);

  const marker = randomUUID();
  const url = `https://abandoned-${marker}.invalid/`;
  let userId: string | undefined;
  let seasonId: string | undefined;

  try {
    const user = await prisma.user.create({
      data: { email: `entry-availability-${marker}@integration.invalid`, name: "Integration Test" },
    });
    userId = user.id;
    const latest = await prisma.season.aggregate({ _max: { number: true } });
    const season = await prisma.season.create({
      data: {
        number: (latest._max.number ?? -1) + 1,
        name: `Entry Availability ${marker}`,
        status: "REGISTRATION_OPEN",
        capacity: 35,
        entryPriceCents: 2900,
        currency: "usd",
        registrationStart: new Date(Date.now() - 60_000),
        registrationEnd: new Date(Date.now() + 86_400_000),
      },
    });
    seasonId = season.id;

    const product = await prisma.product.create({
      data: { ownerId: user.id, name: "Abandoned", slug: `abandoned-${marker}`, url, tagline: "Fixture", description: "Fixture only", category: "AI" },
    });
    const entry = await prisma.seasonEntry.create({
      data: { seasonId: season.id, productId: product.id, rallyCode: `abandoned-${marker}`, status: "AWAITING_PAYMENT", manageToken: `manage-${marker}`, manageTokenExpiresAt: new Date(Date.now() + 86_400_000) },
    });
    const payment = await prisma.payment.create({
      data: { userId: user.id, seasonId: season.id, seasonEntryId: entry.id, provider: "dev", amountCents: 2900, currency: "usd", status: "PENDING", checkoutTokenHash: `hash-${marker}`, checkoutTokenExpiresAt: new Date(Date.now() + 2 * 60 * 60_000) },
    });

    // While the checkout is live, the address is taken.
    assert.ok(await prisma.seasonEntry.findFirst({ where: blockingEntryFilter(season.id, url) }), "a checkout in flight holds its URL");

    // Once the capability has lapsed, nobody can reach that checkout again.
    await prisma.payment.update({ where: { id: payment.id }, data: { checkoutTokenExpiresAt: new Date(Date.now() - 1000) } });
    assert.equal(await prisma.seasonEntry.findFirst({ where: blockingEntryFilter(season.id, url) }), null, "an unreachable checkout releases its URL");

    // A paid entry holds it whatever the capability says.
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED", checkoutTokenHash: null, checkoutTokenExpiresAt: null } });
    await prisma.seasonEntry.update({ where: { id: entry.id }, data: { status: "UPCOMING" } });
    assert.ok(await prisma.seasonEntry.findFirst({ where: blockingEntryFilter(season.id, url) }), "a paid entry holds its URL");

    // And the sweep writes the abandoned row off rather than leaving it
    // pending forever — but only once its capability is a day stale, and never
    // while the provider has named a payment for it.
    await prisma.seasonEntry.update({ where: { id: entry.id }, data: { status: "AWAITING_PAYMENT" } });
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "PENDING", providerPaymentId: `pay-${marker}`, checkoutTokenExpiresAt: new Date(Date.now() - 48 * 60 * 60_000) } });
    await runRetention();
    assert.equal((await prisma.seasonEntry.findUniqueOrThrow({ where: { id: entry.id } })).status, "AWAITING_PAYMENT", "a checkout the provider has named is never swept");

    await prisma.payment.update({ where: { id: payment.id }, data: { providerPaymentId: null } });
    await runRetention();
    const swept = await prisma.seasonEntry.findUniqueOrThrow({ where: { id: entry.id } });
    assert.equal(swept.status, "WITHDRAWN");
    assert.ok(swept.manageTokenRevokedAt, "the campaign capability is revoked with it");
  } finally {
    if (seasonId) await prisma.season.delete({ where: { id: seasonId } });
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  }
});
