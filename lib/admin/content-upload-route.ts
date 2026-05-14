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
const CONTENT_UPLOAD_MAX_ENVELOPE_BYTES = 6 * 1024 * 1024;

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
    file: Blob | ArrayBuffer | Uint8Array,
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

type ListingImageVariantName = "card" | "detail";

type ListingImageVariantOutput = {
  data: ArrayBuffer | Uint8Array;
  width: number;
  height: number;
  mimeType: "image/webp";
  format: "webp";
};

type ListingImageVariantProcessor = (
  input: ArrayBuffer,
  sourceMimeType: string,
) => Promise<Record<ListingImageVariantName, ListingImageVariantOutput>>;

type ContentUploadRouteDependencies = ContentAdminRouteDependencies & {
  processListingImageVariants?: ListingImageVariantProcessor;
};

// ── Shared route handler ────────────────────────────────────────────────────

async function handleContentImageUpload(
  request: Request,
  dependencies: ContentUploadRouteDependencies,
  storagePathPrefix: string,
): Promise<Response> {
  const originCheck = validateContentAdminOrigin(request);
  if (!originCheck.ok) {
    return jsonError(originCheck.error, originCheck.status);
  }

  // 1. Auth guard — reuses existing content admin pattern
  const contentLengthCheck = validateUploadContentLengthEnvelope(request);
  if (!contentLengthCheck.ok) {
    return jsonError(contentLengthCheck.error, contentLengthCheck.status);
  }

  const contentTypeCheck = validateUploadContentTypeEnvelope(request);
  if (!contentTypeCheck.ok) {
    return jsonError(contentTypeCheck.error, contentTypeCheck.status);
  }

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

  const uploadResult = await uploadStorageObjectWithTimeout(
    bucket,
    storagePath,
    fileBuffer,
    mimeType,
  );

  if (uploadResult.error) {
    logStorageUploadError(uploadResult.error.message);
    return jsonError("Görsel yüklenirken bir hata oluştu. Lütfen tekrar deneyin.", 500);
  }

  // 7. Get public URL
  const { data: publicUrlData } = bucket.getPublicUrl(storagePath);

  const variantData = storagePathPrefix === "listing-images"
    ? await uploadListingImageVariants({
        bucket,
        originalPath: storagePath,
        originalBuffer: fileBuffer,
        sourceMimeType: mimeType,
        processor: dependencies.processListingImageVariants ?? processListingImageVariants,
      })
    : null;

  if (variantData && !variantData.ok) {
    return jsonError("Görsel yüklenirken bir hata oluştu. Lütfen tekrar deneyin.", 500);
  }

  return jsonResponse(
    {
      success: true,
      data: {
        url: publicUrlData.publicUrl,
        path: storagePath,
        bucket: CONTENT_MEDIA_BUCKET,
        ...(variantData?.ok ? { variants: variantData.variants } : {}),
      },
    },
    200,
  );
}

// ── Public handlers ─────────────────────────────────────────────────────────

async function uploadStorageObjectWithTimeout(
  bucket: StorageFromBucket,
  path: string,
  body: Blob | ArrayBuffer | Uint8Array,
  contentType: string,
): Promise<StorageUploadResult> {
  const STORAGE_TIMEOUT_MS = 15_000;
  return Promise.race([
    bucket.upload(path, body, {
      contentType,
      upsert: false,
    }),
    new Promise<{ error: { message: string } }>((resolve) =>
      setTimeout(() => resolve({ error: { message: "Storage upload timed out" } }), STORAGE_TIMEOUT_MS),
    ),
  ]);
}

function logStorageUploadError(message: string | undefined): void {
  // Do NOT leak raw Supabase error to client.
  const msg = message ?? "";
  console.error("[content-upload] Storage upload error:", msg);

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
}

async function uploadListingImageVariants(input: {
  bucket: StorageFromBucket;
  originalPath: string;
  originalBuffer: ArrayBuffer;
  sourceMimeType: string;
  processor: ListingImageVariantProcessor;
}): Promise<
  | { ok: true; variants: Record<ListingImageVariantName, Record<string, string | number>> }
  | { ok: false }
