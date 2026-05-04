// Phase 9A: Tests for the shared slugify helper with Turkish character normalization.
//
// Covers:
//   - Basic English title → slug
//   - Turkish character normalization (ç→c, ğ→g, ı→i, ö→o, ş→s, ü→u)
//   - Special characters and punctuation
//   - Edge cases (empty, whitespace-only, numbers, mixed content)

import assert from "node:assert/strict";
import test from "node:test";

import { slugifyTitle } from "../lib/admin/content-slugify.ts";

// ── Basic English ───────────────────────────────────────────────────────────

test("slugifyTitle converts simple English title", () => {
  assert.equal(slugifyTitle("Hello World"), "hello-world");
});

test("slugifyTitle lowercases and hyphenates multi-word title", () => {
  assert.equal(slugifyTitle("My First Blog Post"), "my-first-blog-post");
});

test("slugifyTitle trims leading/trailing whitespace", () => {
  assert.equal(slugifyTitle("  Hello World  "), "hello-world");
});

// ── Turkish character normalization ─────────────────────────────────────────

test("slugifyTitle normalizes ç → c", () => {
  assert.equal(slugifyTitle("çiçek"), "cicek");
});

test("slugifyTitle normalizes Ç → c", () => {
  assert.equal(slugifyTitle("ÇİÇEK"), "cicek");
});

test("slugifyTitle normalizes ğ → g", () => {
  assert.equal(slugifyTitle("dağ"), "dag");
});

test("slugifyTitle normalizes Ğ → g", () => {
  assert.equal(slugifyTitle("DAĞ"), "dag");
});

test("slugifyTitle normalizes ı → i", () => {
  assert.equal(slugifyTitle("ışık"), "isik");
});

test("slugifyTitle normalizes İ → i", () => {
  assert.equal(slugifyTitle("İSTANBUL"), "istanbul");
});

test("slugifyTitle normalizes I (capital i) → i", () => {
  // Turkish uppercase I without dot should also map to i
  assert.equal(slugifyTitle("ISIK"), "isik");
});

test("slugifyTitle normalizes ö → o", () => {
  assert.equal(slugifyTitle("göz"), "goz");
});

test("slugifyTitle normalizes Ö → o", () => {
  assert.equal(slugifyTitle("GÖZ"), "goz");
});

test("slugifyTitle normalizes ş → s", () => {
  assert.equal(slugifyTitle("şeker"), "seker");
});

test("slugifyTitle normalizes Ş → s", () => {
  assert.equal(slugifyTitle("ŞEKER"), "seker");
});

test("slugifyTitle normalizes ü → u", () => {
  assert.equal(slugifyTitle("güzel"), "guzel");
});

test("slugifyTitle normalizes Ü → u", () => {
  assert.equal(slugifyTitle("GÜZEL"), "guzel");
});

// ── Real-world Turkish titles ───────────────────────────────────────────────

test("slugifyTitle handles full Turkish sentence", () => {
  assert.equal(
    slugifyTitle("İstanbul'da Satılık Daireler ve Konutlar"),
    "istanbul-da-satilik-daireler-ve-konutlar",
  );
});

test("slugifyTitle handles Turkish title with mixed case", () => {
  assert.equal(
    slugifyTitle("Türkiye'de Emlak Piyasası 2025"),
    "turkiye-de-emlak-piyasasi-2025",
  );
});

test("slugifyTitle handles consultant full name with Turkish chars", () => {
  assert.equal(slugifyTitle("Şükrü Özyıldız"), "sukru-ozyildiz");
});

test("slugifyTitle handles category title with Turkish chars", () => {
  assert.equal(slugifyTitle("Güncel Haberler"), "guncel-haberler");
});

// ── Special characters and punctuation ──────────────────────────────────────

test("slugifyTitle replaces punctuation with hyphens", () => {
  assert.equal(slugifyTitle("Hello, World!"), "hello-world");
});

test("slugifyTitle collapses multiple non-alphanumeric chars into single hyphen", () => {
  assert.equal(slugifyTitle("Hello!!!   World"), "hello-world");
});

test("slugifyTitle handles apostrophe", () => {
  assert.equal(slugifyTitle("What's New"), "what-s-new");
});

test("slugifyTitle handles ampersand and special symbols", () => {
  assert.equal(slugifyTitle("Buy & Sell"), "buy-sell");
});

test("slugifyTitle handles parentheses", () => {
  assert.equal(slugifyTitle("Tips (2025 Edition)"), "tips-2025-edition");
});

test("slugifyTitle handles slashes", () => {
  assert.equal(slugifyTitle("Rent/Sale Properties"), "rent-sale-properties");
});

// ── Numbers ─────────────────────────────────────────────────────────────────

test("slugifyTitle preserves numbers", () => {
  assert.equal(slugifyTitle("Top 10 Tips for 2025"), "top-10-tips-for-2025");
});

test("slugifyTitle handles numeric-only title", () => {
  assert.equal(slugifyTitle("12345"), "12345");
});

// ── Edge cases ──────────────────────────────────────────────────────────────

test("slugifyTitle returns empty string for empty input", () => {
  assert.equal(slugifyTitle(""), "");
});

test("slugifyTitle returns empty string for whitespace-only input", () => {
  assert.equal(slugifyTitle("   "), "");
});

test("slugifyTitle returns empty string for punctuation-only input", () => {
  assert.equal(slugifyTitle("!!!???"), "");
});

test("slugifyTitle handles single character", () => {
  assert.equal(slugifyTitle("A"), "a");
});

test("slugifyTitle handles single Turkish character", () => {
  assert.equal(slugifyTitle("Ç"), "c");
});

test("slugifyTitle trims leading hyphens from punctuation-heavy start", () => {
  assert.equal(slugifyTitle("!!! Hello"), "hello");
});

test("slugifyTitle trims trailing hyphens from punctuation-heavy end", () => {
  assert.equal(slugifyTitle("Hello !!!"), "hello");
});

test("slugifyTitle handles already-slugified input", () => {
  assert.equal(slugifyTitle("hello-world"), "hello-world");
});

test("slugifyTitle handles mixed Turkish and English", () => {
  assert.equal(slugifyTitle("İstanbul Real Estate 2025"), "istanbul-real-estate-2025");
});
