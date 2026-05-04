// Phase 9A: Content image upload route handler.
//
// Shared handler for blog cover and consultant photo uploads.
//
// POST /api/admin/content/uploads/blog-cover
// POST /api/admin/content/uploads/consultant-photo
//
// Thin Next route boundary: admin auth guard, file validation, Supabase
// Storage upload orchestration. Does NOT use service_role; uses the
// authenticated admin's Supabase client.
//
// Mirrors lib/admin/content-shared.ts guard pattern.

import {
  validateImageMimeType,
  validateImageFileSize,
  validateImageFilename,
  buildSafeStoragePath,
} from "./content-upload-validators.ts";

import {
  guardContentAdminRequest,
  jsonError,
  jsonResponse,
  validateContentAdminOrigin,
  type ContentAdminRouteDependencies,
} from "./content-shared.ts";

// ── Constants ───────────────────────────────────────────────────────────────

/** Supabase Storage bucket for content media. */
export const CONTENT_MEDIA_BUCKET = "content-media";

// ── Extended Supabase client type for storage ───────────────────────────────

type StorageUploadResult = {
  error: { message: string } | null;
};

type StoragePublicUrlResult = {
  data: { publicUrl: string };
};

type StorageFromBucket = {
  upload: (
    path: string,
    file: Blob | ArrayBuffer,
    options?: { contentType?: string; upsert?: boolean },
  ) => Promise<StorageUploadResult>;
  getPublicUrl: (path: string) => StoragePublicUrlResult;
};

type SupabaseClientWithStorage = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: { message?: string } | null;
    }>;
  };
  from: (table: "profiles") => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{
          data: unknown;
          error: { code?: string | null; message?: string | null } | null;
        }>;
      };
    };
  };
  storage: {
    from: (bucket: string) => StorageFromBucket;
  };
};

// ── Shared route handler ────────────────────────────────────────────────────

async function handleContentImageUpload(
  request: Request,
  dependencies: ContentAdminRouteDependencies,
  storagePathPrefix: string,
): Promise<Response> {
  const originCheck = validateContentAdminOrigin(request);
  if (!originCheck.ok) {
    return jsonError(originCheck.error, originCheck.status);
  }

  // 1. Auth guard — reuses existing content admin pattern
  const guard = await guardContentAdminRequest(dependencies);
  if (!guard.ok) {
    return guard.response;
  }

  // 2. Parse multipart form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Geçersiz form verisi.", 400);
  }

  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return jsonError("Dosya alanı eksik veya geçersiz.", 400);
  }

  // 3. Extract metadata
  const filename = file instanceof File ? file.name : null;
  const mimeType = file.type;
  const sizeBytes = file.size;

  // 4. Validate file metadata
  const filenameResult = validateImageFilename(filename);
  if (!filenameResult.ok) {
    return jsonError(filenameResult.error, 400);
  }

  const mimeResult = validateImageMimeType(mimeType);
  if (!mimeResult.ok) {
    return jsonError(mimeResult.error, 400);
  }

  const sizeResult = validateImageFileSize(sizeBytes);
  if (!sizeResult.ok) {
    return jsonError(sizeResult.error, 400);
  }

  // 5. Build safe storage path
  const storagePath = buildSafeStoragePath(filename!, storagePathPrefix);

  // 6. Upload to Supabase Storage
  const supabase = guard.supabase as unknown as SupabaseClientWithStorage;
  const bucket = supabase.storage.from(CONTENT_MEDIA_BUCKET);

  // Convert to ArrayBuffer for broad Supabase Storage client compat
  let fileBuffer: ArrayBuffer;
  try {
    fileBuffer = await file.arrayBuffer();
  } catch {
    return jsonError("Dosya okunamadı.", 400);
  }

  const STORAGE_TIMEOUT_MS = 15_000;
  const uploadResult = await Promise.race([
    bucket.upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    }),
    new Promise<{ error: { message: string } }>((resolve) =>
      setTimeout(() => resolve({ error: { message: "Storage upload timed out" } }), STORAGE_TIMEOUT_MS),
    ),
  ]);

  if (uploadResult.error) {
    // Do NOT leak raw Supabase error to client
    const msg = uploadResult.error.message ?? "";
    console.error("[content-upload] Storage upload error:", msg);

    // Provide a more specific hint if bucket is missing
    const isBucketError =
      msg.toLowerCase().includes("bucket") ||
      msg.toLowerCase().includes("not found") ||
      msg.toLowerCase().includes("does not exist");
    if (isBucketError) {
      console.error(
        `[content-upload] Bucket "${CONTENT_MEDIA_BUCKET}" may not exist. ` +
        `Create it in Supabase Dashboard or run "supabase db reset" for local dev.`,
      );
    }

    return jsonError("Görsel yüklenirken bir hata oluştu. Lütfen tekrar deneyin.", 500);
  }

  // 7. Get public URL
  const { data: publicUrlData } = bucket.getPublicUrl(storagePath);

  return jsonResponse(
    {
      success: true,
      data: {
        url: publicUrlData.publicUrl,
        path: storagePath,
        bucket: CONTENT_MEDIA_BUCKET,
      },
    },
    200,
  );
}

// ── Public handlers ─────────────────────────────────────────────────────────

export async function handleBlogCoverUpload(
  request: Request,
  dependencies: ContentAdminRouteDependencies,
): Promise<Response> {
  return handleContentImageUpload(request, dependencies, "blog-covers");
}

export async function handleConsultantPhotoUpload(
  request: Request,
  dependencies: ContentAdminRouteDependencies,
): Promise<Response> {
  return handleContentImageUpload(request, dependencies, "consultants/photos");
}

export async function handleListingImageUpload(
  request: Request,
  dependencies: ContentAdminRouteDependencies,
): Promise<Response> {
  return handleContentImageUpload(request, dependencies, "listing-images");
}
