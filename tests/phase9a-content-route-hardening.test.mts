// Phase 9A Hardening: origin/content-type guard + body parser contract tests.
//
// Tests the side-effect-free surface of the content admin route layer:
//   1. validateContentAdminJsonEnvelope (POST/PATCH: content-type + origin)
//   2. validateContentAdminOrigin (DELETE: origin only)
//   3. Posts body parsers (extracted to content-posts-parsers.ts)
//   4. Categories body parsers (extracted to content-categories-parsers.ts)
//
// Handler files import @payload-config at module level, so we test the route
// contract via shared helpers and parsers — not the handler functions directly.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import {
  validateContentAdminJsonEnvelope,
  validateContentAdminOrigin,
} from "../lib/admin/content-shared.ts";
import {
  parsePostCreateBodyForTest,
  parsePostUpdateBodyForTest,
} from "../lib/admin/content-posts-parsers.ts";
import {
  buildPayloadPostCreateDataForTest,
  buildPayloadPostUpdateDataForTest,
} from "../lib/admin/content-posts-payload.ts";
import {
  parseCategoryCreateBodyForTest,
  parseCategoryUpdateBodyForTest,
} from "../lib/admin/content-categories-parsers.ts";
import { buildCategoryOptionsFindArgsForTest } from "../lib/admin/content-categories-options.ts";
import { buildCategoryLinkedPostsFindArgsForTest } from "../lib/admin/content-category-linked-posts.ts";

// ── Env setup (mirrors phase8-admin-listings-route.test.mts) ────────────────

function setupContentAdminEnv(t: TestContext): void {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousSiteUrl = process.env.SITE_URL;
  const previousPublicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const previousVercelUrl = process.env.VERCEL_URL;

  process.env.NODE_ENV = "test";
  delete process.env.SITE_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.VERCEL_URL;

  t.after(() => {
    restoreEnv("NODE_ENV", previousNodeEnv);
    restoreEnv("SITE_URL", previousSiteUrl);
    restoreEnv("NEXT_PUBLIC_SITE_URL", previousPublicSiteUrl);
    restoreEnv("VERCEL_URL", previousVercelUrl);
  });
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}

// ── Envelope guard helpers ──────────────────────────────────────────────────

function makeRequest(
  method: string,
  headers: Record<string, string>,
): Request {
  return new Request("http://localhost:3000/api/admin/content/posts", {
    method,
    headers,
    body: method !== "GET" && method !== "DELETE" ? "{}" : undefined,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. validateContentAdminJsonEnvelope — POST/PATCH guard
// ══════════════════════════════════════════════════════════════════════════════

test("content admin envelope rejects non-JSON content-type with 415", (t) => {
  setupContentAdminEnv(t);
  const req = makeRequest("POST", {
    "content-type": "text/plain",
    origin: "http://localhost:3000",
  });

  const result = validateContentAdminJsonEnvelope(req);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 415);
    assert.ok(result.error.includes("application/json"));
  }
});

test("content admin envelope rejects missing content-type with 415", (t) => {
  setupContentAdminEnv(t);
  const req = makeRequest("POST", {
    origin: "http://localhost:3000",
  });

  const result = validateContentAdminJsonEnvelope(req);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 415);
  }
});

test("content admin envelope rejects missing origin header with 403", (t) => {
  setupContentAdminEnv(t);
  const req = makeRequest("POST", {
    "content-type": "application/json",
  });

  const result = validateContentAdminJsonEnvelope(req);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 403);
    assert.ok(result.error.includes("Origin"));
  }
});

test("content admin envelope rejects untrusted origin with 403", (t) => {
  setupContentAdminEnv(t);
  const req = makeRequest("POST", {
    "content-type": "application/json",
    origin: "https://evil.example",
  });

  const result = validateContentAdminJsonEnvelope(req);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 403);
    assert.ok(result.error.includes("Origin"));
  }
});

