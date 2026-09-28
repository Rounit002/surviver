import "server-only";
import type { SourceType } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { lockSeason, refreshRanks } from "@/lib/competition/engine";
import { canCountClicks, type VisitorContext } from "./visitor";

/**
 * Count a click on a product that is in the lineup but not yet competing.
 *
 * Shown publicly as that product's clicks, so it gets the same guards as a
 * scored click: a verified human, no bot user agent, once per visitor, and
 * once per network for the season. It never touches the ranking.
 */
export async function recordLineupClick(entryId: string, visitor: VisitorContext): Promise<boolean> {
  if (!canCountClicks(visitor)) return false;
  if (visitor.ipHash) {
    const sameNetwork = await prisma.lineupClick.findFirst({
      where: { seasonEntryId: entryId, ipHash: visitor.ipHash },
      select: { id: true },
    });
    if (sameNetwork) return false;
  }
  const created = await prisma.lineupClick.createMany({
    data: [{ seasonEntryId: entryId, visitorId: visitor.visitorId, ipHash: visitor.ipHash }],
    skipDuplicates: true,
  });
  return created.count === 1;
}


export async function recordInteraction(entryId: string, visitor: VisitorContext, kind: "impression" | "visit", dwellMs = 0) {
  // Views and clicks both feed the board, so both need a counted visitor.
  if (!canCountClicks(visitor)) return false;
  const identity = await prisma.seasonEntry.findUnique({ where: { id: entryId }, select: { seasonId: true } });
  if (!identity) return false;
  return prisma.$transaction(async tx => {
    await lockSeason(tx, identity.seasonId);
    const entry = await tx.seasonEntry.findUnique({ where: { id: entryId }, include: { product: true, season: true } });
    if (!entry || !["ACTIVE", "FINALIST"].includes(entry.status) || entry.product.approvalStatus !== "APPROVED" || entry.season.status !== "RUNNING") return false;
    const now = new Date();
    const round = await tx.round.findFirst({ where: { seasonId: entry.seasonId, status: "ACTIVE", startAt: { lte: now }, endAt: { gt: now } } });
    if (!round) return false;
    const stats = await tx.productRoundStats.findUnique({ where: { roundId_seasonEntryId: { roundId: round.id, seasonEntryId: entryId } } });
    if (!stats || stats.finalized) return false;
    const sourceType: SourceType = visitor.rallyCode === entry.rallyCode ? "RALLY_SELF" : visitor.rallyCode ? "RALLY" : "DISCOVERY";
    if (sourceType === "RALLY_SELF") return false;
    const common = { seasonEntryId: entryId, roundId: round.id, visitorId: visitor.visitorId, sessionId: visitor.sessionId, sourceType, userAgent: visitor.userAgent?.slice(0, 512), ipHash: visitor.ipHash };
    if (visitor.ipHash) {
      const recentIdentities = await tx.impressionEvent.findMany({ where: { roundId: round.id, ipHash: visitor.ipHash, createdAt: { gte: new Date(now.getTime() - 60 * 60_000) } }, distinct: ["visitorId"], take: 11, select: { visitorId: true } });
      if (recentIdentities.length >= 10) {
        await tx.productRoundStats.update({ where: { id: stats.id }, data: { suspiciousEvents: { increment: 1 } } });
        return false;
      }
    }
    if (kind === "impression") {
      if (dwellMs < 1000 || !Number.isFinite(dwellMs)) return false;
      const previous = await tx.impressionEvent.findFirst({ where: { roundId: round.id, seasonEntryId: entryId, visitorId: visitor.visitorId, qualified: true, createdAt: { gte: new Date(now.getTime() - entry.season.impressionDedupSec * 1000) } } });
      if (previous) return false;
      await tx.impressionEvent.create({ data: { ...common, dwellMs: Math.min(60000, Math.floor(dwellMs)), qualified: true } });
      await tx.productRoundStats.update({ where: { id: stats.id }, data: { qualifiedImpressions: { increment: 1 } } });
      if (visitor.rallyCode) {
        const referring = await tx.seasonEntry.findUnique({ where: { rallyCode: visitor.rallyCode } });
        if (referring && referring.seasonId === entry.seasonId && ["ACTIVE", "FINALIST"].includes(referring.status)) {
          const seen = await tx.impressionEvent.findMany({ where: { roundId: round.id, visitorId: visitor.visitorId, qualified: true, seasonEntryId: { not: referring.id } }, distinct: ["seasonEntryId"], select: { seasonEntryId: true } });
          const rally = await tx.rallyVisitor.upsert({ where: { referringEntryId_visitorId: { referringEntryId: referring.id, visitorId: visitor.visitorId } }, create: { referringEntryId: referring.id, visitorId: visitor.visitorId, roundId: round.id }, update: {} });
          if (rally.roundId !== round.id) await tx.rallyVisitor.update({ where: { id: rally.id }, data: { roundId: round.id, qualified: false, qualifiedAt: null, pointsAwarded: 0, otherProductsSeen: 0 } });
          const qualified = seen.length >= 2;
          if (qualified && (!rally.qualified || rally.roundId !== round.id)) {
            await tx.rallyVisitor.update({ where: { id: rally.id }, data: { qualified: true, qualifiedAt: now, pointsAwarded: 1, otherProductsSeen: seen.length } });
            await tx.productRoundStats.updateMany({ where: { roundId: round.id, seasonEntryId: referring.id, finalized: false }, data: { rallyPoints: { increment: 1 } } });
          }
        }
      }
    } else {
      // A click only scores after this visitor was actually shown the card.
      const impression = await tx.impressionEvent.findFirst({ where: { roundId: round.id, seasonEntryId: entryId, visitorId: visitor.visitorId, qualified: true } });
      if (!impression) return false;
      // Clicks decide the ranking, so each one is guarded twice: once per
      // visitor cookie and once per network (IP, or IPv6 /64), both for the
      // whole season. The second stops a script that clears cookies between
      // clicks from minting a fresh "visitor" each time.
      const duplicate = await tx.clickEvent.findFirst({ where: { roundId: round.id, seasonEntryId: entryId, visitorId: visitor.visitorId, qualifiesForScore: true } });
      if (duplicate) return false;
      const sameNetwork = await tx.clickEvent.findFirst({ where: { roundId: round.id, seasonEntryId: entryId, ipHash: visitor.ipHash, qualifiesForScore: true } });
      if (sameNetwork) {
        await tx.clickEvent.create({ data: { ...common, qualifiesForScore: false, suspicious: true } });
        await tx.productRoundStats.update({ where: { id: stats.id }, data: { suspiciousEvents: { increment: 1 } } });
        return false;
      }
      await tx.clickEvent.create({ data: { ...common, qualifiesForScore: true } });
      await tx.productRoundStats.update({ where: { id: stats.id }, data: { verifiedVisits: { increment: 1 }, ...(sourceType === "DISCOVERY" ? { discoveryVisits: { increment: 1 } } : { rallyVisits: { increment: 1 } }) } });
    }
    await refreshRanks(tx, round.id);
    return true;
  }, { timeout: 20000 });
}
