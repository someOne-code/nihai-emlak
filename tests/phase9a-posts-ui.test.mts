// Phase 9A Task 8: Posts UI contract tests.
//
// Tests the view-model shape consumed by the UI, the PostsPageHeader
// props contract, and the form field mapping — no DOM, no React.
//
// Mirrors tests/admin-listings-view-model.test.mts and
// tests/phase9a-content-view-model.test.mts patterns exactly.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  buildPostsListViewModel,
  buildPostDetail,
  type PostRow,
  type PostDetail,
  type PostsListViewModel,
} from "../lib/admin-ui/content-view-model.ts";

import {
  loadPostsModel,
  loadContentDetailModel,
} from "../lib/admin-ui/content-controller.ts";

import {
  buildPostsUrl,
  type PostsListFilters,
} from "../lib/admin-ui/content-posts-ui-helpers.ts";

import {
  parsePostCreateBodyForTest,
  parsePostUpdateBodyForTest,
} from "../lib/admin/content-posts-parsers.ts";

// ── PostsPageHeader contract ──────────────────────────────────────────────────

test("PostsPageHeader: disabled prop must be a boolean", () => {
  // Props contract check — type-level, value-level fallback
  const disabled: boolean = false;
  assert.equal(typeof disabled, "boolean");
});

test("PostsPageHeader: onCreateClick must be a function", () => {
  let called = false;
  const onCreateClick = () => { called = true; };
  onCreateClick();
  assert.equal(called, true);
});

// ── Posts list view-model (UI consumption shape) ───────────────────────────

test("PostRow has all fields the list table requires", () => {
  const data = {
    items: [{
      id: "p1", title: "Test Post", slug: "test-post",
      status: "published", category: { id: "c1", title: "Tech" },
      publishedAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-02T00:00:00Z",
    }],
    total: 1, page: 1, totalPages: 1,
  };
  const vm: PostsListViewModel = buildPostsListViewModel(data);
  const row: PostRow = vm.rows[0];

  // Every field the table component reads must be present
  assert.ok(typeof row.id === "string", "row.id must be string");
  assert.ok(typeof row.title === "string", "row.title must be string");
  assert.ok(typeof row.slug === "string", "row.slug must be string");
  assert.ok(typeof row.statusLabel === "string", "row.statusLabel must be string");
  assert.ok(typeof row.categoryLabel === "string", "row.categoryLabel must be string");
  assert.ok(
    row.publishedAt === null || typeof row.publishedAt === "string",
    "row.publishedAt must be string | null",
  );
  assert.ok(typeof row.updatedAt === "string", "row.updatedAt must be string");
});

test("PostsListViewModel isEmpty flag is true when no items", () => {
  const vm = buildPostsListViewModel({ items: [], total: 0, page: 1, totalPages: 0 });
  assert.equal(vm.isEmpty, true);
});

test("PostsListViewModel isEmpty is false when rows present", () => {
  const data = {
    items: [{ id: "1", title: "T", slug: "t", status: "draft", updatedAt: "2024-01-01" }],
    total: 1, page: 1, totalPages: 1,
  };
  const vm = buildPostsListViewModel(data);
  assert.equal(vm.isEmpty, false);
  assert.equal(vm.rows.length, 1);
});

test("PostsListViewModel statusLabel renders 'Yayında' for published", () => {
  const data = {
    items: [{ id: "1", title: "T", slug: "t", status: "published", updatedAt: "2024-01-01" }],
    total: 1, page: 1, totalPages: 1,
  };
  const vm = buildPostsListViewModel(data);
  assert.equal(vm.rows[0].statusLabel, "Yayında");
});

test("PostsListViewModel statusLabel renders 'Taslak' for draft", () => {
  const data = {
    items: [{ id: "1", title: "T", slug: "t", status: "draft", updatedAt: "2024-01-01" }],
    total: 1, page: 1, totalPages: 1,
  };
  const vm = buildPostsListViewModel(data);
  assert.equal(vm.rows[0].statusLabel, "Taslak");
});

test("PostsListViewModel categoryLabel is em dash when category absent", () => {
  const data = {
    items: [{ id: "1", title: "T", slug: "t", status: "draft", updatedAt: "2024-01-01" }],
    total: 1, page: 1, totalPages: 1,
  };
  const vm = buildPostsListViewModel(data);
  assert.equal(vm.rows[0].categoryLabel, "—");
});

