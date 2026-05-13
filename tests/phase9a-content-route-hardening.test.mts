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
import { readFileSync } from "node:fs";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";

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
import { buildCategoriesListFindArgsForTest } from "../lib/admin/content-categories-query.ts";
import { buildCategoryLinkedPostsFindArgsForTest } from "../lib/admin/content-category-linked-posts.ts";

const OVERSIZED_CONTENT_ADMIN_JSON_BYTES = 256 * 1024 + 1;
const PROJECT_ROOT = fileURLToPath(new URL("..", import.meta.url));

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

function extractPayloadObjectCalls(source: string): string[] {
  const calls: string[] = [];
  const pattern = /payload\.(find|findByID|create|update|delete)\(\s*\{/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const objectStart = source.indexOf("{", match.index);
    let depth = 0;
    let index = objectStart;
    for (; index < source.length; index += 1) {
      const char = source[index];
      if (char === "{") depth += 1;
      if (char === "}") depth -= 1;
      if (depth === 0) {
        calls.push(source.slice(match.index, index + 1));
        break;
      }
    }
  }

  return calls;
}

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

class JsonSpyRequest extends Request {
  jsonCalls = 0;

  constructor(url: string, contentLength: number) {
    super(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(contentLength),
        origin: "http://localhost:3000",
      },
      body: "x".repeat(contentLength),
    });
  }

  override async json(): Promise<unknown> {
    this.jsonCalls += 1;
    return {};
  }
}

