// Phase 9A Task 11: Shared UX contract tests across Posts/Categories/Consultants.
//
// These regression tests pin down the "consistent across all three modules"
// behaviors required by the Phase 9A plan:
//   - SLUG_FIELD_LABEL must equal "URL adı" everywhere (no raw "Slug")
//   - SLUG_FIELD_HELPER must mention auto-generation
//   - Each module exposes the same shape of slug-state helpers and payload builders
//   - URL adı auto-generation must freeze on manual edit
//   - Empty state copy must be present in every module

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const POSTS = "../lib/admin-ui/content-posts-ui-helpers.ts";
const CATEGORIES = "../lib/admin-ui/content-categories-ui-helpers.ts";
const CONSULTANTS = "../lib/admin-ui/content-consultants-ui-helpers.ts";

// ── SLUG_FIELD_LABEL must equal "URL adı" across all three modules ──────────

test("SLUG_FIELD_LABEL is identical across posts/categories/consultants", async () => {
  const posts = await import(POSTS);
  const categories = await import(CATEGORIES);
  const consultants = await import(CONSULTANTS);

  assert.equal(posts.SLUG_FIELD_LABEL, "URL adı");
  assert.equal(categories.SLUG_FIELD_LABEL, "URL adı");
  assert.equal(consultants.SLUG_FIELD_LABEL, "URL adı");
});

test("SLUG_FIELD_HELPER mentions auto-generation across all three modules", async () => {
  const posts = await import(POSTS);
  const categories = await import(CATEGORIES);
  const consultants = await import(CONSULTANTS);

  for (const [mod, helper] of [
    ["posts", posts.SLUG_FIELD_HELPER],
    ["categories", categories.SLUG_FIELD_HELPER],
    ["consultants", consultants.SLUG_FIELD_HELPER],
  ] as const) {
    assert.ok(
      helper.toLowerCase().includes("otomatik"),
      `${mod}: SLUG_FIELD_HELPER must mention "otomatik": got "${helper}"`,
    );
  }
});

// ── Empty state copy must exist for each module ──────────────────────────────

test("Each module exports a non-empty list empty-state and filtered-empty-state copy", async () => {
  const posts = await import(POSTS);
  const categories = await import(CATEGORIES);
  const consultants = await import(CONSULTANTS);

  assert.ok(posts.POSTS_EMPTY_TEXT.length > 0);
  assert.ok(posts.POSTS_FILTERED_EMPTY_TEXT.length > 0);
  assert.ok(categories.CATEGORIES_EMPTY_TEXT.length > 0);
  assert.ok(categories.CATEGORIES_FILTERED_EMPTY_TEXT.length > 0);
  assert.ok(consultants.CONSULTANTS_EMPTY_TEXT.length > 0);
  assert.ok(consultants.CONSULTANTS_FILTERED_EMPTY_TEXT.length > 0);
});

test("Content list empty states do not render duplicate create buttons", () => {
  const listFiles = [
    "components/admin-posts/PostsList.tsx",
    "components/admin-categories/CategoriesList.tsx",
    "components/admin-consultants/ConsultantsList.tsx",
  ];

  for (const relativePath of listFiles) {
    const source = readFileSync(resolve(import.meta.dirname, "..", relativePath), "utf-8");
    assert.doesNotMatch(source, /onCreateClick/);
    assert.doesNotMatch(source, /<Button[\s\S]*Yeni (yazı|kategori|danışman)/);
  }
});