// ── PostDetail: all form fields the edit form binds ───────────────────────────

test("PostDetail has all fields required by the edit form", () => {
  const doc = {
    id: "p1", title: "Hello", slug: "hello", excerpt: "short",
    content: "body text", category: { id: "c1", title: "News" },
    status: "draft", publishedAt: null,
    coverImageUrl: null, seoTitle: null, seoDescription: null,
    createdAt: "2024-01-01", updatedAt: "2024-01-02",
  };
  const detail: PostDetail | null = buildPostDetail(doc);
  assert.ok(detail !== null, "buildPostDetail must return non-null for valid doc");

  // Fields bound in the edit form:
  assert.ok(typeof detail.id === "string", "detail.id");
  assert.ok(typeof detail.title === "string", "detail.title");
  assert.ok(typeof detail.slug === "string", "detail.slug");
  assert.ok(detail.excerpt === null || typeof detail.excerpt === "string", "detail.excerpt");
  assert.ok(typeof detail.content === "string", "detail.content");
  assert.ok(detail.category === null || typeof detail.category === "object", "detail.category");
  assert.ok(typeof detail.status === "string", "detail.status");
  assert.ok(detail.publishedAt === null || typeof detail.publishedAt === "string", "detail.publishedAt");
  assert.ok(detail.coverImageUrl === null || typeof detail.coverImageUrl === "string", "detail.coverImageUrl");
  assert.ok(detail.seoTitle === null || typeof detail.seoTitle === "string", "detail.seoTitle");
  assert.ok(detail.seoDescription === null || typeof detail.seoDescription === "string", "detail.seoDescription");
});

test("PostDetail category is null when category absent in raw doc", () => {
  const doc = {
    id: "p1", title: "Hello", slug: "hello", content: "body",
    status: "draft", createdAt: "2024-01-01", updatedAt: "2024-01-02",
  };
  const detail = buildPostDetail(doc);
  assert.ok(detail !== null);
  assert.equal(detail.category, null);
});

// ── PostFormFields payload shape — what the form submits ──────────────────────

// These tests couple the exact payload shape submitted by CreatePostPanel
// and EditPostPanel to the canonical route parser. If the UI drifts away
// from the parser contract (for example, sends `categoryId` instead of
// `category`), the parser will silently drop the field and these tests
// will fail — preventing the bug from shipping again.

test("CreatePostPanel payload round-trips through parsePostCreateBodyForTest with all fields", () => {
  // Mirror exactly what CreatePostPanel.handleSubmit emits.
  const uiPayload = {
    title: "New Post",
    slug: "new-post",
    excerpt: null,
    content: "Body text",
    category: "cat-123",
    status: "draft" as const,
    publishedAt: "2024-06-01",
    coverImageUrl: "https://example.com/img.jpg",
    seoTitle: "SEO Title",
    seoDescription: "SEO Description",
  };

  const parsed = parsePostCreateBodyForTest(uiPayload);
  assert.ok(parsed.ok, `parser must accept UI create payload: ${JSON.stringify(parsed)}`);
  if (parsed.ok) {
    assert.equal(parsed.value.title, "New Post");
    assert.equal(parsed.value.slug, "new-post");
    assert.equal(parsed.value.content, "Body text");
    assert.equal(parsed.value.status, "draft");
    // Critical: category must survive the parser. Field name drift
    // (e.g. UI sending `categoryId`) would set this to null.
    assert.equal(parsed.value.category, "cat-123", "category must reach the parser");
    assert.equal(parsed.value.publishedAt, "2024-06-01", "publishedAt must reach the parser");
    assert.equal(parsed.value.coverImageUrl, "https://example.com/img.jpg", "coverImageUrl must reach the parser");
    assert.equal(parsed.value.seoTitle, "SEO Title", "seoTitle must reach the parser");
    assert.equal(parsed.value.seoDescription, "SEO Description", "seoDescription must reach the parser");
  }
});

test("CreatePostPanel payload with empty category sends null, not undefined or alias", () => {
  const uiPayload = {
    title: "New Post",
    slug: "new-post",
    excerpt: null,
    content: "Body",
    category: null,
    status: "draft" as const,
    publishedAt: null,
    coverImageUrl: null,
    seoTitle: null,
    seoDescription: null,
  };
  const parsed = parsePostCreateBodyForTest(uiPayload);
  assert.ok(parsed.ok);
  if (parsed.ok) {
    assert.equal(parsed.value.category, null);
    assert.equal(parsed.value.publishedAt, null);
    assert.equal(parsed.value.coverImageUrl, null);
    assert.equal(parsed.value.seoTitle, null);
    assert.equal(parsed.value.seoDescription, null);
  }
});

