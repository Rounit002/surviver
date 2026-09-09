export type ScoreInput = { seasonEntryId: string; qualifiedImpressions: number; verifiedVisits: number; rank: number | null };
export function rankScores<T extends ScoreInput>(rows: T[], minimum: number, eliminate: number) {
  const sorted = [...rows].sort((a, b) => {
    const eligibleA = a.qualifiedImpressions >= minimum, eligibleB = b.qualifiedImpressions >= minimum;
    if (eligibleA !== eligibleB) return eligibleA ? -1 : 1;
    const rateA = a.qualifiedImpressions ? a.verifiedVisits / a.qualifiedImpressions : 0;
    const rateB = b.qualifiedImpressions ? b.verifiedVisits / b.qualifiedImpressions : 0;
    return rateB - rateA || b.verifiedVisits - a.verifiedVisits || a.seasonEntryId.localeCompare(b.seasonEntryId);
  });
  const safeCount = Math.max(1, sorted.length - eliminate);
  const dangerSlots = Math.min(3, Math.max(1, Math.round(safeCount * 0.15)));
  const dangerStart = safeCount - dangerSlots;
  return sorted.map((row, index) => {
    const collecting = row.qualifiedImpressions < minimum;
    const rank = collecting ? null : index + 1;
    const status = collecting ? "COLLECTING_DATA" as const : index >= safeCount ? "ELIMINATION_ZONE" as const : index >= dangerStart ? "DANGER" as const : "SAFE" as const;
    return { ...row, rank, prevRank: row.rank, interestRate: row.qualifiedImpressions ? row.verifiedVisits / row.qualifiedImpressions : 0, status };
  });
}

export function eliminationFor(count: number): number {
  if (count <= 1) return 0;
  return count > 16 ? Math.min(8, count - 16) : count > 8 ? count - 8 : Math.floor(count / 2);
}