test("Content detail empty states are hidden when the list itself is empty", () => {
  const viewFiles = [
    "components/admin-posts/AdminPostsView.tsx",
    "components/admin-categories/AdminCategoriesView.tsx",
    "components/admin-consultants/AdminConsultantsView.tsx",
  ];

  for (const relativePath of viewFiles) {
    const source = readFileSync(resolve(import.meta.dirname, "..", relativePath), "utf-8");
    assert.match(source, /const shouldRenderDetailPanel =[\s\S]*?(viewModel\.rows|filteredRows)\.length > 0/);
    assert.match(source, /\{shouldRenderDetailPanel && \(\s*<section className=\{adminLayout\.detailPanel\}>/);
  }
});

test("Content admin views revalidate stale data when the browser tab resumes", () => {
  const viewFiles = [
    "components/admin-posts/AdminPostsView.tsx",
    "components/admin-categories/AdminCategoriesView.tsx",
    "components/admin-consultants/AdminConsultantsView.tsx",
  ];

  for (const relativePath of viewFiles) {
    const source = readFileSync(resolve(import.meta.dirname, "..", relativePath), "utf-8");
    assert.match(source, /createContentRefreshGate/);
    assert.match(source, /shouldRefreshContentOnResume/);
    assert.match(source, /addEventListener\("focus"/);
    assert.match(source, /addEventListener\("visibilitychange"/);
  }
});

test("Content mutation refreshes run independent list and detail reads in parallel", () => {
  const viewFiles = [
    "components/admin-posts/AdminPostsView.tsx",
    "components/admin-categories/AdminCategoriesView.tsx",
    "components/admin-consultants/AdminConsultantsView.tsx",
  ];

  for (const relativePath of viewFiles) {
    const source = readFileSync(resolve(import.meta.dirname, "..", relativePath), "utf-8");
    assert.match(source, /refreshContentViews/);
    assert.match(source, /refreshAfterMutation[\s\S]*refreshContentViews\(/);
    assert.doesNotMatch(source, /await loadList\([^)]*\);\s*if \([^)]* && mountedRef\.current\)\s*await handleSelect/);
  }
});

// ── computeSlug* helpers must freeze on manual edit (parametric over modules) ─

test("computeSlugFromTitle/Name freezes auto-generation when slug is manually edited", async () => {
  const posts = await import(POSTS);
  const categories = await import(CATEGORIES);
  const consultants = await import(CONSULTANTS);

  // Posts: computeSlugFromTitle
  const postsResult = posts.computeSlugFromTitle("Yeni Başlık", {
    slug: "manuel",
    slugManuallyEdited: true,
  });
  assert.equal(postsResult.slug, "manuel");
  assert.equal(postsResult.slugManuallyEdited, true);

  // Categories: computeSlugFromTitle
  const categoriesResult = categories.computeSlugFromTitle("Yeni Başlık", {
    slug: "manuel",
    slugManuallyEdited: true,
  });
  assert.equal(categoriesResult.slug, "manuel");
  assert.equal(categoriesResult.slugManuallyEdited, true);

  // Consultants: computeSlugFromFullName
  const consultantsResult = consultants.computeSlugFromFullName("Yeni İsim", {
    slug: "manuel",
    slugManuallyEdited: true,
  });
  assert.equal(consultantsResult.slug, "manuel");
  assert.equal(consultantsResult.slugManuallyEdited, true);
});

test("computeSlugFromManualEdit sets slugManuallyEdited=true across all modules", async () => {
  const posts = await import(POSTS);
  const categories = await import(CATEGORIES);
  const consultants = await import(CONSULTANTS);

  for (const [mod, fn] of [
    ["posts", posts.computeSlugFromManualEdit],
    ["categories", categories.computeSlugFromManualEdit],
    ["consultants", consultants.computeSlugFromManualEdit],
  ] as const) {
    const result = fn("ozel-slug");
    assert.equal(result.slug, "ozel-slug", `${mod}: slug must be set`);
    assert.equal(
      result.slugManuallyEdited,
      true,
      `${mod}: slugManuallyEdited must be true after manual edit`,
    );
  }
});

// ── Build*CreatePayload sends empty slug when not manually edited ────────────

test("buildXxxCreatePayload sends empty slug for auto-generation across all modules", async () => {
  const posts = await import(POSTS);
  const categories = await import(CATEGORIES);
  const consultants = await import(CONSULTANTS);

  const postsPayload = posts.buildPostCreatePayload({
    title: "Test",
    slugState: { slug: "test", slugManuallyEdited: false },
    content: "body",
  });
  assert.equal(postsPayload.slug, "");

  const categoriesPayload = categories.buildCategoryCreatePayload({
    title: "Test",
    slugState: { slug: "test", slugManuallyEdited: false },
  });
  assert.equal(categoriesPayload.slug, "");

  const consultantsPayload = consultants.buildConsultantCreatePayload({
    fullName: "Test",
    slugState: { slug: "test", slugManuallyEdited: false },
  });
  assert.equal(consultantsPayload.slug, "");
});

// ── Photo helper text must indicate upload-not-final-UX (Consultants) ───────

test("Consultants PHOTO_HELPER_TEXT mentions upload", async () => {
  const consultants = await import(CONSULTANTS);
  const helper = consultants.PHOTO_HELPER_TEXT.toLowerCase();
  assert.ok(
    helper.includes("yükle") || helper.includes("upload"),
    `Photo helper must mention upload: got "${consultants.PHOTO_HELPER_TEXT}"`,
  );
});

// ── Cover image (Posts) helper must indicate ratio expectation ───────────────

test("Posts COVER_IMAGE_RATIO_HINT signals 16:9 ratio convention", async () => {
  const posts = await import(POSTS);
  const hint = posts.COVER_IMAGE_RATIO_HINT.toLowerCase();
  assert.ok(
    hint.includes("oran") || hint.includes("ratio") ||
    posts.COVER_IMAGE_RATIO_HINT.includes("16:9") ||
    hint.includes("yatay"),
    `Cover image hint must mention ratio expectation: got "${posts.COVER_IMAGE_RATIO_HINT}"`,
  );
});

test("Content create actions clear selection instead of opening the new item editor", () => {
  const viewFiles = [
    "components/admin-posts/AdminPostsView.tsx",
    "components/admin-categories/AdminCategoriesView.tsx",
    "components/admin-consultants/AdminConsultantsView.tsx",
  ];

  for (const relativePath of viewFiles) {
    const source = readFileSync(resolve(import.meta.dirname, "..", relativePath), "utf-8");
    assert.doesNotMatch(source, /createAdmin(?:Post|Category|Consultant)[\s\S]*return readIdFromMutation\(created\)/);
    assert.match(source, /createAdmin(?:Post|Category|Consultant)[\s\S]*setShowCreate\(false\);[\s\S]*return null;/);
  }
});