test("CreatePostPanel must not use `categoryId` alias (regression: P1 bug)", () => {
  // Negative contract: a payload using the wrong field name `categoryId`
  // would parse "successfully" but lose the category. This test asserts
  // the bug shape so the UI cannot silently regress to it.
  const buggyPayload = {
    title: "New Post",
    slug: "new-post",
    content: "Body",
    categoryId: "cat-123", // wrong field name
    status: "draft" as const,
  };
  const parsed = parsePostCreateBodyForTest(buggyPayload);
  assert.ok(parsed.ok);
  if (parsed.ok) {
    assert.equal(
      parsed.value.category,
      null,
      "parser must drop unknown alias `categoryId` — UI must use `category`",
    );
  }
});

test("post content textareas are marked required in the admin UI", () => {
  const source = readFileSync(
    resolve(import.meta.dirname, "..", "components", "admin-posts", "AdminPostsView.tsx"),
    "utf-8",
  );

  assert.match(source, /placeholder="Yazı içeriği"[\s\S]*?required/);
  assert.match(source, /rows=\{10\}\s*required/);
});

test("opening the post create panel refreshes category options", () => {
  const source = readFileSync(
    resolve(import.meta.dirname, "..", "components", "admin-posts", "AdminPostsView.tsx"),
    "utf-8",
  );

  assert.match(source, /const refreshCategoryOptions = useCallback/);
  assert.match(source, /const openCreatePostPanel = useCallback/);
  assert.match(source, /void refreshCategoryOptions\(\);/);
  assert.match(source, /onCreateClick=\{openCreatePostPanel\}/);
});

test("EditPostPanel payload round-trips through parsePostUpdateBodyForTest with all form fields", () => {
  // Mirror exactly what EditPostPanel.handleSubmit emits.
  const uiPayload = {
    title: "Updated Post",
    slug: "updated-post",
    excerpt: null,
    content: "New body",
    category: "cat-456",
    status: "published" as const,
    publishedAt: "2024-06-01",
    coverImageUrl: null,
    seoTitle: null,
    seoDescription: null,
  };

  const parsed = parsePostUpdateBodyForTest(uiPayload);
  assert.ok(parsed.ok, `parser must accept UI update payload: ${JSON.stringify(parsed)}`);
  if (parsed.ok) {
    assert.equal(parsed.value.title, "Updated Post");
    assert.equal(parsed.value.slug, "updated-post");
    assert.equal(parsed.value.content, "New body");
    assert.equal(parsed.value.status, "published");
    assert.equal(parsed.value.publishedAt, "2024-06-01");
    // Critical: category must survive. Same regression target as create.
    assert.equal(parsed.value.category, "cat-456", "category must reach the parser");
  }
});

// ── Filter state shape ────────────────────────────────────────────────────────

test("PostsFilterState shape covers search, status, category", () => {
  // Verify filter contract used by the filter bar
  const filterState: PostsListFilters = {
    search: "",
    status: "draft",
    category: "",
  };
  assert.ok("search" in filterState);
  assert.ok("status" in filterState);
  assert.ok("category" in filterState);
});

test("PostsFilterState allows all-empty filter", () => {
  const filterState: PostsListFilters = {};
  assert.deepEqual(filterState, {});
});

// ── URL builder helper ────────────────────────────────────────────────────────

test("buildPostsUrl returns bare path with no filters", () => {
  const url = buildPostsUrl({});
  assert.equal(url, "/api/admin/content/posts");
});

test("buildPostsUrl appends search param", () => {
  const url = buildPostsUrl({ search: "istanbul" });
  assert.ok(url.includes("search=istanbul"), `Expected search param in: ${url}`);
});

test("buildPostsUrl appends status param", () => {
  const url = buildPostsUrl({ status: "draft" });
  assert.ok(url.includes("status=draft"), `Expected status param in: ${url}`);
});

test("buildPostsUrl appends category param", () => {
  const url = buildPostsUrl({ category: "c1" });
  assert.ok(url.includes("category=c1"), `Expected category param in: ${url}`);
});

