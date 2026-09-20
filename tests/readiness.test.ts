import assert from "node:assert/strict";
import test from "node:test";
import { evaluateStartReadiness, type StartCounts } from "../src/lib/competition/readiness";

/** A complete 32-product field, ready to play. */
function counts(overrides: Partial<StartCounts> = {}): StartCounts {
  return { status: "REGISTRATION_OPEN", capacity: 32, claimed: 32, ready: 32, ...overrides };
}

test("starts only when every spot is filled and paid", () => {
  const readiness = evaluateStartReadiness(counts());
  assert.equal(readiness.canStart, true);
  assert.equal(readiness.blockedReason, null);
  assert.equal(readiness.isFull, true);
  assert.equal(readiness.remaining, 0);
});

test("holds a season that is one or two spots short", () => {
  for (const claimed of [33, 34]) {
    const readiness = evaluateStartReadiness(counts({ claimed, ready: claimed }));
    assert.equal(readiness.canStart, false, `${claimed} claimed must not start`);
    assert.equal(readiness.isFull, false);
    assert.equal(readiness.remaining, 32 - claimed);
    assert.match(readiness.blockedReason ?? "", new RegExp(`^${32 - claimed} of 32 spots are still open`));
  }
});

test("refuses a full field holding a slot that never became startable", () => {
  // A refund mid-flight, or a row left over from the old manual review stage:
  // it still holds capacity, so starting here would field 31 in a 32 bracket.
  const readiness = evaluateStartReadiness(counts({ ready: 31 }));
  assert.equal(readiness.canStart, false);
  assert.equal(readiness.isFull, true);
  assert.equal(readiness.blockedReason, "Only 31 of 32 entries are approved and paid.");
});

test("refuses seasons that are not in a startable state", () => {
  for (const status of ["DRAFT", "RUNNING", "COMPLETED", "CANCELLED"] as const) {
    const readiness = evaluateStartReadiness(counts({ status }));
    assert.equal(readiness.canStart, false, `${status} must not start`);
    assert.equal(readiness.blockedReason, "This season cannot be started.");
  }
  assert.equal(evaluateStartReadiness(counts({ status: "REGISTRATION_CLOSED" })).canStart, true);
});

test("an empty season is never full", () => {
  const readiness = evaluateStartReadiness(counts({ capacity: 0, claimed: 0, ready: 0 }));
  assert.equal(readiness.isFull, false);
  assert.equal(readiness.canStart, false);
});
