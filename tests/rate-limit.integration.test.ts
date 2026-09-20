import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;

test("distributed request limits increment atomically and reset at the window boundary", { skip: !databaseUrl }, async () => {
  const { consumeLimit } = await import("../src/lib/security/rate-limit");
  const scope = `integration-${randomUUID()}`;
  const now = new Date("2026-09-20T12:00:00.000Z");

  assert.deepEqual(await consumeLimit(scope, "203.0.113.9", 2, 60_000, now), {
    allowed: true,
    retryAfterSeconds: 60,
  });
  assert.equal((await consumeLimit(scope, "203.0.113.9", 2, 60_000, now)).allowed, true);
  assert.equal((await consumeLimit(scope, "203.0.113.9", 2, 60_000, now)).allowed, false);

  const nextWindow = new Date(now.getTime() + 60_001);
  assert.equal((await consumeLimit(scope, "203.0.113.9", 2, 60_000, nextWindow)).allowed, true);

  const concurrent = await Promise.all(
    Array.from({ length: 12 }, () => consumeLimit(`${scope}-parallel`, "203.0.113.10", 3, 60_000, now)),
  );
  assert.equal(concurrent.filter((result) => result.allowed).length, 3);
});
