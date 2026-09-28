import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;

test("lineup clicks count once per visitor, once per network, and only for verified humans", { skip: !databaseUrl }, async () => {
  const [{ prisma }, { recordLineupClick }, { getPublicUpcomingEntries }] = await Promise.all([
    import("../src/lib/db"),
    import("../src/lib/tracking/events"),
    import("../src/lib/competition/season"),
  ]);
  const marker = randomUUID();
  let userId: string | undefined;
  let seasonId: string | undefined;
  try {
    const user = await prisma.user.create({ data: { email: `lineup-${marker}@integration.invalid`, name: "Lineup" } });
    userId = user.id;
    const latest = await prisma.season.aggregate({ _max: { number: true } });
    const season = await prisma.season.create({ data: { number: (latest._max.number ?? -1) + 1, name: `Lineup ${marker}`, status: "REGISTRATION_OPEN", capacity: 32 } });
    seasonId = season.id;
    const product = await prisma.product.create({ data: { ownerId: user.id, name: "Clicked", slug: `lineup-${marker}`, url: `https://lineup-${marker}.invalid/`, tagline: "t", description: "d", category: "AI", approvalStatus: "APPROVED" } });
    const entry = await prisma.seasonEntry.create({ data: { seasonId: season.id, productId: product.id, rallyCode: `lineup-${marker}`, status: "UPCOMING" } });
    await prisma.payment.create({ data: { userId: user.id, seasonId: season.id, seasonEntryId: entry.id, provider: "dev", amountCents: 2900, status: "SUCCEEDED" } });

    const visitor = (id: string, ip: string | null) => ({ visitorId: id, sessionId: `s-${id}`, rallyCode: null, userAgent: "Mozilla/5.0", ipHash: ip, human: true });

    assert.equal(await recordLineupClick(entry.id, visitor("a".repeat(32), "net-1")), true);
    assert.equal(await recordLineupClick(entry.id, visitor("a".repeat(32), "net-2")), false, "same visitor twice");
    assert.equal(await recordLineupClick(entry.id, visitor("b".repeat(32), "net-1")), false, "same network, new cookie");
    assert.equal(await recordLineupClick(entry.id, visitor("c".repeat(32), "net-3")), true);
    assert.equal(await recordLineupClick(entry.id, visitor("anonymous", "net-4")), false, "no cookie never counts");
    assert.equal(await recordLineupClick(entry.id, { ...visitor("d".repeat(32), "net-5"), userAgent: "HeadlessChrome" }), false, "bots never count");
    assert.equal(await recordLineupClick(entry.id, { ...visitor("e".repeat(32), "net-6"), human: false }), false, "no human pass, no click");
    assert.equal(await recordLineupClick(entry.id, visitor("f".repeat(32), null)), false, "an unknown network cannot be held to one click");

    const [listed] = await getPublicUpcomingEntries(season.id);
    assert.equal(listed?._count.lineupClicks, 2);
    // Lineup clicks never become competition score.
    assert.equal(await prisma.productRoundStats.count({ where: { seasonEntryId: entry.id } }), 0);
  } finally {
    if (seasonId) await prisma.season.delete({ where: { id: seasonId } });
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  }
});
