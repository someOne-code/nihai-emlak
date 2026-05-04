// Phase 9A: Pure upload validation helpers for content admin image uploads.
//
// Side-effect-free functions that validate file metadata (MIME type, size,
// filename). Extracted so they are testable without network or storage deps.
//
// Used by content-upload-route.ts for blog cover image upload.

// ── Constants ───────────────────────────────────────────────────────────────

/** Allowed MIME types for content admin image uploads. */
export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/** Maximum file size in bytes (5 MB). */
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

/** Human-readable max size label for error messages. */
export const MAX_IMAGE_SIZE_LABEL = "5 MB";

// ── Validation result type ──────────────────────────────────────────────────

export type UploadValidationResult =
  | { ok: true }
  | { ok: false; error: string };

// ── Validators ──────────────────────────────────────────────────────────────

/**
 * Validate that a MIME type is in the allowed set.
 */
export function validateImageMimeType(mimeType: string): UploadValidationResult {
  if (!mimeType || typeof mimeType !== "string") {
    return { ok: false, error: "Dosya türü belirlenemedi." };
  }
  const normalized = mimeType.trim().toLowerCase();
  if (!ALLOWED_IMAGE_MIME_TYPES.has(normalized)) {
    return {
      ok: false,
      error: `Desteklenmeyen dosya türü: ${normalized}. Kabul edilen: JPEG, PNG, WebP.`,
    };
  }
  return { ok: true };
}

/**
 * Validate that file size is within the allowed limit.
 */
export function validateImageFileSize(sizeBytes: number): UploadValidationResult {
  if (typeof sizeBytes !== "number" || sizeBytes <= 0 || !Number.isFinite(sizeBytes)) {
    return { ok: false, error: "Geçersiz dosya boyutu." };
  }
  if (sizeBytes > MAX_IMAGE_SIZE_BYTES) {
    return {
      ok: false,
      error: `Dosya çok büyük (${formatFileSize(sizeBytes)}). Maksimum: ${MAX_IMAGE_SIZE_LABEL}.`,
    };
  }
  return { ok: true };
}

/**
 * Validate that a filename is present and non-empty.
 */
export function validateImageFilename(filename: string | null | undefined): UploadValidationResult {
  if (!filename || typeof filename !== "string" || filename.trim().length === 0) {
    return { ok: false, error: "Dosya adı eksik." };
  }
  return { ok: true };
}

/**
 * Generate a safe storage path for a blog cover image.
 *
 * Pattern: blog-covers/{timestamp}-{random}-{safe-filename}
 * Does NOT trust raw filename directly.
 */
export function buildSafeStoragePath(originalFilename: string, prefix: string = "blog-covers"): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const safe = sanitizeFilename(originalFilename);
  return `${prefix}/${timestamp}-${random}-${safe}`;
}

/**
 * Sanitize a filename: lowercase, replace non-alphanumeric with hyphens,
 * collapse consecutive hyphens, trim hyphens, keep extension.
 */
export function sanitizeFilename(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length === 0) return "upload";

  // Split into name and extension
  const lastDot = trimmed.lastIndexOf(".");
  const name = lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed;
  const ext = lastDot > 0 ? trimmed.slice(lastDot) : "";

  // Sanitize name part
  let sanitized = "";
  let lastWasHyphen = false;
  for (const ch of name) {
    if ((ch >= "a" && ch <= "z") || (ch >= "0" && ch <= "9")) {
      sanitized += ch;
      lastWasHyphen = false;
    } else if (!lastWasHyphen && sanitized.length > 0) {
      sanitized += "-";
      lastWasHyphen = true;
    }
  }
  sanitized = sanitized.replace(/-+$/, "");
  if (sanitized.length === 0) sanitized = "upload";

  return sanitized + ext;
}

// ── Internal helpers ────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
