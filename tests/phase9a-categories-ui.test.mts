// Phase 9A Task 9: Categories UI contract tests.
//
// Pure helper / copy-constant tests only. No React, no DOM, no fetch.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ── Empty state copy ──────────────────────────────────────────────────────────

test("CATEGORIES_EMPTY_TEXT must be non-empty Turkish copy", async () => {
  const { CATEGORIES_EMPTY_TEXT } = await import(
    "../lib/admin-ui/content-categories-ui-helpers.ts"
  );
  assert.ok(CATEGORIES_EMPTY_TEXT.length > 0, "must be non-empty");
});

test("CATEGORIES_FILTERED_EMPTY_TEXT must be non-empty", async () => {
  const { CATEGORIES_FILTERED_EMPTY_TEXT } = await import(
    "../lib/admin-ui/content-categories-ui-helpers.ts"
  );
  assert.ok(CATEGORIES_FILTERED_EMPTY_TEXT.length > 0, "must be non-empty");
});

// ── Slug field copy ────────────────────────────────────────────────────────────

test("SLUG_FIELD_LABEL must say 'URL adı' not 'Slug'", async () => {
  const { SLUG_FIELD_LABEL } = await import(
    "../lib/admin-ui/content-categories-ui-helpers.ts"
  );
  assert.ok(SLUG_FIELD_LABEL.length > 0, "must be non-empty");
  assert.ok(
    !SLUG_FIELD_LABEL.toLowerCase().includes("slug"),
    `Must not contain "slug" jargon: got "${SLUG_FIELD_LABEL}"`,
  );
  assert.ok(
    SLUG_FIELD_LABEL.includes("URL") || SLUG_FIELD_LABEL.includes("url"),
    `Must contain "URL": got "${SLUG_FIELD_LABEL}"`,
  );
});

test("SLUG_FIELD_HELPER must explain auto-generation from title", async () => {
  const { SLUG_FIELD_HELPER } = await import(
    "../lib/admin-ui/content-categories-ui-helpers.ts"
  );
  assert.ok(SLUG_FIELD_HELPER.length > 0, "must be non-empty");
  const lower = SLUG_FIELD_HELPER.toLowerCase();
  assert.ok(
    lower.includes("otomatik") || lower.includes("auto"),
    `Must mention auto-generation: got "${SLUG_FIELD_HELPER}"`,
  );
});

// ── Active badge labels ───────────────────────────────────────────────────────

test("IS_ACTIVE_LABELS must have active and inactive keys", async () => {
  const { IS_ACTIVE_LABELS } = await import(
    "../lib/admin-ui/content-categories-ui-helpers.ts"
  );
  assert.ok(typeof IS_ACTIVE_LABELS === "object", "must be an object");
  assert.ok("active" in IS_ACTIVE_LABELS, "must have 'active' key");
  assert.ok("inactive" in IS_ACTIVE_LABELS, "must have 'inactive' key");
  assert.ok(IS_ACTIVE_LABELS.active.length > 0, "active label must be non-empty");
  assert.ok(IS_ACTIVE_LABELS.inactive.length > 0, "inactive label must be non-empty");
});

// ── Auto-slug UX helpers ──────────────────────────────────────────────────────

test("computeSlugFromTitle regenerates slug when not manually edited", async () => {
  const { computeSlugFromTitle } = await import(
    "../lib/admin-ui/content-categories-ui-helpers.ts"
  );
  const result = computeSlugFromTitle("Yeni Kategori", {
    slug: "",
    slugManuallyEdited: false,
  });
  assert.equal(result.slugManuallyEdited, false);
  assert.ok(result.slug.length > 0, "slug must be generated from title");
});

test("computeSlugFromTitle preserves slug when manually edited", async () => {
  const { computeSlugFromTitle } = await import(
    "../lib/admin-ui/content-categories-ui-helpers.ts"
  );
  const result = computeSlugFromTitle("Farklı Başlık", {
    slug: "ozel-url",
    slugManuallyEdited: true,
  });
  assert.equal(result.slug, "ozel-url");
  assert.equal(result.slugManuallyEdited, true);
});