test("content admin envelope accepts trusted origin and JSON content-type", (t) => {
  setupContentAdminEnv(t);
  const req = makeRequest("POST", {
    "content-type": "application/json",
    origin: "http://localhost:3000",
  });

  const result = validateContentAdminJsonEnvelope(req);
  assert.equal(result.ok, true);
});

test("content admin envelope accepts content-type with charset parameter", (t) => {
  setupContentAdminEnv(t);
  const req = makeRequest("PATCH", {
    "content-type": "application/json; charset=utf-8",
    origin: "http://localhost:3000",
  });

  const result = validateContentAdminJsonEnvelope(req);
  assert.equal(result.ok, true);
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. validateContentAdminOrigin — DELETE guard (no content-type check)
// ══════════════════════════════════════════════════════════════════════════════

test("content admin origin rejects missing origin header with 403", (t) => {
  setupContentAdminEnv(t);
  const req = makeRequest("DELETE", {});

  const result = validateContentAdminOrigin(req);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 403);
    assert.ok(result.error.includes("Origin"));
  }
});

test("content admin origin rejects untrusted origin with 403", (t) => {
  setupContentAdminEnv(t);
  const req = makeRequest("DELETE", {
    origin: "https://evil.example",
  });

  const result = validateContentAdminOrigin(req);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 403);
  }
});

test("content admin origin accepts trusted origin without content-type", (t) => {
  setupContentAdminEnv(t);
  const req = makeRequest("DELETE", {
    origin: "http://localhost:3000",
  });

  const result = validateContentAdminOrigin(req);
  assert.equal(result.ok, true);
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. Posts body parsers
// ══════════════════════════════════════════════════════════════════════════════

// ── Create ────────────────────────────────────────────────────────────────

test("parsePostCreateBody returns 400 for non-object body", () => {
  const result = parsePostCreateBodyForTest("not an object");
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 400);
    assert.equal(result.error, "Invalid request body");
  }
});

test("parsePostCreateBody returns 400 for array body", () => {
  const result = parsePostCreateBodyForTest([{ title: "T", slug: "t", content: "c" }]);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 400);
});

test("parsePostCreateBody returns 400 when title is missing", () => {
  const result = parsePostCreateBodyForTest({ slug: "t", content: "c" });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 400);
    assert.ok(result.error.includes("Title"));
  }
});

test("parsePostCreateBody auto-generates slug from title when slug is missing", () => {
  const result = parsePostCreateBodyForTest({ title: "My Post", content: "c" });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.slug, "my-post");
  }
});

test("parsePostCreateBody returns 400 when content is missing", () => {
  const result = parsePostCreateBodyForTest({ title: "T", slug: "t" });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 400);
    assert.ok(result.error.includes("Content"));
  }
});

test("parsePostCreateBody returns 400 when title is whitespace-only", () => {
  const result = parsePostCreateBodyForTest({ title: "   ", slug: "t", content: "c" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.includes("Title"));
});

test("parsePostCreateBody succeeds with title, slug, and content", () => {
  const result = parsePostCreateBodyForTest({ title: "My Post", slug: "my-post", content: "Body text" });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.title, "My Post");
    assert.equal(result.value.slug, "my-post");
    assert.equal(result.value.content, "Body text");
  }
});

test("parsePostCreateBody maps optional fields correctly", () => {
  const result = parsePostCreateBodyForTest({
    title: "T",
    slug: "t",
    content: "C",
    excerpt: "E",
    category: "cat-1",
    status: "published",
    publishedAt: "2025-01-01",
    coverImageUrl: "https://example.com/img.jpg",
    seoTitle: "SEO",
    seoDescription: "SEO desc",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.excerpt, "E");
    assert.equal(result.value.category, "cat-1");
    assert.equal(result.value.status, "published");
    assert.equal(result.value.seoTitle, "SEO");
  }
});

test("parsePostCreateBody coerces empty optional strings to null", () => {
  const result = parsePostCreateBodyForTest({
    title: "T",
    slug: "t",
    content: "C",
    excerpt: "   ",
    seoTitle: "",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.excerpt, null);
    assert.equal(result.value.seoTitle, null);
  }
});