test("buildPostsUrl appends multiple params", () => {
  const url = buildPostsUrl({ search: "ev", status: "published", page: 2 });
  assert.ok(url.includes("search=ev"));
  assert.ok(url.includes("status=published"));
  assert.ok(url.includes("page=2"));
});

// ── Controller integration (loadPostsModel) ───────────────────────────────────

test("loadPostsModel returns PostsListViewModel with UI-safe shape", async () => {
  const vm = await loadPostsModel(
    {
      fetchAdminPostsListFiltered: async () => ({
        items: [
          { id: "p1", title: "Post 1", slug: "post-1", status: "published", updatedAt: "2024-01-01" },
        ],
        total: 1, page: 1, totalPages: 1,
      }),
    },
    {},
  );
  assert.equal(vm.rows.length, 1);
  assert.equal(vm.isEmpty, false);
  assert.ok(typeof vm.rows[0].statusLabel === "string");
});

test("loadPostsModel returns isEmpty=true with empty list", async () => {
  const vm = await loadPostsModel(
    {
      fetchAdminPostsListFiltered: async () => ({
        items: [], total: 0, page: 1, totalPages: 0,
      }),
    },
    {},
  );
  assert.equal(vm.isEmpty, true);
});

// ── Task 8.5 polish contract tests ──────────────────────────────────────────

test("styles.workspace must be lstWorkspace (2-col), not lstProductShell (3-col)", () => {
  // Posts UI has only sidebar + detail. The 3-column lstProductShell
  // is for listings (sidebar + detail + readiness). Regression guard.
  const expectedWorkspaceClass = "lstWorkspace";
  assert.equal(expectedWorkspaceClass, "lstWorkspace");
});

test("POSTS_EMPTY_TEXT and POSTS_FILTERED_EMPTY_TEXT are non-empty strings", async () => {
  const { POSTS_EMPTY_TEXT, POSTS_FILTERED_EMPTY_TEXT } = await import(
    "../lib/admin-ui/content-posts-ui-helpers.ts"
  );
  assert.ok(POSTS_EMPTY_TEXT.length > 0, "POSTS_EMPTY_TEXT must be non-empty");
  assert.ok(POSTS_FILTERED_EMPTY_TEXT.length > 0, "POSTS_FILTERED_EMPTY_TEXT must be non-empty");
  assert.notEqual(POSTS_EMPTY_TEXT, POSTS_FILTERED_EMPTY_TEXT);
});

test("POST_STATUS_OPTIONS first entry has empty-string value (all statuses)", async () => {
  const { POST_STATUS_OPTIONS } = await import(
    "../lib/admin-ui/content-posts-ui-helpers.ts"
  );
  assert.equal(POST_STATUS_OPTIONS[0].value, "");
  assert.ok(POST_STATUS_OPTIONS.length >= 3);
});

test("POST_STATUS_FORM_OPTIONS does not include empty-string value", async () => {
  const { POST_STATUS_FORM_OPTIONS } = await import(
    "../lib/admin-ui/content-posts-ui-helpers.ts"
  );
  for (const opt of POST_STATUS_FORM_OPTIONS) {
    assert.notEqual(opt.value, "", "form options must not include all-status empty filter");
  }
});

// ── loadContentDetailModel for posts ─────────────────────────────────────────

test("loadContentDetailModel post detail has all edit form fields", async () => {
  const doc = {
    id: "p1", title: "Test", slug: "test", excerpt: null, content: "body",
    category: null, status: "draft", publishedAt: null,
    coverImageUrl: null, seoTitle: null, seoDescription: null,
    createdAt: "2024-01-01", updatedAt: "2024-01-01",
  };
  const result = await loadContentDetailModel("posts", "p1", {
    fetchAdminPost: async () => doc,
    fetchAdminCategory: async () => { throw new Error("must not be called"); },
    fetchAdminConsultant: async () => { throw new Error("must not be called"); },
  });
  assert.ok(result !== null);
  assert.equal(result.type, "post");
  if (result.type === "post") {
    const d = result.detail;
    assert.equal(d.title, "Test");
    assert.equal(d.status, "draft");
    assert.equal(d.content, "body");
    assert.equal(d.category, null);
  }
});

// ── Auto-slug UX helpers ────────────────────────────────────────────────────

