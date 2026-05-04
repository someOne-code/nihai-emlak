// Phase 9A Task 9: Categories UI helper utilities.
//
// Pure functions shared between the UI component and tests.
// No fetch, no React, no Next.js — importable anywhere.
// Mirrors content-posts-ui-helpers.ts pattern.

import { slugifyTitle } from "../admin/content-slugify.ts";

export { slugifyTitle };

// ── Empty state copy ─────────────────────────────────────────────────────────

export const CATEGORIES_EMPTY_TEXT = "Henüz kategori yok.";

export const CATEGORIES_FILTERED_EMPTY_TEXT =
  "Bu filtreyle eşleşen kategori bulunamadı.";

// ── Slug field UI copy ───────────────────────────────────────────────────────

/** Human-friendly label for the slug field (no raw "Slug" jargon). */
export const SLUG_FIELD_LABEL = "URL adı";

/** Helper text shown below the slug input. */
export const SLUG_FIELD_HELPER =
  "Başlıktan otomatik oluşur; gerekirse düzenleyebilirsiniz.";

// ── Active badge labels ──────────────────────────────────────────────────────

export const IS_ACTIVE_LABELS: Readonly<{ active: string; inactive: string }> =
  Object.freeze({
    active: "Aktif",
    inactive: "Pasif",
  });

// ── Auto-slug UX helpers ────────────────────────────────────────────────────

/**
 * Shape the UI form uses internally to track slug state.
 * Mirrors PostFormSlugState from posts helpers.
 */
export type CategoryFormSlugState = {
  slug: string;
  slugManuallyEdited: boolean;
};

/**
 * Compute the next slug state when the title changes.
 * If the slug has NOT been manually edited, regenerate from the new title.
 * If it HAS been manually edited, leave it alone.
 */
export function computeSlugFromTitle(
  title: string,
  currentState: CategoryFormSlugState,
): CategoryFormSlugState {
  if (currentState.slugManuallyEdited) {
    return currentState;
  }
  return {
    slug: slugifyTitle(title),
    slugManuallyEdited: false,
  };
}

/**
 * Compute the next slug state when the admin manually edits the slug field.
 */
export function computeSlugFromManualEdit(
  newSlug: string,
): CategoryFormSlugState {
  return {
    slug: newSlug,
    slugManuallyEdited: true,
  };
}

// ── Payload builders ────────────────────────────────────────────────────────

/**
 * Build the payload sent to POST /api/admin/content/categories.
 *
 * When slugManuallyEdited is false, the slug is sent as empty string
 * so the backend parser auto-generates it from title.
 */
export function buildCategoryCreatePayload(params: {
  title: string;
  slugState: CategoryFormSlugState;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}): Record<string, unknown> {
  return {
    title: params.title,
    slug: params.slugState.slugManuallyEdited ? params.slugState.slug : "",
    description: params.description ?? null,
    isActive: params.isActive ?? true,
    sortOrder: params.sortOrder ?? 0,
  };
}

/**
 * Build the payload sent to PATCH /api/admin/content/categories/[id].
 *
 * For updates, only provided fields are included.
 */
export function buildCategoryUpdatePayload(params: {
  title?: string;
  slug?: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (params.title !== undefined) payload.title = params.title;
  if (params.slug !== undefined) payload.slug = params.slug;
  if (params.description !== undefined) payload.description = params.description;
  if (params.isActive !== undefined) payload.isActive = params.isActive;
  if (params.sortOrder !== undefined) payload.sortOrder = params.sortOrder;
  return payload;
}
