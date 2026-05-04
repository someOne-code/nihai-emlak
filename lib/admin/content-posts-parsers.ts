// Phase 9A Hardening: Pure body-parsing functions for posts route handler.
//
// Extracted from content-posts-route.ts so they can be unit-tested
// without triggering the @payload-config side-effect (which requires env vars).
// Mirrors content-consultants-parsers.ts pattern exactly.
//
// Phase 9A auto-slug: slug is now optional in the UI payload; when omitted
// or empty, the parser auto-generates it from title via slugifyTitle.

import { slugifyTitle } from "./content-slugify.ts";

// ── Input types ─────────────────────────────────────────────────────────────

export type PostCreateInput = {
  title: string;
  slug: string;
  excerpt?: string | null;
  content: string;
  category?: string | null;
  status?: "draft" | "published";
  publishedAt?: string | null;
  coverImageUrl?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
};

export type PostUpdateInput = Partial<PostCreateInput>;

// ── Helpers ─────────────────────────────────────────────────────────────────

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  return value.trim();
}

// ── Create parser ───────────────────────────────────────────────────────────

export function parsePostCreateBodyForTest(
  body: unknown,
):
  | { ok: true; value: PostCreateInput }
  | { ok: false; status: number; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Invalid request body" };
  }

  const row = body as Record<string, unknown>;

  const title = asNonEmptyString(row.title);
  if (!title) {
    return { ok: false, status: 400, error: "Title is required" };
  }

  // Auto-generate slug from title when not provided or empty.
  // The UI sends slug="" when the user hasn't manually edited it.
  const rawSlug = asNonEmptyString(row.slug);
  const slug = rawSlug ?? slugifyTitle(title);
  if (!slug) {
    return { ok: false, status: 400, error: "Slug is required" };
  }

  const content = asNonEmptyString(row.content);
  if (!content) {
    return { ok: false, status: 400, error: "Content is required" };
  }

  const status = row.status === "draft" || row.status === "published"
    ? row.status
    : undefined;

  return {
    ok: true,
    value: {
      title,
      slug,
      excerpt: asNonEmptyString(row.excerpt) ?? null,
      content,
      category: asNonEmptyString(row.category) ?? null,
      status,
      publishedAt: asNonEmptyString(row.publishedAt) ?? null,
      coverImageUrl: asNonEmptyString(row.coverImageUrl) ?? null,
      seoTitle: asNonEmptyString(row.seoTitle) ?? null,
      seoDescription: asNonEmptyString(row.seoDescription) ?? null,
    },
  };
}

// ── Update parser ───────────────────────────────────────────────────────────

export function parsePostUpdateBodyForTest(
  body: unknown,
):
  | { ok: true; value: PostUpdateInput }
  | { ok: false; status: number; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Invalid request body" };
  }

  const row = body as Record<string, unknown>;

  const input: PostUpdateInput = {};

  if ("title" in row) {
    const v = asNonEmptyString(row.title);
    if (!v) return { ok: false, status: 400, error: "Title must not be empty" };
    input.title = v;
  }
  if ("slug" in row) {
    const v = asNonEmptyString(row.slug);
    if (!v) return { ok: false, status: 400, error: "Slug must not be empty" };
    input.slug = v;
  }
  if ("excerpt" in row) input.excerpt = asNonEmptyString(row.excerpt) ?? null;
  if ("content" in row) {
    const v = asNonEmptyString(row.content);
    if (!v) return { ok: false, status: 400, error: "Content must not be empty" };
    input.content = v;
  }
  if ("category" in row) input.category = asNonEmptyString(row.category) ?? null;
  if ("status" in row) {
    const v = row.status;
    if (v !== "draft" && v !== "published") {
      return { ok: false, status: 400, error: "Status must be draft or published" };
    }
    input.status = v;
  }
  if ("publishedAt" in row) input.publishedAt = asNonEmptyString(row.publishedAt) ?? null;
  if ("coverImageUrl" in row) input.coverImageUrl = asNonEmptyString(row.coverImageUrl) ?? null;
  if ("seoTitle" in row) input.seoTitle = asNonEmptyString(row.seoTitle) ?? null;
  if ("seoDescription" in row) input.seoDescription = asNonEmptyString(row.seoDescription) ?? null;

  if (Object.keys(input).length === 0) {
    return { ok: false, status: 400, error: "No fields to update" };
  }

  return { ok: true, value: input };
}