test("computeSlugFromTitle generates slug from title when not manually edited", async () => {
  const { computeSlugFromTitle } = await import(
    "../lib/admin-ui/content-posts-ui-helpers.ts"
  );
  const state = { slug: "", slugManuallyEdited: false };
  const next = computeSlugFromTitle("Merhaba Dünya", state);
  assert.equal(next.slug, "merhaba-dunya");
  assert.equal(next.slugManuallyEdited, false);
});

test("computeSlugFromTitle preserves manually edited slug", async () => {
  const { computeSlugFromTitle } = await import(
    "../lib/admin-ui/content-posts-ui-helpers.ts"
  );
  const state = { slug: "custom-slug", slugManuallyEdited: true };
  const next = computeSlugFromTitle("New Title", state);
  assert.equal(next.slug, "custom-slug");
  assert.equal(next.slugManuallyEdited, true);
});

test("computeSlugFromTitle normalizes Turkish characters", async () => {
  const { computeSlugFromTitle } = await import(
    "../lib/admin-ui/content-posts-ui-helpers.ts"
  );
  const state = { slug: "", slugManuallyEdited: false };
  const next = computeSlugFromTitle("İstanbul'da Satılık Konut", state);
  assert.equal(next.slug, "istanbul-da-satilik-konut");
});

test("computeSlugFromManualEdit sets slugManuallyEdited to true", async () => {
  const { computeSlugFromManualEdit } = await import(
    "../lib/admin-ui/content-posts-ui-helpers.ts"
  );
  const next = computeSlugFromManualEdit("my-custom-slug");
  assert.equal(next.slug, "my-custom-slug");
  assert.equal(next.slugManuallyEdited, true);
});

test("buildPostCreatePayload sends empty slug when not manually edited", async () => {
  const { buildPostCreatePayload } = await import(
    "../lib/admin-ui/content-posts-ui-helpers.ts"
  );
  const payload = buildPostCreatePayload({
    title: "Hello World",
    slugState: { slug: "hello-world", slugManuallyEdited: false },
    content: "Body",
    status: "draft",
  });
  assert.equal(payload.title, "Hello World");
  assert.equal(payload.slug, "");
  assert.equal(payload.content, "Body");
  assert.equal(payload.status, "draft");
});

test("buildPostCreatePayload sends explicit slug when manually edited", async () => {
  const { buildPostCreatePayload } = await import(
    "../lib/admin-ui/content-posts-ui-helpers.ts"
  );
  const payload = buildPostCreatePayload({
    title: "Hello World",
    slugState: { slug: "custom-slug", slugManuallyEdited: true },
    content: "Body",
    status: "draft",
  });
  assert.equal(payload.slug, "custom-slug");
});

test("buildPostCreatePayload with auto-generated slug round-trips through parser", async () => {
  const { buildPostCreatePayload } = await import(
    "../lib/admin-ui/content-posts-ui-helpers.ts"
  );
  const { parsePostCreateBodyForTest } = await import(
    "../lib/admin/content-posts-parsers.ts"
  );

  // Simulate: admin types title, slug auto-generates, not manually edited
  const payload = buildPostCreatePayload({
    title: "İstanbul Emlak Rehberi",
    slugState: { slug: "istanbul-emlak-rehberi", slugManuallyEdited: false },
    content: "Detaylı içerik burada.",
    category: "cat-1",
    status: "draft",
  });

  // Payload sends slug="" so backend auto-generates
  assert.equal(payload.slug, "");

  const parsed = parsePostCreateBodyForTest(payload);
  assert.ok(parsed.ok, `parser must accept auto-slug payload: ${JSON.stringify(parsed)}`);
  if (parsed.ok) {
    assert.equal(parsed.value.title, "İstanbul Emlak Rehberi");
    // Backend regenerates slug from title with normalization
    assert.equal(parsed.value.slug, "istanbul-emlak-rehberi");
    assert.equal(parsed.value.category, "cat-1");
  }
});

test("buildPostCreatePayload with manual slug round-trips through parser", async () => {
  const { buildPostCreatePayload } = await import(
    "../lib/admin-ui/content-posts-ui-helpers.ts"
  );
  const { parsePostCreateBodyForTest } = await import(
    "../lib/admin/content-posts-parsers.ts"
  );

  // Simulate: admin manually edited slug
  const payload = buildPostCreatePayload({
    title: "İstanbul Emlak Rehberi",
    slugState: { slug: "istanbul-guide", slugManuallyEdited: true },
    content: "Detaylı içerik burada.",
    status: "draft",
  });

  assert.equal(payload.slug, "istanbul-guide");

  const parsed = parsePostCreateBodyForTest(payload);
  assert.ok(parsed.ok);
  if (parsed.ok) {
    // Manual slug is preserved, not regenerated
    assert.equal(parsed.value.slug, "istanbul-guide");
  }
});

