// Phase 9A Task 6: Pure body-parsing functions for consultants route handler.
//
// Extracted from content-consultants-route.ts so they can be unit-tested
// without triggering the @payload-config side-effect (which requires env vars).
// The main handler re-exports these via the same signatures.
//
// Phase 9A auto-slug: slug is now optional in the UI payload; when omitted
// or empty, the parser auto-generates it from fullName via slugifyTitle.

import { slugifyTitle } from "./content-slugify.ts";

// ── Input types ─────────────────────────────────────────────────────────────

export type ConsultantCreateInput = {
  fullName: string;
  slug: string;
  title?: string | null;
  photoUrl?: string | null;
  shortBio?: string | null;
  phone?: string | null;
  email?: string | null;
  whatsappUrl?: string | null;
  linkedinUrl?: string | null;
  isPublished?: boolean;
  sortOrder?: number;
};

export type ConsultantUpdateInput = Partial<ConsultantCreateInput>;

// ── Helpers ─────────────────────────────────────────────────────────────────

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  return value.trim();
}

// ── Create parser ────────────────────────────────────────────────────────────

export function parseConsultantCreateBodyForTest(
  body: unknown,
):
  | { ok: true; value: ConsultantCreateInput }
  | { ok: false; status: number; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Invalid request body" };
  }

  const row = body as Record<string, unknown>;

  const fullName = asNonEmptyString(row.fullName);
  if (!fullName) return { ok: false, status: 400, error: "fullName is required" };

  // Auto-generate slug from fullName when not provided or empty.
  const rawSlug = asNonEmptyString(row.slug);
  const slug = rawSlug ?? slugifyTitle(fullName);
  if (!slug) return { ok: false, status: 400, error: "Slug is required" };

  return {
    ok: true,
    value: {
      fullName,
      slug,
      title: asNonEmptyString(row.title) ?? null,
      photoUrl: asNonEmptyString(row.photoUrl) ?? null,
      shortBio: asNonEmptyString(row.shortBio) ?? null,
      phone: asNonEmptyString(row.phone) ?? null,
      email: asNonEmptyString(row.email) ?? null,
      whatsappUrl: asNonEmptyString(row.whatsappUrl) ?? null,
      linkedinUrl: asNonEmptyString(row.linkedinUrl) ?? null,
      isPublished: typeof row.isPublished === "boolean" ? row.isPublished : undefined,
      sortOrder: typeof row.sortOrder === "number" ? row.sortOrder : undefined,
    },
  };
}

// ── Update parser ─────────────────────────────────────────────────────────────

export function parseConsultantUpdateBodyForTest(
  body: unknown,
):
  | { ok: true; value: ConsultantUpdateInput }
  | { ok: false; status: number; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Invalid request body" };
  }

  const row = body as Record<string, unknown>;
  const input: ConsultantUpdateInput = {};

  if ("fullName" in row) {
    const v = asNonEmptyString(row.fullName);
    if (!v) return { ok: false, status: 400, error: "fullName must not be empty" };
    input.fullName = v;
  }
  if ("slug" in row) {
    const v = asNonEmptyString(row.slug);
    if (!v) return { ok: false, status: 400, error: "Slug must not be empty" };
    input.slug = v;
  }
  if ("title" in row) input.title = asNonEmptyString(row.title) ?? null;
  if ("photoUrl" in row) input.photoUrl = asNonEmptyString(row.photoUrl) ?? null;
  if ("shortBio" in row) input.shortBio = asNonEmptyString(row.shortBio) ?? null;
  if ("phone" in row) input.phone = asNonEmptyString(row.phone) ?? null;
  if ("email" in row) input.email = asNonEmptyString(row.email) ?? null;
  if ("whatsappUrl" in row) input.whatsappUrl = asNonEmptyString(row.whatsappUrl) ?? null;
  if ("linkedinUrl" in row) input.linkedinUrl = asNonEmptyString(row.linkedinUrl) ?? null;
  if ("isPublished" in row) input.isPublished = !!row.isPublished;
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
