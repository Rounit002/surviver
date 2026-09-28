/**
 * Ranking. The whole season is one ranking window: every product stays on the
 * board and is ordered by verified clicks. Nothing is eliminated.
 *
 * Ties share a rank (1, 2, 2, 4), so two products with the same clicks are
 * never presented as one beating the other. Within a tie, rows are ordered by
 * Interest Rate and then by id only so the list is stable.
 */
export type ScoreInput = { seasonEntryId: string; qualifiedImpressions: number; verifiedVisits: number; rank: number | null };

export type Ranked<T> = Omit<T, "rank" | "prevRank" | "interestRate" | "status"> & {
  rank: number;
  prevRank: number | null;
  interestRate: number;
  status: "SAFE" | "RISING";
};

export function rankByClicks<T extends ScoreInput>(rows: T[]): Ranked<T>[] {
  const rate = (r: ScoreInput) => (r.qualifiedImpressions ? r.verifiedVisits / r.qualifiedImpressions : 0);
  const sorted = [...rows].sort(
    (a, b) => b.verifiedVisits - a.verifiedVisits || rate(b) - rate(a) || a.seasonEntryId.localeCompare(b.seasonEntryId),
  );

  let rank = 0;
  return sorted.map((row, index) => {
    if (index === 0 || row.verifiedVisits !== sorted[index - 1]!.verifiedVisits) rank = index + 1;
    const rising = row.rank !== null && rank < row.rank;
    return {
      ...row,
      rank,
      prevRank: row.rank,
      interestRate: rate(row),
      status: rising ? ("RISING" as const) : ("SAFE" as const),
    };
  });
}