> {
  let processed: Record<ListingImageVariantName, ListingImageVariantOutput>;
  try {
    processed = await input.processor(input.originalBuffer, input.sourceMimeType);
  } catch (error) {
    console.error("[content-upload] Listing image variant processing error:", error);
    return { ok: false };
  }

  const variants = {} as Record<ListingImageVariantName, Record<string, string | number>>;
  for (const name of ["card", "detail"] as const) {
    const variant = processed[name];
    const variantPath = buildListingVariantPath(input.originalPath, name);
    const uploadResult = await uploadStorageObjectWithTimeout(
      input.bucket,
      variantPath,
      variant.data,
      variant.mimeType,
    );

    if (uploadResult.error) {
      logStorageUploadError(uploadResult.error.message);
      return { ok: false };
    }

    const { data: publicUrlData } = input.bucket.getPublicUrl(variantPath);
    variants[name] = {
      url: publicUrlData.publicUrl,
      path: variantPath,
      bucket: CONTENT_MEDIA_BUCKET,
      role: name,
      width: variant.width,
      height: variant.height,
      mimeType: variant.mimeType,
      format: variant.format,
    };
  }

  return { ok: true, variants };
}

function buildListingVariantPath(originalPath: string, variantName: ListingImageVariantName): string {
  const extensionStart = originalPath.lastIndexOf(".");
  const basePath = extensionStart > originalPath.lastIndexOf("/")
    ? originalPath.slice(0, extensionStart)
    : originalPath;
  return `${basePath}-${variantName}.webp`;
}

async function processListingImageVariants(
  input: ArrayBuffer,
): Promise<Record<ListingImageVariantName, ListingImageVariantOutput>> {
  const sharp = (await import("sharp")).default;

  async function buildVariant(width: number, quality: number): Promise<ListingImageVariantOutput> {
    const { data, info } = await sharp(Buffer.from(input))
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality })
      .toBuffer({ resolveWithObject: true });

    return {
      data,
      width: info.width,
      height: info.height,
      mimeType: "image/webp",
      format: "webp",
    };
  }

  return {
    card: await buildVariant(480, 82),
    detail: await buildVariant(1280, 84),
  };
}

function validateUploadContentLengthEnvelope(
  request: Request,
): { ok: true } | { ok: false; status: number; error: string } {
  const rawContentLength = request.headers.get("content-length");
  if (!rawContentLength || rawContentLength.trim().length === 0) {
    return {
      ok: false,
      status: 411,
      error: "Content-Length header is required",
    };
  }

  const contentLength = Number(rawContentLength);
  if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
    return {
      ok: false,
      status: 400,
      error: "Content-Length header is invalid",
    };
  }

  if (contentLength > CONTENT_UPLOAD_MAX_ENVELOPE_BYTES) {
    return {
      ok: false,
      status: 413,
      error: "Content upload payload is too large",
    };
  }

  return { ok: true };
}

function validateUploadContentTypeEnvelope(
  request: Request,
): { ok: true } | { ok: false; status: number; error: string } {
  const contentType = request.headers.get("content-type");
  if (contentType?.toLowerCase().split(";")[0]?.trim() !== "multipart/form-data") {
    return {
      ok: false,
      status: 415,
      error: "Content upload requires multipart/form-data",
    };
  }

  return { ok: true };
}

export async function handleBlogCoverUpload(
  request: Request,
  dependencies: ContentUploadRouteDependencies,
): Promise<Response> {
  return handleContentImageUpload(request, dependencies, "blog-covers");
}

export async function handleConsultantPhotoUpload(
  request: Request,
  dependencies: ContentUploadRouteDependencies,
): Promise<Response> {
  return handleContentImageUpload(request, dependencies, "consultants/photos");
}

export async function handleListingImageUpload(
  request: Request,
  dependencies: ContentUploadRouteDependencies,
): Promise<Response> {
  return handleContentImageUpload(request, dependencies, "listing-images");
}
