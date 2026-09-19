import assert from "node:assert/strict";
import test from "node:test";

import { safeNextPath } from "../src/lib/auth/redirects";
import { BCRYPT_MAX_BYTES, hashPassword, passwordFitsBcrypt, verifyPassword } from "../src/lib/auth/password";
import { normalizeUrl, UnsafeUrlError } from "../src/lib/products/site-metadata";
import { hasCheckoutCapability } from "../src/lib/payments/access";
import { hashCapability, createInteractionProof, verifyInteractionProof, signValue, verifySignedValue } from "../src/lib/security/tokens";
import { parseSeasonNumber, PUBLIC_SEASON_STATUSES } from "../src/lib/competition/constants";
import { getPaymentProvider, isDevPayments } from "../src/lib/payments";

/**
 * Security regression suite (audit F17).
 *
 * These cover the specific behaviours the audit asked to be proved, so a later
 * refactor that quietly reopens one of them fails here rather than in
 * production. Anything needing a live database or provider belongs in a
 * separate integration suite.
 */

/**
 * Next types `NODE_ENV` as read-only, but these tests need to drive it
 * deliberately to prove the production guards. Writes go through an untyped
 * view and are always restored.
 */
const mutableEnv = process.env as Record<string, string | undefined>;

/* -------------------------------------------------------------------------- */
/* F12 — post-authentication redirects                                        */
/* -------------------------------------------------------------------------- */

test("redirect targets cannot escape the site", () => {
  for (const hostile of [
    "//evil.invalid",
    "/\\evil.invalid",
    "https://evil.invalid",
    "http://evil.invalid",
    "javascript:alert(1)",
    // Normalizes to the path "//evil.invalid", which a browser reads as a
    // scheme-relative URL. Checking only the raw input misses this.
    "/..//evil.invalid",
    "/../..//evil.invalid",
    "/\tevil.invalid",
    "/\r\nevil.invalid",
    "/\u0000evil.invalid",
    "\\\\evil.invalid",
    "",
    `/${"a".repeat(2000)}`,
  ]) {
    assert.equal(safeNextPath(hostile), "/dashboard", `should reject ${JSON.stringify(hostile)}`);
  }
});

test("redirect targets keep ordinary internal destinations", () => {
  assert.equal(safeNextPath("/dashboard"), "/dashboard");
  assert.equal(safeNextPath("/enter"), "/enter");
  assert.equal(safeNextPath("/seasons/0?tab=standings"), "/seasons/0?tab=standings");
  assert.equal(safeNextPath("/board#top"), "/board#top");
});

test("redirect targets reject non-string input", () => {
  assert.equal(safeNextPath(null), "/dashboard");
  assert.equal(safeNextPath(undefined), "/dashboard");
  assert.equal(safeNextPath(42), "/dashboard");
});

/* -------------------------------------------------------------------------- */
/* F12 — bcrypt byte boundary                                                 */
/* -------------------------------------------------------------------------- */

test("passwords are bounded by bcrypt's 72-byte limit", async () => {
  const atLimit = "a".repeat(BCRYPT_MAX_BYTES);
  const overLimit = `${atLimit}b`;

  assert.equal(passwordFitsBcrypt(atLimit), true);
  assert.equal(passwordFitsBcrypt(overLimit), false);
  // Multi-byte characters count as bytes, not code points.
  assert.equal(passwordFitsBcrypt("é".repeat(37)), false);

  await assert.rejects(() => hashPassword(overLimit));
});

test("a differing suffix past 72 bytes cannot authenticate", async () => {
  const base = "a".repeat(BCRYPT_MAX_BYTES);
  const hash = await hashPassword(base);

  assert.equal(await verifyPassword(base, hash), true);
  // bcrypt itself would silently accept this; the byte check must reject it.
  assert.equal(await verifyPassword(`${base}DIFFERENT`, hash), false);
});

test("submitted URLs are restricted to plain web addresses", () => {
  for (const hostile of [
    "file:///etc/passwd",
    "gopher://example.com",
    "ftp://example.com",
    "https://user:pass@example.com",
    "https://example.com:22",
    "https://nodot",
  ]) {
    assert.throws(() => normalizeUrl(hostile), UnsafeUrlError, `should reject ${hostile}`);
  }

  assert.equal(normalizeUrl("example.com"), "https://example.com/");
  assert.equal(normalizeUrl("https://example.com/a?b=1#c"), "https://example.com/a?b=1");
  assert.equal(normalizeUrl("http://127.0.0.1"), "http://127.0.0.1/");
  assert.equal(normalizeUrl("http://[::1]"), "http://[::1]/");
});

/* -------------------------------------------------------------------------- */
/* F03 — checkout capability                                                  */
/* -------------------------------------------------------------------------- */

test("checkout access needs the real capability, not a known payment id", () => {
  const token = "checkout-capability-token-value";
  const future = new Date(Date.now() + 60_000);
  const payment = { checkoutTokenHash: hashCapability(token), checkoutTokenExpiresAt: future };

  assert.equal(hasCheckoutCapability(token, payment), true);

  // Knowing the payment id, or guessing, must not be enough.
  assert.equal(hasCheckoutCapability("some-other-payment-id", payment), false);
  assert.equal(hasCheckoutCapability(undefined, payment), false);
  assert.equal(hasCheckoutCapability("", payment), false);
  assert.equal(hasCheckoutCapability("x".repeat(200), payment), false);

  // Expired, revoked, or never issued.
  assert.equal(hasCheckoutCapability(token, { ...payment, checkoutTokenExpiresAt: new Date(Date.now() - 1000) }), false);
  assert.equal(hasCheckoutCapability(token, { ...payment, checkoutTokenHash: null }), false);
  assert.equal(hasCheckoutCapability(token, { ...payment, checkoutTokenExpiresAt: null }), false);
});

