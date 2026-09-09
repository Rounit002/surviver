import "server-only";

import { prisma } from "@/lib/db";
import type { CompetitiveStatus, ProductCategory, Round, Season } from "@/generated/prisma";

export type StandingRow = {
  entryId: string;
  rank: number | null;
  prevRank: number | null;
  status: CompetitiveStatus;
  interestRate: number;
  qualifiedImpressions: number;
  verifiedVisits: number;
  rallyPoints: number;
  /** True until the product has enough sample for a stable rank (PRD 11). */
  collecting: boolean;
  product: {
    id: string;
    name: string;
    slug: string;
    url: string;
    tagline: string;
    description: string;
    category: ProductCategory;
    logoUrl: string | null;
    coverUrl: string | null;
  };
  founder: { name: string; xHandle: string | null };
};

export type Standings = {
  season: Season;
  round: Round | null;
  rows: StandingRow[];
  /** Rank at and below which a product would currently be eliminated. */
  cutLineRank: number | null;
  eliminationCount: number;
  survivorCount: number;
};

/**
 * Current standings for a round. Rows come back in rank order; the board
 * reorders them for display so performance never drives exposure.
 */
export async function getStandings(
  season: Season,
  round: Round | null,
): Promise<Standings> {
  if (!round) {
    return {
      season,
      round: null,
      rows: [],
      cutLineRank: null,
      eliminationCount: 0,
      survivorCount: 0,
    };
  }

  const stats = await prisma.productRoundStats.findMany({
    where: { roundId: round.id, entry: { product: { approvalStatus: "APPROVED" }, status: { in: ["ACTIVE", "FINALIST", "ELIMINATED", "SURVIVOR"] } } },
    orderBy: [{ rank: "asc" }],
    include: {
      entry: {
        include: {
          product: { include: { owner: { select: { name: true, xHandle: true } } } },
        },
      },
    },
  });

  const rows: StandingRow[] = stats.map((s) => ({
    entryId: s.seasonEntryId,
    rank: s.rank,
    prevRank: s.prevRank,
    status: s.status,
    interestRate: s.interestRate,
    qualifiedImpressions: s.qualifiedImpressions,
    verifiedVisits: s.verifiedVisits,
    rallyPoints: s.rallyPoints,
    collecting: s.qualifiedImpressions < season.minSampleImpressions,
    product: {
      id: s.entry.product.id,
      name: s.entry.product.name,
      slug: s.entry.product.slug,
      url: s.entry.product.url,
      tagline: s.entry.product.tagline,
      description: s.entry.product.description,
      category: s.entry.product.category,
      logoUrl: s.entry.product.logoUrl,
      coverUrl: s.entry.product.coverUrl,
    },
    founder: {
      name: s.entry.product.owner.name,
      xHandle: s.entry.product.owner.xHandle,
    },
  }));

  const survivorCount = Math.max(0, rows.length - round.eliminationCount);

  return {
    season,
    round,
    rows,
    cutLineRank: rows.length > 0 ? survivorCount : null,
    eliminationCount: round.eliminationCount,
    survivorCount,
  };
}

/**
 * Deterministic shuffle.
 *
 * The board must not be ordered by performance (PRD 12). Seeding from the
 * visitor keeps the order stable while they scroll and across a refresh within
 * the same session, but different between visitors, so no product owns the top
 * slot. Proper exposure balancing replaces this in Phase 4.
 */
export function shuffleForVisitor<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  const next = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return (h >>> 0) / 2 ** 32;
  };

  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Movement since the last snapshot, for the leaderboard arrows. */
export function rankMovement(row: StandingRow): number | null {
  if (row.rank === null || row.prevRank === null) return null;
  const delta = row.prevRank - row.rank;
  return delta === 0 ? null : delta;
}

/** Prefer underexposed entries, with a bounded Rally boost; random ties per visitor. */
export function balanceForVisitor(rows: StandingRow[], seed: string, season: Season): StandingRow[] {
  return shuffleForVisitor(rows, seed).sort((a, b) => {
    const weight = (r: StandingRow) => r.qualifiedImpressions / (1 + Math.min(season.rallyBonusCap, Math.floor(r.rallyPoints / Math.max(1, season.rallyPointsPerStep)) * season.rallyBonusPerStep));
    return weight(a) - weight(b);
  });
}