// ── Update ────────────────────────────────────────────────────────────────

test("parsePostUpdateBody returns 400 for non-object body", () => {
  const result = parsePostUpdateBodyForTest(null);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 400);
});

test("parsePostUpdateBody returns 400 when no fields provided", () => {
  const result = parsePostUpdateBodyForTest({});
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.includes("No fields"));
});

test("parsePostUpdateBody returns 400 when title is empty string", () => {
  const result = parsePostUpdateBodyForTest({ title: "   " });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.includes("Title"));
});

test("parsePostUpdateBody returns 400 when slug is empty string", () => {
  const result = parsePostUpdateBodyForTest({ slug: "" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.toLowerCase().includes("slug"));
});

test("parsePostUpdateBody returns 400 when content is empty string", () => {
  const result = parsePostUpdateBodyForTest({ content: "" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.includes("Content"));
});

test("parsePostUpdateBody returns 400 for invalid status value", () => {
  const result = parsePostUpdateBodyForTest({ status: "archived" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.includes("Status"));
});

test("parsePostUpdateBody succeeds with valid title update", () => {
  const result = parsePostUpdateBodyForTest({ title: "Updated Title" });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.title, "Updated Title");
});

test("parsePostUpdateBody succeeds with partial update of optional fields", () => {
  const result = parsePostUpdateBodyForTest({
    excerpt: "new excerpt",
    status: "published",
    seoDescription: "new desc",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.excerpt, "new excerpt");
    assert.equal(result.value.status, "published");
    assert.equal(result.value.seoDescription, "new desc");
  }
});

test("parsePostUpdateBody trims whitespace from non-empty string fields", () => {
  const result = parsePostUpdateBodyForTest({ title: "  Trimmed  " });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.title, "Trimmed");
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. Categories body parsers
// ══════════════════════════════════════════════════════════════════════════════

// ── Create ────────────────────────────────────────────────────────────────

test("post create payload converts numeric category id strings for Payload relationship validation", () => {
  const data = buildPayloadPostCreateDataForTest({
    title: "Post",
    slug: "post",
    content: "Body",
    category: "42",
    status: "published",
    publishedAt: null,
    excerpt: null,
    coverImageUrl: null,
    seoTitle: null,
    seoDescription: null,
  });

  assert.equal(data.category, 42);
});

test("post update payload converts numeric category id strings and preserves null clears", () => {
  const withCategory = buildPayloadPostUpdateDataForTest({ category: "7" });
  assert.equal(withCategory.category, 7);

  const cleared = buildPayloadPostUpdateDataForTest({ category: null });
  assert.equal(cleared.category, null);
});

test("parseCategoryCreateBody returns 400 for non-object body", () => {
  const result = parseCategoryCreateBodyForTest("string");
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 400);
    assert.equal(result.error, "Invalid request body");
  }
});

test("parseCategoryCreateBody returns 400 for array body", () => {
  const result = parseCategoryCreateBodyForTest([{ title: "T", slug: "t" }]);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 400);
});

test("parseCategoryCreateBody returns 400 when title is missing", () => {
  const result = parseCategoryCreateBodyForTest({ slug: "t" });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 400);
    assert.ok(result.error.includes("Title"));
  }
});

test("parseCategoryCreateBody auto-generates slug from title when slug is missing", () => {
  const result = parseCategoryCreateBodyForTest({ title: "News" });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.slug, "news");
  }
});

test("parseCategoryCreateBody returns 400 when title is whitespace-only", () => {
  const result = parseCategoryCreateBodyForTest({ title: "   ", slug: "t" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.includes("Title"));
});

test("parseCategoryCreateBody auto-generates slug from title when slug is empty string", () => {
  const result = parseCategoryCreateBodyForTest({ title: "Tech", slug: "" });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.slug, "tech");
  }
});