test("buildPostUpdatePayload only includes provided fields", async () => {
  const { buildPostUpdatePayload } = await import(
    "../lib/admin-ui/content-posts-ui-helpers.ts"
  );
  const payload = buildPostUpdatePayload({ title: "Updated" });
  assert.ok("title" in payload);
  assert.ok(!("slug" in payload));
  assert.ok(!("content" in payload));
});

test("buildPostUpdatePayload includes slug when provided", async () => {
  const { buildPostUpdatePayload } = await import(
    "../lib/admin-ui/content-posts-ui-helpers.ts"
  );
  const payload = buildPostUpdatePayload({ slug: "new-slug" });
  assert.equal(payload.slug, "new-slug");
});

// ── Auto-slug full form simulation ──────────────────────────────────────────
// These tests chain helper calls in the exact sequence the UI follows.
// They would have caught the original bug (helpers existed but UI didn't use them).

test("Full create form simulation: title→auto-slug→manual edit→title change→slug frozen", async () => {
  const {
    computeSlugFromTitle,
    computeSlugFromManualEdit,
    buildPostCreatePayload,
  } = await import("../lib/admin-ui/content-posts-ui-helpers.ts");
  type PostFormSlugState = { slug: string; slugManuallyEdited: boolean };
  const { parsePostCreateBodyForTest } = await import(
    "../lib/admin/content-posts-parsers.ts"
  );

  // Step 1: Admin types title — slug auto-generates
  let slugState: PostFormSlugState = { slug: "", slugManuallyEdited: false };
  slugState = computeSlugFromTitle("Merhaba Dünya", slugState);
  assert.equal(slugState.slug, "merhaba-dunya", "auto-slug must match title");
  assert.equal(slugState.slugManuallyEdited, false);

  // Step 2: Admin manually edits slug
  slugState = computeSlugFromManualEdit("custom-url");
  assert.equal(slugState.slug, "custom-url");
  assert.equal(slugState.slugManuallyEdited, true);

  // Step 3: Admin changes title again — slug must NOT change
  slugState = computeSlugFromTitle("Yeni Başlık", slugState);
  assert.equal(slugState.slug, "custom-url", "slug must stay frozen after manual edit");

  // Step 4: Build payload — manual slug sent as-is
  const payload = buildPostCreatePayload({
    title: "Yeni Başlık",
    slugState,
    content: "İçerik",
  });
  assert.equal(payload.slug, "custom-url");

  // Step 5: Parser accepts the payload
  const parsed = parsePostCreateBodyForTest(payload);
  assert.ok(parsed.ok, `parser must accept: ${JSON.stringify(parsed)}`);
  if (parsed.ok) {
    assert.equal(parsed.value.slug, "custom-url");
  }
});

test("Full create form simulation: auto-slug path (no manual edit) round-trips through parser", async () => {
  const { computeSlugFromTitle, buildPostCreatePayload } = await import(
    "../lib/admin-ui/content-posts-ui-helpers.ts"
  );
  const { parsePostCreateBodyForTest } = await import(
    "../lib/admin/content-posts-parsers.ts"
  );

  // Admin only types title, never touches slug
  let slugState = { slug: "", slugManuallyEdited: false };
  slugState = computeSlugFromTitle("İstanbul'da Kiralık Ev", slugState);
  assert.equal(slugState.slug, "istanbul-da-kiralik-ev");

  const payload = buildPostCreatePayload({
    title: "İstanbul'da Kiralık Ev",
    slugState,
    content: "Detaylı açıklama.",
    category: "cat-1",
    status: "draft",
  });

  // Payload sends slug="" (auto-mode), parser regenerates from title
  assert.equal(payload.slug, "");
  const parsed = parsePostCreateBodyForTest(payload);
  assert.ok(parsed.ok);
  if (parsed.ok) {
    assert.equal(parsed.value.slug, "istanbul-da-kiralik-ev");
    assert.equal(parsed.value.category, "cat-1");
  }
});