test("computeSlugFromManualEdit sets slugManuallyEdited flag", async () => {
  const { computeSlugFromManualEdit } = await import(
    "../lib/admin-ui/content-categories-ui-helpers.ts"
  );
  const result = computeSlugFromManualEdit("manuel-url");
  assert.equal(result.slug, "manuel-url");
  assert.equal(result.slugManuallyEdited, true);
});

// ── Payload builders ──────────────────────────────────────────────────────────

test("buildCategoryCreatePayload sends empty slug when not manually edited", async () => {
  const { buildCategoryCreatePayload } = await import(
    "../lib/admin-ui/content-categories-ui-helpers.ts"
  );
  const payload = buildCategoryCreatePayload({
    title: "Test Kategori",
    slugState: { slug: "test-kategori", slugManuallyEdited: false },
    description: null,
    isActive: true,
    sortOrder: 0,
  });
  assert.equal(payload.slug, "");
  assert.equal(payload.title, "Test Kategori");
  assert.equal(payload.isActive, true);
  assert.equal(payload.sortOrder, 0);
});

test("buildCategoryCreatePayload sends explicit slug when manually edited", async () => {
  const { buildCategoryCreatePayload } = await import(
    "../lib/admin-ui/content-categories-ui-helpers.ts"
  );
  const payload = buildCategoryCreatePayload({
    title: "Test Kategori",
    slugState: { slug: "ozel-slug", slugManuallyEdited: true },
    description: "Açıklama",
    isActive: false,
    sortOrder: 5,
  });
  assert.equal(payload.slug, "ozel-slug");
  assert.equal(payload.description, "Açıklama");
  assert.equal(payload.isActive, false);
  assert.equal(payload.sortOrder, 5);
});

test("buildCategoryUpdatePayload only includes provided fields", async () => {
  const { buildCategoryUpdatePayload } = await import(
    "../lib/admin-ui/content-categories-ui-helpers.ts"
  );
  const payload = buildCategoryUpdatePayload({
    title: "Güncellenmiş",
    isActive: false,
  });
  assert.equal(payload.title, "Güncellenmiş");
  assert.equal(payload.isActive, false);
  assert.ok(!("description" in payload), "description should not be included when not provided");
  assert.ok(!("sortOrder" in payload), "sortOrder should not be included when not provided");
});

// ── Payload round-trip through parser ─────────────────────────────────────────

test("buildCategoryCreatePayload round-trips through category create parser", async () => {
  const { buildCategoryCreatePayload } = await import(
    "../lib/admin-ui/content-categories-ui-helpers.ts"
  );
  const { parseCategoryCreateBodyForTest } = await import(
    "../lib/admin/content-categories-parsers.ts"
  );
  const payload = buildCategoryCreatePayload({
    title: "Round Trip Kategori",
    slugState: { slug: "", slugManuallyEdited: false },
    description: "Test açıklaması",
    isActive: true,
    sortOrder: 3,
  });

  const parsed = parseCategoryCreateBodyForTest(payload);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value.title, "Round Trip Kategori");
    assert.ok(parsed.value.slug.length > 0, "parser must auto-generate slug from title");
    assert.equal(parsed.value.description, "Test açıklaması");
    assert.equal(parsed.value.isActive, true);
    assert.equal(parsed.value.sortOrder, 3);
  }
});

test("buildCategoryUpdatePayload with slug round-trips through category update parser", async () => {
  const { buildCategoryUpdatePayload } = await import(
    "../lib/admin-ui/content-categories-ui-helpers.ts"
  );
  const { parseCategoryUpdateBodyForTest } = await import(
    "../lib/admin/content-categories-parsers.ts"
  );
  const payload = buildCategoryUpdatePayload({
    slug: "guncel-slug",
    isActive: false,
  });

  const parsed = parseCategoryUpdateBodyForTest(payload);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value.slug, "guncel-slug");
    assert.equal(parsed.value.isActive, false);
  }
});

test("category edit panel shows linked blog posts for the selected category", () => {
  const source = readFileSync(
    resolve(import.meta.dirname, "..", "components", "admin-categories", "AdminCategoriesView.tsx"),
    "utf-8",
  );

  assert.match(source, /Bağlı blog yazıları/);
  assert.match(source, /detail\.linkedPosts/);
  assert.match(source, /Bu kategoriye bağlı yazı yok/);
});