function createAuthSpyDependencies(authCalls: { count: number }) {
  return {
    createServerSupabaseClient: async () => {
      authCalls.count += 1;
      return {
        auth: {
          getUser: async () => ({ data: { user: null }, error: null }),
        },
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      };
    },
  };
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

test("content admin Payload Local API object calls declare overrideAccess explicitly", () => {
  const files = [
    "lib/admin/content-posts-route.ts",
    "lib/admin/content-categories-route.ts",
    "lib/admin/content-consultants-route.ts",
  ];

  for (const file of files) {
    const source = readFileSync(`${PROJECT_ROOT}/${file}`, "utf8");
    const calls = extractPayloadObjectCalls(source);
    assert.ok(calls.length > 0, `${file} should contain Payload Local API calls`);

    for (const call of calls) {
      assert.match(
        call,
        /\boverrideAccess\s*:/,
        `${file} Payload Local API call must set overrideAccess explicitly:\n${call}`,
      );
    }
  }
});

test("posts create rejects oversized JSON before auth and request.json", async (t) => {
  setupContentAdminEnv(t);
  const { handlePostsCreatePost } = await import("../lib/admin/content-posts-route.ts");

  const request = new JsonSpyRequest(
    "http://localhost:3000/api/admin/content/posts",
    OVERSIZED_CONTENT_ADMIN_JSON_BYTES,
  );
  const authCalls = { count: 0 };

  const response = await handlePostsCreatePost(
    request,
    createAuthSpyDependencies(authCalls),
  );

  assert.equal(response.status, 413);
  assert.equal(authCalls.count, 0, "auth must not run for oversized JSON");
  assert.equal(request.jsonCalls, 0, "request.json must not be called for oversized JSON");
});

test("posts update rejects oversized JSON before auth and request.json", async (t) => {
  setupContentAdminEnv(t);
  const { handlePostUpdate } = await import("../lib/admin/content-posts-route.ts");

  const request = new JsonSpyRequest(
    "http://localhost:3000/api/admin/content/posts/post-1",
    OVERSIZED_CONTENT_ADMIN_JSON_BYTES,
  );
  const authCalls = { count: 0 };

  const response = await handlePostUpdate(
    request,
    createAuthSpyDependencies(authCalls),
    "post-1",
  );

  assert.equal(response.status, 413);
  assert.equal(authCalls.count, 0, "auth must not run for oversized JSON");
  assert.equal(request.jsonCalls, 0, "request.json must not be called for oversized JSON");
});

test("consultants create rejects oversized JSON before auth and request.json", async (t) => {
  setupContentAdminEnv(t);
  const { handleConsultantsCreatePost } = await import("../lib/admin/content-consultants-route.ts");

  const request = new JsonSpyRequest(
    "http://localhost:3000/api/admin/content/consultants",
    OVERSIZED_CONTENT_ADMIN_JSON_BYTES,
  );
  const authCalls = { count: 0 };

  const response = await handleConsultantsCreatePost(
    request,
    createAuthSpyDependencies(authCalls),
  );

  assert.equal(response.status, 413);
  assert.equal(authCalls.count, 0, "auth must not run for oversized JSON");
  assert.equal(request.jsonCalls, 0, "request.json must not be called for oversized JSON");
});

test("consultants update rejects oversized JSON before auth and request.json", async (t) => {
  setupContentAdminEnv(t);
  const { handleConsultantUpdate } = await import("../lib/admin/content-consultants-route.ts");

  const request = new JsonSpyRequest(
    "http://localhost:3000/api/admin/content/consultants/consultant-1",
    OVERSIZED_CONTENT_ADMIN_JSON_BYTES,
  );
  const authCalls = { count: 0 };

  const response = await handleConsultantUpdate(
    request,
    createAuthSpyDependencies(authCalls),
    "consultant-1",
  );

  assert.equal(response.status, 413);
  assert.equal(authCalls.count, 0, "auth must not run for oversized JSON");
  assert.equal(request.jsonCalls, 0, "request.json must not be called for oversized JSON");
});

test("categories create rejects oversized JSON before auth and request.json", async (t) => {
  setupContentAdminEnv(t);
  const { handleCategoriesCreatePost } = await import("../lib/admin/content-categories-route.ts");

  const request = new JsonSpyRequest(
    "http://localhost:3000/api/admin/content/categories",
    OVERSIZED_CONTENT_ADMIN_JSON_BYTES,
  );
  const authCalls = { count: 0 };

  const response = await handleCategoriesCreatePost(
    request,
    createAuthSpyDependencies(authCalls),
  );

  assert.equal(response.status, 413);
  assert.equal(authCalls.count, 0, "auth must not run for oversized JSON");
  assert.equal(request.jsonCalls, 0, "request.json must not be called for oversized JSON");
});

test("categories update rejects oversized JSON before auth and request.json", async (t) => {
  setupContentAdminEnv(t);
  const { handleCategoryUpdate } = await import("../lib/admin/content-categories-route.ts");

  const request = new JsonSpyRequest(
    "http://localhost:3000/api/admin/content/categories/category-1",
    OVERSIZED_CONTENT_ADMIN_JSON_BYTES,
  );
  const authCalls = { count: 0 };

  const response = await handleCategoryUpdate(
    request,
    createAuthSpyDependencies(authCalls),
    "category-1",
  );

  assert.equal(response.status, 413);
  assert.equal(authCalls.count, 0, "auth must not run for oversized JSON");
  assert.equal(request.jsonCalls, 0, "request.json must not be called for oversized JSON");
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
  assert.equal(args.overrideAccess, true);
});

test("buildCategoriesListFindArgs selects only fields needed for instant category editing", () => {
  const args = buildCategoriesListFindArgsForTest(1, 20);

  assert.equal(args.collection, "blog_categories");
  assert.equal(args.depth, 0);
  assert.equal(args.sort, "sortOrder");
  assert.equal(args.select.title, true);
  assert.equal(args.select.description, true);
  assert.equal(args.select.updatedAt, true);
  assert.equal(args.overrideAccess, true);
});

test("category detail linked posts query uses relationship id and lightweight result bounds", () => {
  const args = buildCategoryLinkedPostsFindArgsForTest("42");

  assert.equal(args.collection, "blog_posts");
  assert.deepEqual(args.where, { category: { equals: 42 } });
  assert.equal(args.limit, 50);
  assert.equal(args.sort, "-updatedAt");
  assert.equal(args.depth, 0);
  assert.equal(args.overrideAccess, true);
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
