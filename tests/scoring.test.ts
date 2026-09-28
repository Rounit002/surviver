import assert from "node:assert/strict";
import test from "node:test";
import { rankByClicks } from "../src/lib/competition/scoring";

test("ranks every product by clicks and never cuts anyone", () => {
  const ranked = rankByClicks([
    { seasonEntryId: "b", qualifiedImpressions: 200, verifiedVisits: 50, rank: 2 },
    { seasonEntryId: "a", qualifiedImpressions: 900, verifiedVisits: 70, rank: 1 },
    { seasonEntryId: "c", qualifiedImpressions: 20, verifiedVisits: 0, rank: null },
  ]);

  assert.deepEqual(ranked.map(row => [row.seasonEntryId, row.rank]), [
    ["a", 1],
    ["b", 2],
    ["c", 3],
  ]);
  // Nothing is ever put in an elimination state.
  assert.ok(ranked.every(row => row.status === "SAFE" || row.status === "RISING"));
});

test("equal clicks share a rank, ordered by interest rate then identity", () => {
  const ranked = rankByClicks([
    { seasonEntryId: "z", qualifiedImpressions: 100, verifiedVisits: 10, rank: null },
    { seasonEntryId: "b", qualifiedImpressions: 400, verifiedVisits: 20, rank: null },
    { seasonEntryId: "a", qualifiedImpressions: 200, verifiedVisits: 20, rank: null },
    { seasonEntryId: "y", qualifiedImpressions: 200, verifiedVisits: 20, rank: null },
  ]);
  assert.deepEqual(ranked.map(row => [row.seasonEntryId, row.rank]), [
    ["a", 1],
    ["y", 1],
    ["b", 1],
    ["z", 4],
  ]);
});

test("a product that climbs is marked rising", () => {
  const ranked = rankByClicks([
    { seasonEntryId: "a", qualifiedImpressions: 10, verifiedVisits: 5, rank: 1 },
    { seasonEntryId: "b", qualifiedImpressions: 10, verifiedVisits: 6, rank: 2 },
  ]);
  assert.equal(ranked.find(row => row.seasonEntryId === "b")?.status, "RISING");
  assert.equal(ranked.find(row => row.seasonEntryId === "a")?.status, "SAFE");
});
