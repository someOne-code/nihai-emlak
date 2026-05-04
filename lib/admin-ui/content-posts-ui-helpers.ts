// Phase 9A Task 8: Posts UI helper utilities.
//
// Pure functions shared between the client, the UI component filter bar,
// and tests. No fetch, no React, no Next.js — importable anywhere.
//
// Mirrors the filter URL builder pattern from listings-client.ts.
//
// Phase 9A auto-slug: added slugifyTitle re-export and buildPostCreatePayload
// helper so the UI can auto-generate slugs from titles without knowing the
// normalization rules.

import { slugifyTitle } from "../admin/content-slugify.ts";

export { slugifyTitle };

export type PostsListFilters = {
  search?: string;
  status?: "draft" | "published";
  category?: string;
  page?: number;
  limit?: number;
};

export function buildPostsUrl(filters: PostsListFilters): string {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.category) params.set("category", filters.category);
  if (filters.page !== undefined) params.set("page", String(filters.page));
  if (filters.limit !== undefined) params.set("limit", String(filters.limit));
  const q = params.toString();
  return q ? `/api/admin/content/posts?${q}` : "/api/admin/content/posts";
}

// Status options used by the filter bar and the edit form select.
export type PostStatusFilter = "" | "draft" | "published";

export const POST_STATUS_OPTIONS: ReadonlyArray<{
  value: PostStatusFilter;
  label: string;
}> = Object.freeze([
  Object.freeze({ value: "" as const, label: "Tüm durumlar" }),
  Object.freeze({ value: "published" as const, label: "Yayında" }),
  Object.freeze({ value: "draft" as const, label: "Taslak" }),
]);

// Status options for the create/edit form (no empty option).
export const POST_STATUS_FORM_OPTIONS: ReadonlyArray<{
  value: "draft" | "published";
  label: string;
}> = Object.freeze([
  Object.freeze({ value: "draft" as const, label: "Taslak" }),
  Object.freeze({ value: "published" as const, label: "Yayında" }),
]);

// Empty state text for the posts list.
export const POSTS_EMPTY_TEXT = "Henüz blog yazısı yok.";

// Empty state text when a filter is active.
export const POSTS_FILTERED_EMPTY_TEXT = "Bu filtreyle eşleşen yazı bulunamadı.";

// ── Slug field UI copy ─────────────────────────────────────────────────────

/** Human-friendly label for the slug field (no raw "Slug" jargon). */
export const SLUG_FIELD_LABEL = "URL adı";

/** Helper text shown below the slug input. */
export const SLUG_FIELD_HELPER = "Başlıktan otomatik oluşur; gerekirse düzenleyebilirsiniz.";

// ── Cover image upload UI copy ────────────────────────────────────────────

/** Label for the cover image field. No URL jargon — admin uploads files. */
export const COVER_IMAGE_FIELD_LABEL = "Kapak görseli";

/** Button text when no image is selected yet. */
export const COVER_IMAGE_UPLOAD_TEXT = "Kapak görseli yükle";

/** Button text when replacing an existing image. */
export const COVER_IMAGE_REPLACE_TEXT = "Görseli değiştir";

/**
 * Helper hint shown next to the preview that explains the public-cover ratio
 * convention. The admin preview intentionally matches the future public
 * frontend `aspect-video + object-cover` framing.
 */
export const COVER_IMAGE_RATIO_HINT =
  "Blog kapağı sitede bu oranla görünecek. Yatay görsel önerilir.";

/** Allowed formats and size limit summary. */
export const COVER_IMAGE_FILE_RULES = "JPEG, PNG veya WebP · Maks. 5 MB";

/** Status text shown after a successful upload. */
export const COVER_IMAGE_UPLOADED_STATUS = "Kapak görseli yüklendi";

// ── SEO field UI copy ─────────────────────────────────────────────────────

/** Helper text below the SEO title input. */
export const SEO_TITLE_HELPER = "Boş bırakırsanız yazı başlığı kullanılır.";

/** Helper text below the SEO description input. */
export const SEO_DESCRIPTION_HELPER = "Boş bırakırsanız özet metni kullanılır.";

// ── Auto-slug UX helpers ───────────────────────────────────────────────────

/**
 * Shape the UI form uses internally to track slug state.
 *
 * - `slugManuallyEdited`: starts false; set to true when the admin
 *   types into the slug field. Once true, auto-generation stops.
 * - `slug`: the current slug value (auto-generated or manually entered).
 */
export type PostFormSlugState = {
  slug: string;
  slugManuallyEdited: boolean;
};

/**
 * Compute the next slug state when the title changes.
 *
 * If the slug has NOT been manually edited, regenerate from the new title.
 * If it HAS been manually edited, leave it alone.
 */
export function computeSlugFromTitle(
  title: string,
  currentState: PostFormSlugState,
): PostFormSlugState {
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
): PostFormSlugState {
  return {
    slug: newSlug,
    slugManuallyEdited: true,
  };
}

/**
 * Build the payload sent to POST /api/admin/content/posts.
 *
 * When slugManuallyEdited is false, the slug is sent as empty string
 * so the backend parser auto-generates it from title. This keeps the
 * auto-generation logic server-side and testable.
 */
export function buildPostCreatePayload(params: {
  title: string;
  slugState: PostFormSlugState;
  content: string;
  excerpt?: string | null;
  category?: string | null;
  status?: "draft" | "published";
  publishedAt?: string | null;
  coverImageUrl?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
}): Record<string, unknown> {
  return {
    title: params.title,
    slug: params.slugState.slugManuallyEdited ? params.slugState.slug : "",
    excerpt: params.excerpt ?? null,
    content: params.content,
    category: params.category ?? null,
    status: params.status ?? "draft",
    publishedAt: params.publishedAt ?? null,
    coverImageUrl: params.coverImageUrl ?? null,
    seoTitle: params.seoTitle ?? null,
    seoDescription: params.seoDescription ?? null,
  };
}

/**
 * Build the payload sent to PATCH /api/admin/content/posts/[id].
 *
 * For updates, the slug is always sent explicitly (the admin can change it).
 */
export function buildPostUpdatePayload(params: {
  title?: string;
  slug?: string;
  content?: string;
  excerpt?: string | null;
  category?: string | null;
  status?: "draft" | "published";
  publishedAt?: string | null;
  coverImageUrl?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (params.title !== undefined) payload.title = params.title;
  if (params.slug !== undefined) payload.slug = params.slug;
  if (params.excerpt !== undefined) payload.excerpt = params.excerpt;
  if (params.content !== undefined) payload.content = params.content;
  if (params.category !== undefined) payload.category = params.category;
  if (params.status !== undefined) payload.status = params.status;
  if (params.publishedAt !== undefined) payload.publishedAt = params.publishedAt;
  if (params.coverImageUrl !== undefined) payload.coverImageUrl = params.coverImageUrl;
  if (params.seoTitle !== undefined) payload.seoTitle = params.seoTitle;
  if (params.seoDescription !== undefined) payload.seoDescription = params.seoDescription;
  return payload;
}