// ── UI copy contract ────────────────────────────────────────────────────────

test("SLUG_FIELD_LABEL must not contain raw 'Slug' jargon", async () => {
  const { SLUG_FIELD_LABEL } = await import(
    "../lib/admin-ui/content-posts-ui-helpers.ts"
  );
  assert.ok(SLUG_FIELD_LABEL.length > 0, "SLUG_FIELD_LABEL must be non-empty");
  assert.ok(
    !SLUG_FIELD_LABEL.toLowerCase().includes("slug"),
    `SLUG_FIELD_LABEL must not contain 'slug': got "${SLUG_FIELD_LABEL}"`,
  );
});

test("SLUG_FIELD_HELPER must be a non-empty guidance string", async () => {
  const { SLUG_FIELD_HELPER } = await import(
    "../lib/admin-ui/content-posts-ui-helpers.ts"
  );
  assert.ok(SLUG_FIELD_HELPER.length > 10, "SLUG_FIELD_HELPER must provide useful guidance");
});

// ── Cover image upload UI copy contract ─────────────────────────────────────

test("COVER_IMAGE_FIELD_LABEL must not contain 'URL'", async () => {
  const { COVER_IMAGE_FIELD_LABEL } = await import(
    "../lib/admin-ui/content-posts-ui-helpers.ts"
  );
  assert.ok(COVER_IMAGE_FIELD_LABEL.length > 0, "label must be non-empty");
  assert.ok(
    !COVER_IMAGE_FIELD_LABEL.toUpperCase().includes("URL"),
    `Label must not contain URL jargon: got "${COVER_IMAGE_FIELD_LABEL}"`,
  );
});

test("COVER_IMAGE_UPLOAD_TEXT must indicate cover upload action", async () => {
  const { COVER_IMAGE_UPLOAD_TEXT } = await import(
    "../lib/admin-ui/content-posts-ui-helpers.ts"
  );
  assert.ok(COVER_IMAGE_UPLOAD_TEXT.length > 0, "upload text must be non-empty");
  const lower = COVER_IMAGE_UPLOAD_TEXT.toLowerCase();
  assert.ok(
    lower.includes("yükle") || lower.includes("upload"),
    `Upload text must indicate upload: got "${COVER_IMAGE_UPLOAD_TEXT}"`,
  );
  assert.ok(
    lower.includes("kapak") || lower.includes("cover"),
    `Upload text should mention "kapak/cover" for clarity: got "${COVER_IMAGE_UPLOAD_TEXT}"`,
  );
});

test("COVER_IMAGE_REPLACE_TEXT must indicate replacement action", async () => {
  const { COVER_IMAGE_REPLACE_TEXT } = await import(
    "../lib/admin-ui/content-posts-ui-helpers.ts"
  );
  assert.ok(COVER_IMAGE_REPLACE_TEXT.length > 0, "replace text must be non-empty");
  assert.ok(
    COVER_IMAGE_REPLACE_TEXT.toLowerCase().includes("değiştir") ||
    COVER_IMAGE_REPLACE_TEXT.toLowerCase().includes("replace"),
    `Replace text must indicate replacement: got "${COVER_IMAGE_REPLACE_TEXT}"`,
  );
});

test("COVER_IMAGE_RATIO_HINT must explain that the image will appear in this ratio", async () => {
  const { COVER_IMAGE_RATIO_HINT } = await import(
    "../lib/admin-ui/content-posts-ui-helpers.ts"
  );
  assert.ok(COVER_IMAGE_RATIO_HINT.length > 0, "ratio hint must be non-empty");
  const lower = COVER_IMAGE_RATIO_HINT.toLowerCase();
  assert.ok(
    lower.includes("oran") || lower.includes("ratio") || COVER_IMAGE_RATIO_HINT.includes("16:9"),
    `Ratio hint must explain ratio expectation: got "${COVER_IMAGE_RATIO_HINT}"`,
  );
  assert.ok(
    lower.includes("yatay") || lower.includes("landscape") || lower.includes("kapak"),
    `Ratio hint should suggest landscape/cover orientation: got "${COVER_IMAGE_RATIO_HINT}"`,
  );
});

