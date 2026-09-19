import assert from "node:assert/strict";
import test from "node:test";
import { getPaymentCompletionUrl } from "../src/lib/payments/return-url";

test("payment completion redirects to the configured public origin", () => {
  const result = getPaymentCompletionUrl("https://surviver.lol", undefined);
  assert.equal(result.href, "https://surviver.lol/board");
});

test("valid campaign capability is restored only on the configured origin", () => {
  const token = "a_private_campaign_token_123456";
  const result = getPaymentCompletionUrl("https://surviver.lol/", token);
  assert.equal(result.href, `https://surviver.lol/entry/${token}`);
});

test("invalid campaign capability falls back to the board", () => {
  const result = getPaymentCompletionUrl("https://surviver.lol", "//attacker.example");
  assert.equal(result.href, "https://surviver.lol/board");
});
