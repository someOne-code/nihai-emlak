// Phase 9A Task 10: Consultants UI helper utilities.
//
// Pure functions shared between the UI component and tests.
// No fetch, no React, no Next.js — importable anywhere.
// Mirrors content-categories-ui-helpers.ts pattern.

import { slugifyTitle } from "../admin/content-slugify.ts";

export { slugifyTitle };

// ── Empty state copy ─────────────────────────────────────────────────────────

export const CONSULTANTS_EMPTY_TEXT = "Henüz danışman yok.";

export const CONSULTANTS_FILTERED_EMPTY_TEXT =
  "Bu filtreyle eşleşen danışman bulunamadı.";

// ── Slug field UI copy ───────────────────────────────────────────────────────

/** Human-friendly label for the slug field. */
export const SLUG_FIELD_LABEL = "URL adı";

/** Helper text shown below the slug input. Auto-generation source is fullName. */
export const SLUG_FIELD_HELPER =
  "Addan otomatik oluşur; gerekirse düzenleyebilirsiniz.";

// ── Publish badge labels ─────────────────────────────────────────────────────

export const IS_PUBLISHED_LABELS: Readonly<{ published: string; draft: string }> =
  Object.freeze({
    published: "Yayında",
    draft: "Taslak",
  });

// ── Photo field UI copy ──────────────────────────────────────────────────────

/** Photo field label. Upload-first UX — no URL jargon. */
export const PHOTO_FIELD_LABEL = "Fotoğraf";

/** Button text when no photo is uploaded yet. */
export const PHOTO_UPLOAD_TEXT = "Fotoğraf yükle";

/** Button text when replacing an existing photo. */
export const PHOTO_REPLACE_TEXT = "Fotoğrafı değiştir";

/** Allowed formats and size limit summary shown as helper text. */
export const PHOTO_HELPER_TEXT = "JPEG, PNG veya WebP · Maks. 5 MB · Fotoğraf yükleyerek ekleyin";

/** Alias for helper text — matches posts COVER_IMAGE_FILE_RULES convention. */
export const PHOTO_FILE_RULES = PHOTO_HELPER_TEXT;

/** Status text shown after a successful upload. */
export const PHOTO_UPLOADED_STATUS = "Fotoğraf yüklendi";

// ── Auto-slug UX helpers ────────────────────────────────────────────────────

/**
 * Slug state shape mirroring posts/categories pattern. The trigger source
 * for auto-generation is fullName for consultants.
 */
export type ConsultantFormSlugState = {
  slug: string;
  slugManuallyEdited: boolean;
};

/**
 * Compute next slug state when fullName changes. If admin has manually
 * edited the slug, leave it alone; otherwise regenerate from the new name.
 */
export function computeSlugFromFullName(
  fullName: string,
  currentState: ConsultantFormSlugState,
): ConsultantFormSlugState {
  if (currentState.slugManuallyEdited) {
    return currentState;
  }
  return {
    slug: slugifyTitle(fullName),
    slugManuallyEdited: false,
  };
}

/** Compute next slug state when admin manually edits the slug field. */
export function computeSlugFromManualEdit(
  newSlug: string,
): ConsultantFormSlugState {
  return {
    slug: newSlug,
    slugManuallyEdited: true,
  };
}

// ── Payload builders ────────────────────────────────────────────────────────

/**
 * Build the payload sent to POST /api/admin/content/consultants.
 *
 * When slugManuallyEdited is false, slug is sent as empty string so the
 * backend parser auto-generates it from fullName via slugifyTitle.
 */
export function buildConsultantCreatePayload(params: {
  fullName: string;
  slugState: ConsultantFormSlugState;
  title?: string | null;
  photoUrl?: string | null;
  shortBio?: string | null;
  phone?: string | null;
  email?: string | null;
  whatsappUrl?: string | null;
  linkedinUrl?: string | null;
  isPublished?: boolean;
  sortOrder?: number;
}): Record<string, unknown> {
  return {
    fullName: params.fullName,
    slug: params.slugState.slugManuallyEdited ? params.slugState.slug : "",
    title: params.title ?? null,
    photoUrl: params.photoUrl ?? null,
    shortBio: params.shortBio ?? null,
    phone: params.phone ?? null,
    email: params.email ?? null,
    whatsappUrl: params.whatsappUrl ?? null,
    linkedinUrl: params.linkedinUrl ?? null,
    isPublished: params.isPublished ?? false,
    sortOrder: params.sortOrder ?? 0,
  };
}

/** Build payload for PATCH /api/admin/content/consultants/[id]. Only includes provided fields. */
export function buildConsultantUpdatePayload(params: {
  fullName?: string;
  slug?: string;
  title?: string | null;
  photoUrl?: string | null;
  shortBio?: string | null;
  phone?: string | null;
  email?: string | null;
  whatsappUrl?: string | null;
  linkedinUrl?: string | null;
  isPublished?: boolean;
  sortOrder?: number;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (params.fullName !== undefined) payload.fullName = params.fullName;
  if (params.slug !== undefined) payload.slug = params.slug;
  if (params.title !== undefined) payload.title = params.title;
  if (params.photoUrl !== undefined) payload.photoUrl = params.photoUrl;
  if (params.shortBio !== undefined) payload.shortBio = params.shortBio;
  if (params.phone !== undefined) payload.phone = params.phone;
  if (params.email !== undefined) payload.email = params.email;
  if (params.whatsappUrl !== undefined) payload.whatsappUrl = params.whatsappUrl;
  if (params.linkedinUrl !== undefined) payload.linkedinUrl = params.linkedinUrl;
  if (params.isPublished !== undefined) payload.isPublished = params.isPublished;
  if (params.sortOrder !== undefined) payload.sortOrder = params.sortOrder;
  return payload;
}
