import assert from "node:assert/strict";
import test from "node:test";
import { cleanText } from "../src/lib/security/text";

test("strips bidi overrides and zero-width characters from scraped text", () => {
  assert.equal(cleanText("moc.elgoog‮", 60), "moc.elgoog");
  assert.equal(cleanText("A​​​cme﻿", 60), "Acme");
});

test("removes markup and control characters and collapses whitespace", () => {
  assert.equal(cleanText("<b>Fast</b>\n\n tool\u0007", 60), "Fast tool");
});

test("normalises compatibility forms and caps by code point", () => {
  assert.equal(cleanText("ＡＢＣ", 60), "ABC");
  assert.equal(cleanText("😀😀😀", 2), "😀😀");
  assert.equal(cleanText(null, 10), "");
});
