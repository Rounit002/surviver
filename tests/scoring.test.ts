import assert from "node:assert/strict";
import test from "node:test";
import { eliminationFor, rankScores } from "../src/lib/competition/scoring";

test("ranks eligible products by interest rate and keeps low samples unranked", () => {
  const ranked = rankScores([
    { seasonEntryId: "b", qualifiedImpressions: 200, verifiedVisits: 50, rank: 2 },
    { seasonEntryId: "a", qualifiedImpressions: 100, verifiedVisits: 30, rank: 1 },
    { seasonEntryId: "c", qualifiedImpressions: 20, verifiedVisits: 20, rank: null },
  ], 100, 1);

  assert.deepEqual(ranked.map(row => [row.seasonEntryId, row.rank, row.status]), [
    ["a", 1, "SAFE"],
    ["b", 2, "DANGER"],
    ["c", null, "COLLECTING_DATA"],
  ]);
});

test("uses verified visits and stable identity to resolve equal rates", () => {
  const ranked = rankScores([
    { seasonEntryId: "z", qualifiedImpressions: 100, verifiedVisits: 10, rank: null },
    { seasonEntryId: "a", qualifiedImpressions: 200, verifiedVisits: 20, rank: null },
    { seasonEntryId: "b", qualifiedImpressions: 200, verifiedVisits: 20, rank: null },
  ], 50, 1);
  assert.deepEqual(ranked.map(row => row.seasonEntryId), ["a", "b", "z"]);
});

test("adjusts elimination counts for smaller live fields", () => {
  assert.equal(eliminationFor(32), 8);
  assert.equal(eliminationFor(35), 8);
  assert.equal(eliminationFor(24), 8);
  assert.equal(eliminationFor(16), 8);
  assert.equal(eliminationFor(8), 4);
  assert.equal(eliminationFor(2), 1);
  assert.equal(eliminationFor(1), 0);
});
