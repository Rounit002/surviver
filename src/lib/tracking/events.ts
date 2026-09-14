import "server-only";
import type { SourceType } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { lockSeason, refreshRanks } from "@/lib/competition/engine";
import { isScorable, type VisitorContext } from "./visitor";

export async function recordInteraction(entryId: string, visitor: VisitorContext, kind: "impression" | "visit", dwellMs = 0) {
  if (!isScorable(visitor) || /bot|crawler|spider|headless/i.test(visitor.userAgent ?? "")) return false;
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
      const impression = await tx.impressionEvent.findFirst({ where: { roundId: round.id, seasonEntryId: entryId, visitorId: visitor.visitorId, qualified: true } });
      if (!impression) return false;
      const duplicate = await tx.clickEvent.findFirst({ where: { roundId: round.id, seasonEntryId: entryId, visitorId: visitor.visitorId, qualifiesForScore: true } });
      if (duplicate) return false;
      await tx.clickEvent.create({ data: { ...common, qualifiesForScore: true } });
      await tx.productRoundStats.update({ where: { id: stats.id }, data: { verifiedVisits: { increment: 1 }, ...(sourceType === "DISCOVERY" ? { discoveryVisits: { increment: 1 } } : { rallyVisits: { increment: 1 } }) } });
    }
    await refreshRanks(tx, round.id, entry.season.minSampleImpressions, round.eliminationCount);
    return true;
  }, { timeout: 20000 });
}
