import assert from "node:assert/strict";
import test from "node:test";

import { safeNextPath } from "../src/lib/auth/redirects";
import { BCRYPT_MAX_BYTES, hashPassword, passwordFitsBcrypt, verifyPassword } from "../src/lib/auth/password";
import { normalizeUrl, UnsafeUrlError } from "../src/lib/products/site-metadata";
import { hasCheckoutCapability } from "../src/lib/payments/access";
import { hashCapability, createInteractionProof, verifyInteractionProof, signValue, verifySignedValue } from "../src/lib/security/tokens";
import { parseSeasonNumber, PUBLIC_SEASON_STATUSES } from "../src/lib/competition/constants";
import { getPaymentProvider, isDevPayments } from "../src/lib/payments";
import { isPublicAddress } from "../src/lib/security/public-fetch";
import { publicUrl } from "../src/lib/security/origin";
import { env } from "../src/lib/env";
import { MAX_ATTEMPTS, RETRYABLE_STATUSES, retryDelayMs } from "../src/lib/payments/webhook-policy";

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
  assert.throws(() => normalizeUrl("http://127.0.0.1"), UnsafeUrlError);
  assert.throws(() => normalizeUrl("http://[::1]"), UnsafeUrlError);
});

test("metadata fetches reject every non-public address range", () => {
  for (const address of ["127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1"]) {
    assert.equal(isPublicAddress(address), false, address);
  }
  assert.equal(isPublicAddress("1.1.1.1"), true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
});

test("application redirects use APP_URL rather than a proxy request origin", () => {
  const previous = process.env.APP_URL;
  try {
    mutableEnv.APP_URL = "https://surviver.lol";
    assert.equal(publicUrl("/board").toString(), "https://surviver.lol/board");
    assert.throws(() => publicUrl("https://localhost:10000/board"));
  } finally {
    if (previous === undefined) delete mutableEnv.APP_URL; else mutableEnv.APP_URL = previous;
  }
});

test("APP_URL is never allowed to be an internal address in production", () => {
  const previousUrl = process.env.APP_URL;
  const previousNodeEnv = process.env.NODE_ENV;
  try {
    mutableEnv.NODE_ENV = "production";

    // The exact shape a container host hands the app when APP_URL is unset.
    for (const internal of [
      "https://localhost:10000",
      "http://127.0.0.1:3000",
      "http://0.0.0.0:8080",
      "http://10.0.0.7",
      "http://172.16.4.2",
      "http://192.168.1.10",
      "http://[::1]:10000",
      "https://web",
      "http://app.local",
    ]) {
      mutableEnv.APP_URL = internal;
      assert.throws(() => env.appUrl, /internal address/, `${internal} must be rejected`);
    }

    // A missing value fails loudly instead of falling back to localhost.
    delete mutableEnv.APP_URL;
    assert.throws(() => env.appUrl, /APP_URL/);

    mutableEnv.APP_URL = "not a url";
    assert.throws(() => env.appUrl, /absolute URL/);

    mutableEnv.APP_URL = "https://surviver.lol/";
    assert.equal(env.appUrl, "https://surviver.lol");
    assert.equal(publicUrl("/board").toString(), "https://surviver.lol/board");
  } finally {
    mutableEnv.NODE_ENV = previousNodeEnv;
    if (previousUrl === undefined) delete mutableEnv.APP_URL; else mutableEnv.APP_URL = previousUrl;
  }
});

test("outside production a local APP_URL is still the default", () => {
  const previous = process.env.APP_URL;
  try {
    delete mutableEnv.APP_URL;
    assert.equal(env.appUrl, "http://localhost:3000");
  } finally {
    if (previous === undefined) delete mutableEnv.APP_URL; else mutableEnv.APP_URL = previous;
  }
});

test("a failed or reviewable webhook stays retryable, a settled one does not", () => {
  // The inbox is what decides whether a redelivery gets another chance.
  assert.ok(RETRYABLE_STATUSES.includes("FAILED"));
  assert.ok(RETRYABLE_STATUSES.includes("NEEDS_REVIEW"));
  assert.ok(!RETRYABLE_STATUSES.includes("PROCESSED"));
  assert.ok(!RETRYABLE_STATUSES.includes("EXHAUSTED"));

  // Backoff grows but stays bounded, and attempts are capped so a permanently
  // broken message settles instead of looping forever.
  assert.equal(retryDelayMs(1), 60_000);
  assert.equal(retryDelayMs(2), 120_000);
  assert.ok(retryDelayMs(MAX_ATTEMPTS) <= 30 * 60_000);
  for (let i = 1; i < MAX_ATTEMPTS; i++) assert.ok(retryDelayMs(i) <= retryDelayMs(i + 1));
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

test("Dodo checkout fails closed on catalog drift and binds canonical price settings", async () => {
  const keys = ["NODE_ENV", "PAYMENT_PROVIDER", "DODO_PAYMENTS_API_KEY", "DODO_PAYMENTS_PRODUCT_ID", "DODO_PAYMENTS_BUSINESS_ID", "DODO_PAYMENTS_ENVIRONMENT"] as const;
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const input = { paymentId: "local-payment", amountCents: 2900, currency: "usd", description: "Entry", successUrl: "https://surviver.lol/enter/complete", cancelUrl: "https://surviver.lol/" };
  try {
    Object.assign(mutableEnv, { NODE_ENV: "development", PAYMENT_PROVIDER: "dodo", DODO_PAYMENTS_API_KEY: "test-key", DODO_PAYMENTS_PRODUCT_ID: "pdt_test", DODO_PAYMENTS_BUSINESS_ID: "biz_test", DODO_PAYMENTS_ENVIRONMENT: "test_mode" });
    console.error = () => undefined;
    // The production incident: the provider's product was configured at $0.50
    // while the app expected $29, and the founder was charged the provider's
    // price. The amount the app asks for is not sent to the provider — Dodo
    // charges what its own catalog says — so the only safe move is to refuse a
    // checkout whose catalog price is not exactly the season price.
    const catalog = (price: Record<string, unknown>, product: Record<string, unknown> = {}) =>
      async () => Response.json({ business_id: "biz_test", is_recurring: false, pricing_mode: null, ...product, price: { type: "one_time_price", currency: "USD", price: 2900, pay_what_you_want: false, purchasing_power_parity: false, ...price } });

    for (const [label, drift] of [
      ["under-priced", catalog({ price: 50 })],
      ["over-priced", catalog({ price: 9900 })],
      ["wrong currency", catalog({ currency: "EUR" })],
      ["buyer sets the price", catalog({ pay_what_you_want: true })],
      ["regional pricing", catalog({ purchasing_power_parity: true })],
      ["discounted price", catalog({ discount: 100 })],
      ["subscription", catalog({}, { is_recurring: true })],
      ["another business", catalog({}, { business_id: "biz_someone_else" })],
      ["dynamic pricing mode", catalog({}, { pricing_mode: "dynamic" })],
    ] as const) {
      globalThis.fetch = drift as typeof globalThis.fetch;
      await assert.rejects(() => getPaymentProvider().createCheckout(input), /misconfigured/, `${label} must not reach checkout`);
    }

    let checkoutBody: Record<string, unknown> | undefined;
    let requestNumber = 0;
    globalThis.fetch = async (_url, init) => {
      requestNumber++;
      if (requestNumber === 1) return Response.json({ business_id: "biz_test", is_recurring: false, pricing_mode: null, price: { type: "one_time_price", currency: "USD", price: 2900, pay_what_you_want: false, purchasing_power_parity: false } });
      checkoutBody = JSON.parse(String(init?.body));
      return Response.json({ session_id: "cks_test", checkout_url: "https://checkout.dodopayments.com/cks_test" });
    };
    const session = await getPaymentProvider().createCheckout(input);
    assert.equal(session.providerCheckoutId, "cks_test");
    assert.equal(checkoutBody?.billing_currency, "USD");
    assert.equal(checkoutBody?.cancel_url, input.cancelUrl);
    assert.deepEqual(checkoutBody?.feature_flags, { allow_currency_selection: false, allow_discount_code: false });
    assert.deepEqual(checkoutBody?.metadata, { payment_id: input.paymentId, expected_amount_cents: "2900", expected_currency: "usd", tax_inclusive: "false" });
    const parsed = await getPaymentProvider().parseWebhook(JSON.stringify({
      type: "payment.succeeded",
      data: { payment_id: "pay_test", business_id: "biz_test", total_amount: 3190, tax: 290, currency: "USD", metadata: { payment_id: input.paymentId }, product_cart: [{ product_id: "pdt_test", quantity: 1 }] },
    }), { eventId: "evt_test" });
    assert.deepEqual(parsed, { kind: "succeeded", providerPaymentId: "pay_test", localPaymentId: input.paymentId, eventId: "evt_test", businessId: "biz_test", currency: "usd", amountCents: 2900, chargedAmountCents: 3190 });
    const inclusive = await getPaymentProvider().parseWebhook(JSON.stringify({
      type: "payment.succeeded", data: { payment_id: "pay_tax", business_id: "biz_test", total_amount: 2900, tax: 442, currency: "USD", metadata: { payment_id: input.paymentId, tax_inclusive: "true" }, product_cart: [{ product_id: "pdt_test", quantity: 1 }] },
    }), { eventId: "evt_tax" });
    assert.ok(inclusive.kind === "succeeded");
    assert.equal(inclusive.amountCents, 2900);
    assert.equal(inclusive.chargedAmountCents, 2900);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    for (const key of keys) {
      const value = previous[key];
      if (value === undefined) delete mutableEnv[key]; else mutableEnv[key] = value;
    }
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
