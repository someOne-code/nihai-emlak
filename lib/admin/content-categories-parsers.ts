// Phase 9A Hardening: Pure body-parsing functions for categories route handler.
//
// Extracted from content-categories-route.ts so they can be unit-tested
// without triggering the @payload-config side-effect (which requires env vars).
// Mirrors content-consultants-parsers.ts pattern exactly.
//
// Phase 9A auto-slug: slug is now optional in the UI payload; when omitted
// or empty, the parser auto-generates it from title via slugifyTitle.

import { slugifyTitle } from "./content-slugify.ts";

// ── Input types ─────────────────────────────────────────────────────────────

export type CategoryCreateInput = {
  title: string;
  slug: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
};

export type CategoryUpdateInput = Partial<CategoryCreateInput>;

// ── Helpers ─────────────────────────────────────────────────────────────────

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  return value.trim();
}

// ── Create parser ───────────────────────────────────────────────────────────

export function parseCategoryCreateBodyForTest(
  body: unknown,
):
  | { ok: true; value: CategoryCreateInput }
  | { ok: false; status: number; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Invalid request body" };
  }

  const row = body as Record<string, unknown>;

  const title = asNonEmptyString(row.title);
  if (!title) return { ok: false, status: 400, error: "Title is required" };

  // Auto-generate slug from title when not provided or empty.
  const rawSlug = asNonEmptyString(row.slug);
  const slug = rawSlug ?? slugifyTitle(title);
  if (!slug) return { ok: false, status: 400, error: "Slug is required" };

  return {
    ok: true,
    value: {
      title,
      slug,
      description: asNonEmptyString(row.description) ?? null,
      isActive: typeof row.isActive === "boolean" ? row.isActive : undefined,
      sortOrder: typeof row.sortOrder === "number" ? row.sortOrder : undefined,
    },
  };
}

// ── Update parser ───────────────────────────────────────────────────────────

export function parseCategoryUpdateBodyForTest(
  body: unknown,
):
  | { ok: true; value: CategoryUpdateInput }
  | { ok: false; status: number; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Invalid request body" };
  }

  const row = body as Record<string, unknown>;
  const input: CategoryUpdateInput = {};

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
  if ("description" in row) input.description = asNonEmptyString(row.description) ?? null;
  if ("isActive" in row) input.isActive = !!row.isActive;
  if ("sortOrder" in row) {
    if (typeof row.sortOrder !== "number") {
      return { ok: false, status: 400, error: "sortOrder must be a number" };
    }
    input.sortOrder = row.sortOrder;
  }

  if (Object.keys(input).length === 0) {
    return { ok: false, status: 400, error: "No fields to update" };
  }

  return { ok: true, value: input };
}