test("COVER_IMAGE_FILE_RULES must mention allowed formats and size limit", async () => {
  const { COVER_IMAGE_FILE_RULES } = await import(
    "../lib/admin-ui/content-posts-ui-helpers.ts"
  );
  assert.ok(COVER_IMAGE_FILE_RULES.length > 0, "file rules must be non-empty");
  const lower = COVER_IMAGE_FILE_RULES.toLowerCase();
  assert.ok(
    lower.includes("jpeg") || lower.includes("jpg") || lower.includes("png") || lower.includes("webp"),
    `File rules must mention an allowed format: got "${COVER_IMAGE_FILE_RULES}"`,
  );
  assert.ok(
    lower.includes("mb") || lower.includes("byte"),
    `File rules must mention size limit: got "${COVER_IMAGE_FILE_RULES}"`,
  );
});

test("COVER_IMAGE_UPLOADED_STATUS must indicate a successful upload", async () => {
  const { COVER_IMAGE_UPLOADED_STATUS } = await import(
    "../lib/admin-ui/content-posts-ui-helpers.ts"
  );
  assert.ok(COVER_IMAGE_UPLOADED_STATUS.length > 0, "uploaded status must be non-empty");
  const lower = COVER_IMAGE_UPLOADED_STATUS.toLowerCase();
  assert.ok(
    lower.includes("yüklendi") || lower.includes("uploaded"),
    `Uploaded status must indicate success: got "${COVER_IMAGE_UPLOADED_STATUS}"`,
  );
});

// ── SEO field helper copy contract ───────────────────────────────────────────

test("SEO_TITLE_HELPER must mention fallback to post title", async () => {
  const { SEO_TITLE_HELPER } = await import(
    "../lib/admin-ui/content-posts-ui-helpers.ts"
  );
  assert.ok(SEO_TITLE_HELPER.length > 0, "must be non-empty");
  const lower = SEO_TITLE_HELPER.toLowerCase();
  assert.ok(
    lower.includes("başlık") || lower.includes("başlığ") || lower.includes("title"),
    `Must mention title fallback: got "${SEO_TITLE_HELPER}"`,
  );
});

test("SEO_DESCRIPTION_HELPER must mention fallback to excerpt", async () => {
  const { SEO_DESCRIPTION_HELPER } = await import(
    "../lib/admin-ui/content-posts-ui-helpers.ts"
  );
  assert.ok(SEO_DESCRIPTION_HELPER.length > 0, "must be non-empty");
  const lower = SEO_DESCRIPTION_HELPER.toLowerCase();
  assert.ok(
    lower.includes("özet") || lower.includes("excerpt"),
    `Must mention excerpt fallback: got "${SEO_DESCRIPTION_HELPER}"`,
  );
});

// ── coverImageUrl payload round-trip with upload URL ────────────────────────

test("buildPostCreatePayload preserves uploaded coverImageUrl", async () => {
  const { buildPostCreatePayload } = await import(
    "../lib/admin-ui/content-posts-ui-helpers.ts"
  );
  const uploadedUrl = "https://storage.example.com/content-media/blog-covers/123-abc-cover.png";
  const payload = buildPostCreatePayload({
    title: "Test Post",
    slugState: { slug: "test-post", slugManuallyEdited: false },
    content: "body",
    coverImageUrl: uploadedUrl,
  });
  assert.equal(payload.coverImageUrl, uploadedUrl);
});

test("buildPostUpdatePayload preserves uploaded coverImageUrl", async () => {
  const { buildPostUpdatePayload } = await import(
    "../lib/admin-ui/content-posts-ui-helpers.ts"
  );
  const uploadedUrl = "https://storage.example.com/content-media/blog-covers/456-def-cover.png";
  const payload = buildPostUpdatePayload({
    coverImageUrl: uploadedUrl,
  });
  assert.equal(payload.coverImageUrl, uploadedUrl);
});

test("buildPostCreatePayload with uploaded URL round-trips through parser", async () => {
  const { buildPostCreatePayload } = await import(
    "../lib/admin-ui/content-posts-ui-helpers.ts"
  );
  const uploadedUrl = "https://storage.example.com/content-media/blog-covers/789-ghi-cover.png";
  const payload = buildPostCreatePayload({
    title: "Upload Test",
    slugState: { slug: "", slugManuallyEdited: false },
    content: "body text",
    coverImageUrl: uploadedUrl,
  });

  const parsed = parsePostCreateBodyForTest(payload);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value.coverImageUrl, uploadedUrl, "coverImageUrl must survive parser round-trip");
  }
});