test("parseCategoryCreateBody succeeds with title and slug", () => {
  const result = parseCategoryCreateBodyForTest({ title: "News", slug: "news" });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.title, "News");
    assert.equal(result.value.slug, "news");
  }
});

test("parseCategoryCreateBody maps optional fields correctly", () => {
  const result = parseCategoryCreateBodyForTest({
    title: "Tech",
    slug: "tech",
    description: "Technology posts",
    isActive: false,
    sortOrder: 5,
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.description, "Technology posts");
    assert.equal(result.value.isActive, false);
    assert.equal(result.value.sortOrder, 5);
  }
});

test("parseCategoryCreateBody coerces empty optional strings to null", () => {
  const result = parseCategoryCreateBodyForTest({
    title: "T",
    slug: "t",
    description: "   ",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.description, null);
  }
});

// ── Update ────────────────────────────────────────────────────────────────

test("parseCategoryUpdateBody returns 400 for non-object body", () => {
  const result = parseCategoryUpdateBodyForTest(null);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 400);
});

test("parseCategoryUpdateBody returns 400 when no fields provided", () => {
  const result = parseCategoryUpdateBodyForTest({});
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.includes("No fields"));
});

test("parseCategoryUpdateBody returns 400 when title is empty string", () => {
  const result = parseCategoryUpdateBodyForTest({ title: "   " });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.includes("Title"));
});

test("parseCategoryUpdateBody returns 400 when slug is empty string", () => {
  const result = parseCategoryUpdateBodyForTest({ slug: "" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.toLowerCase().includes("slug"));
});

test("parseCategoryUpdateBody returns 400 when sortOrder is a string", () => {
  const result = parseCategoryUpdateBodyForTest({ sortOrder: "five" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.includes("sortOrder"));
});

test("parseCategoryUpdateBody succeeds with valid title update", () => {
  const result = parseCategoryUpdateBodyForTest({ title: "Updated Category" });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.title, "Updated Category");
});

test("parseCategoryUpdateBody succeeds with partial update of optional fields", () => {
  const result = parseCategoryUpdateBodyForTest({
    description: "Updated desc",
    isActive: false,
    sortOrder: 10,
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.description, "Updated desc");
    assert.equal(result.value.isActive, false);
    assert.equal(result.value.sortOrder, 10);
  }
});

test("parseCategoryUpdateBody trims whitespace from non-empty string fields", () => {
  const result = parseCategoryUpdateBodyForTest({ title: "  Trimmed  " });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.title, "Trimmed");
});

test("category options query includes inactive categories for admin post forms", () => {
  const args = buildCategoryOptionsFindArgsForTest();

  assert.equal(args.collection, "blog_categories");
  assert.equal(args.limit, 500);
  assert.equal(args.sort, "sortOrder");
  assert.equal("where" in args, false);
});

test("category detail linked posts query uses relationship id and lightweight result bounds", () => {
  const args = buildCategoryLinkedPostsFindArgsForTest("42");

  assert.equal(args.collection, "blog_posts");
  assert.deepEqual(args.where, { category: { equals: 42 } });
  assert.equal(args.limit, 50);
  assert.equal(args.sort, "-updatedAt");
  assert.equal(args.depth, 0);
});

test("category detail DTO exposes total linked post count and delete warning", async () => {
  const { toCategoryDetailDTOForTest } = await import("../lib/admin/content-categories-dto.ts");

  const dto = toCategoryDetailDTOForTest(
    {
      id: 42,
      title: "Investment",
      slug: "investment",
      createdAt: "2024-01-01",
      updatedAt: "2024-01-02",
    },
    [
      { id: 1, title: "First", status: "published", updatedAt: "2024-02-01" },
    ],
    12,
  );

  assert.equal(dto.linkedPostCount, 12);
  assert.equal(dto.deleteWarning.hasLinkedPosts, true);
  assert.equal(dto.deleteWarning.linkedPostCount, 12);
  assert.ok(dto.deleteWarning.message?.includes("12"));
});