/* -------------------------------------------------------------------------- */
/* F06 — interaction proofs and signed identities                             */
/* -------------------------------------------------------------------------- */

test("interaction proofs are bound to one entry and one visitor", () => {
  const identity = { visitorId: "v".repeat(32), sessionId: "s".repeat(32) };
  const proof = createInteractionProof("entry-1", identity);

  assert.equal(verifyInteractionProof(proof, "entry-1", identity), true);

  // Replaying another product's proof must not score.
  assert.equal(verifyInteractionProof(proof, "entry-2", identity), false);
  // Rotating to a fresh identity must not carry the proof along.
  assert.equal(verifyInteractionProof(proof, "entry-1", { ...identity, visitorId: "w".repeat(32) }), false);
  assert.equal(verifyInteractionProof(proof, "entry-1", { ...identity, sessionId: "t".repeat(32) }), false);
  // Forged and malformed proofs.
  assert.equal(verifyInteractionProof(undefined, "entry-1", identity), false);
  assert.equal(verifyInteractionProof("not.a.proof", "entry-1", identity), false);
  assert.equal(verifyInteractionProof(`${proof}tampered`, "entry-1", identity), false);
});

test("signed cookie values reject tampering", () => {
  const signed = signValue("abcdef0123456789abcdef0123456789");
  const pattern = /^[a-f0-9]{32}$/;

  assert.equal(verifySignedValue(signed, pattern), "abcdef0123456789abcdef0123456789");

  // A fabricated value with no signature, or a signature moved onto another
  // value, must not be accepted.
  assert.equal(verifySignedValue("abcdef0123456789abcdef0123456789", pattern), null);
  assert.equal(verifySignedValue(`ffffffffffffffffffffffffffffffff.${signed.split(".")[1]}`, pattern), null);
  assert.equal(verifySignedValue(signed.replace(/.$/, "A"), pattern), null);
  assert.equal(verifySignedValue(undefined, pattern), null);
  // Values that do not match the expected shape are rejected before comparison.
  assert.equal(verifySignedValue(signValue("NOT-HEX"), pattern), null);
});

/* -------------------------------------------------------------------------- */
/* F02 — the payment simulator must fail closed in production                 */
/* -------------------------------------------------------------------------- */

test("simulated payments are impossible in production", () => {
  const { NODE_ENV, PAYMENT_PROVIDER } = process.env;
  const restore = (key: "NODE_ENV" | "PAYMENT_PROVIDER", value: string | undefined) => {
    if (value === undefined) delete mutableEnv[key];
    else mutableEnv[key] = value;
  };

  try {
    // The environment is read lazily on every call, so setting it here is
    // enough: a production deployment left on the dev provider must refuse to
    // hand out a provider at all rather than simulate a successful payment.
    mutableEnv.NODE_ENV = "production";
    mutableEnv.PAYMENT_PROVIDER = "dev";
    assert.equal(isDevPayments(), false);
    assert.throws(() => getPaymentProvider(), /disabled in production/);

    // A missing provider setting must fail closed the same way.
    delete mutableEnv.PAYMENT_PROVIDER;
    assert.equal(isDevPayments(), false);
    assert.throws(() => getPaymentProvider(), /disabled in production/);
  } finally {
    restore("NODE_ENV", NODE_ENV);
    restore("PAYMENT_PROVIDER", PAYMENT_PROVIDER);
  }
});

test("the simulator is still available outside production", () => {
  const { NODE_ENV, PAYMENT_PROVIDER } = process.env;
  try {
    mutableEnv.NODE_ENV = "development";
    mutableEnv.PAYMENT_PROVIDER = "dev";
    assert.equal(isDevPayments(), true);
    assert.equal(getPaymentProvider().name, "dev");
  } finally {
    if (NODE_ENV === undefined) delete mutableEnv.NODE_ENV;
    else mutableEnv.NODE_ENV = NODE_ENV;
    if (PAYMENT_PROVIDER === undefined) delete mutableEnv.PAYMENT_PROVIDER;
    else mutableEnv.PAYMENT_PROVIDER = PAYMENT_PROVIDER;
  }
});

/* -------------------------------------------------------------------------- */
/* Input bounds and public catalog                                            */
/* -------------------------------------------------------------------------- */

test("season numbers stay inside the database's integer range", () => {
  assert.equal(parseSeasonNumber("0"), 0);
  assert.equal(parseSeasonNumber("7"), 7);
  assert.equal(parseSeasonNumber("2147483647"), 2147483647);

  for (const bad of ["2147483648", "99999999999", "-1", "1.5", "1e3", "0x10", "", " 1", "abc"]) {
    assert.equal(parseSeasonNumber(bad), null, `should reject ${JSON.stringify(bad)}`);
  }
});

test("draft and cancelled seasons are not publicly listable", () => {
  assert.ok(!PUBLIC_SEASON_STATUSES.includes("DRAFT"));
  assert.ok(!PUBLIC_SEASON_STATUSES.includes("CANCELLED"));
  assert.ok(PUBLIC_SEASON_STATUSES.includes("RUNNING"));
  assert.ok(PUBLIC_SEASON_STATUSES.includes("COMPLETED"));
});
