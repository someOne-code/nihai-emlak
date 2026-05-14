// Phase 9A: Content upload validation + route helper tests.
//
// TDD-first: pure validation helpers for file metadata (MIME, size, filename),
// safe storage path generation, and route-level auth/envelope mocking.
//
// Tests are layered:
//   1. Pure validators (no I/O)
//   2. Storage path builder (no I/O)
//   3. Route helper auth/envelope (mocked deps)
//   4. Client helper envelope (mocked fetch)

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import {
  validateImageMimeType,
  validateImageFileSize,
  validateImageFilename,
  buildSafeStoragePath,
  sanitizeFilename,
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGE_SIZE_LABEL,
} from "../lib/admin/content-upload-validators.ts";

const MAX_UPLOAD_ENVELOPE_BYTES = 6 * 1024 * 1024;

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

// ── MIME type validation ────────────────────────────────────────────────────

test("validateImageMimeType accepts image/jpeg", () => {
  assert.deepEqual(validateImageMimeType("image/jpeg"), { ok: true });
});

test("validateImageMimeType accepts image/png", () => {
  assert.deepEqual(validateImageMimeType("image/png"), { ok: true });
});

test("validateImageMimeType accepts image/webp", () => {
  assert.deepEqual(validateImageMimeType("image/webp"), { ok: true });
});

test("validateImageMimeType accepts case-insensitive MIME", () => {
  assert.deepEqual(validateImageMimeType("IMAGE/JPEG"), { ok: true });
  assert.deepEqual(validateImageMimeType(" Image/Png "), { ok: true });
});

test("validateImageMimeType rejects image/gif", () => {
  const result = validateImageMimeType("image/gif");
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.includes("Desteklenmeyen"));
});

test("validateImageMimeType rejects application/pdf", () => {
  const result = validateImageMimeType("application/pdf");
  assert.equal(result.ok, false);
});

test("validateImageMimeType rejects empty string", () => {
  const result = validateImageMimeType("");
  assert.equal(result.ok, false);
});

test("validateImageMimeType rejects text/html", () => {
  const result = validateImageMimeType("text/html");
  assert.equal(result.ok, false);
});

// ── File size validation ────────────────────────────────────────────────────

test("validateImageFileSize accepts 1 byte", () => {
  assert.deepEqual(validateImageFileSize(1), { ok: true });
});

test("validateImageFileSize accepts exactly MAX_IMAGE_SIZE_BYTES", () => {
  assert.deepEqual(validateImageFileSize(MAX_IMAGE_SIZE_BYTES), { ok: true });
});

test("validateImageFileSize accepts 1 KB", () => {
  assert.deepEqual(validateImageFileSize(1024), { ok: true });
});

test("validateImageFileSize rejects MAX_IMAGE_SIZE_BYTES + 1", () => {
  const result = validateImageFileSize(MAX_IMAGE_SIZE_BYTES + 1);
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.includes("büyük"));
});

test("validateImageFileSize rejects 0", () => {
  const result = validateImageFileSize(0);
  assert.equal(result.ok, false);
});

test("validateImageFileSize rejects negative", () => {
  const result = validateImageFileSize(-100);
  assert.equal(result.ok, false);
});

test("validateImageFileSize rejects NaN", () => {
  const result = validateImageFileSize(NaN);
  assert.equal(result.ok, false);
});

test("validateImageFileSize rejects Infinity", () => {
  const result = validateImageFileSize(Infinity);
  assert.equal(result.ok, false);
});

// ── Filename validation ─────────────────────────────────────────────────────

test("validateImageFilename accepts normal filename", () => {
  assert.deepEqual(validateImageFilename("photo.jpg"), { ok: true });
});

test("validateImageFilename rejects empty string", () => {
  const result = validateImageFilename("");
  assert.equal(result.ok, false);
});

test("validateImageFilename rejects null", () => {
  const result = validateImageFilename(null);
  assert.equal(result.ok, false);
});

test("validateImageFilename rejects undefined", () => {
  const result = validateImageFilename(undefined);
  assert.equal(result.ok, false);
});

test("validateImageFilename rejects whitespace-only", () => {
  const result = validateImageFilename("   ");
  assert.equal(result.ok, false);
});

// ── Filename sanitization ───────────────────────────────────────────────────

test("sanitizeFilename lowercases and removes special chars", () => {
  assert.equal(sanitizeFilename("My Photo (1).jpg"), "my-photo-1.jpg");
});

test("sanitizeFilename handles Turkish chars", () => {
  // Turkish chars are not a-z, should be replaced
  assert.equal(sanitizeFilename("güzel-kapak.png"), "g-zel-kapak.png");
});

test("sanitizeFilename collapses multiple hyphens", () => {
  assert.equal(sanitizeFilename("a---b.jpg"), "a-b.jpg");
});

test("sanitizeFilename handles extensionless filename", () => {
  const result = sanitizeFilename("README");
  assert.equal(result, "readme");
});

test("sanitizeFilename handles empty input", () => {
  assert.equal(sanitizeFilename(""), "upload");
});

test("sanitizeFilename handles only-special-chars input", () => {
  assert.equal(sanitizeFilename("!!!.jpg"), "upload.jpg");
});

// ── Safe storage path ───────────────────────────────────────────────────────

test("buildSafeStoragePath starts with blog-covers/", () => {
  const path = buildSafeStoragePath("photo.jpg");
  assert.ok(path.startsWith("blog-covers/"), `Expected blog-covers/ prefix: ${path}`);
});

test("buildSafeStoragePath includes sanitized filename", () => {
  const path = buildSafeStoragePath("My Photo.jpg");
  assert.ok(path.includes("my-photo.jpg"), `Expected sanitized name in: ${path}`);
});

test("buildSafeStoragePath generates unique paths", () => {
  const path1 = buildSafeStoragePath("a.jpg");
  const path2 = buildSafeStoragePath("a.jpg");
  assert.notEqual(path1, path2, "paths should include random component");
});

test("buildSafeStoragePath includes timestamp component", () => {
  const path = buildSafeStoragePath("a.jpg");
  // Pattern: blog-covers/{timestamp}-{random}-{filename}
  const parts = path.replace("blog-covers/", "").split("-");
  const timestamp = parseInt(parts[0], 10);
  assert.ok(!isNaN(timestamp), "first segment should be timestamp");
  assert.ok(timestamp > 1700000000000, "timestamp should be recent");
});

// ── Safe storage path with custom prefix (consultant photos) ────────────────

test("buildSafeStoragePath accepts custom prefix for consultant photos", () => {
  const path = buildSafeStoragePath("photo.jpg", "consultants/photos");
  assert.ok(path.startsWith("consultants/photos/"), `Expected consultants/photos/ prefix: ${path}`);
});

test("buildSafeStoragePath with custom prefix includes sanitized filename", () => {
  const path = buildSafeStoragePath("Profile Shot.png", "consultants/photos");
  assert.ok(path.includes("profile-shot.png"), `Expected sanitized name in: ${path}`);
});

test("buildSafeStoragePath defaults to blog-covers/ when no prefix given", () => {
  const path = buildSafeStoragePath("photo.jpg");
  assert.ok(path.startsWith("blog-covers/"), `Expected default blog-covers/ prefix: ${path}`);
});

// ── Constants contract ──────────────────────────────────────────────────────

test("ALLOWED_IMAGE_MIME_TYPES has exactly 3 entries", () => {
  assert.equal(ALLOWED_IMAGE_MIME_TYPES.size, 3);
});

test("MAX_IMAGE_SIZE_BYTES is 5 MB", () => {
  assert.equal(MAX_IMAGE_SIZE_BYTES, 5 * 1024 * 1024);
});

test("MAX_IMAGE_SIZE_LABEL is human-readable", () => {
  assert.equal(MAX_IMAGE_SIZE_LABEL, "5 MB");
});

class FormDataSpyRequest extends Request {
  formDataCalls = 0;

  constructor(headers: Record<string, string>) {
    super("http://localhost:3000/api/admin/content/uploads/blog-cover", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        ...headers,
      },
      body: "not-read",
    });
  }

  override async formData(): Promise<FormData> {
    this.formDataCalls += 1;
    return new FormData();
  }
}

function createAuthCountingUploadDeps(authCalls: { count: number }) {
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
        storage: { from: () => ({}) },
      };
    },
  };
}

// ── Route helper: auth guard (mock-based) ───────────────────────────────────

test("handleBlogCoverUpload rejects oversized Content-Length before auth and formData", async (t) => {
  setupContentAdminEnv(t);
  const { handleBlogCoverUpload } = await import(
    "../lib/admin/content-upload-route.ts"
  );

  const request = new FormDataSpyRequest({
    "content-length": String(MAX_UPLOAD_ENVELOPE_BYTES + 1),
  });
  const authCalls = { count: 0 };

  const response = await handleBlogCoverUpload(
    request,
    createAuthCountingUploadDeps(authCalls),
  );

  assert.equal(response.status, 413);
  assert.equal(authCalls.count, 0, "auth must not run for oversized upload envelope");
  assert.equal(request.formDataCalls, 0, "request.formData must not be called for oversized upload envelope");
});

test("handleBlogCoverUpload rejects missing Content-Length before auth and formData", async (t) => {
  setupContentAdminEnv(t);
  const { handleBlogCoverUpload } = await import(
    "../lib/admin/content-upload-route.ts"
  );

  const request = new FormDataSpyRequest({});
  const authCalls = { count: 0 };

  const response = await handleBlogCoverUpload(
    request,
    createAuthCountingUploadDeps(authCalls),
  );

  assert.equal(response.status, 411);
  assert.equal(authCalls.count, 0, "auth must not run without upload Content-Length");
  assert.equal(request.formDataCalls, 0, "request.formData must not be called without upload Content-Length");
});

test("handleBlogCoverUpload rejects invalid Content-Length before auth and formData", async (t) => {
  setupContentAdminEnv(t);
  const { handleBlogCoverUpload } = await import(
    "../lib/admin/content-upload-route.ts"
  );

  const request = new FormDataSpyRequest({
    "content-length": "invalid",
  });
  const authCalls = { count: 0 };

  const response = await handleBlogCoverUpload(
    request,
    createAuthCountingUploadDeps(authCalls),
  );

  assert.equal(response.status, 400);
  assert.equal(authCalls.count, 0, "auth must not run with invalid upload Content-Length");
  assert.equal(request.formDataCalls, 0, "request.formData must not be called with invalid upload Content-Length");
});

test("handleBlogCoverUpload rejects non-multipart Content-Type before auth and formData", async (t) => {
  setupContentAdminEnv(t);
  const { handleBlogCoverUpload } = await import(
    "../lib/admin/content-upload-route.ts"
  );

  const request = new FormDataSpyRequest({
    "content-type": "text/plain",
    "content-length": "8",
  });
  const authCalls = { count: 0 };

  const response = await handleBlogCoverUpload(
    request,
    createAuthCountingUploadDeps(authCalls),
  );

  assert.equal(response.status, 415);
  assert.equal(authCalls.count, 0, "auth must not run for non-multipart uploads");
  assert.equal(request.formDataCalls, 0, "request.formData must not be called for non-multipart uploads");
});

test("handleBlogCoverUpload rejects untrusted origins before auth", async (t) => {
  setupContentAdminEnv(t);
  const { handleBlogCoverUpload } = await import(
    "../lib/admin/content-upload-route.ts"
  );

  const formData = new FormData();
  formData.append("file", new Blob(["x"], { type: "image/png" }), "test.png");

  const request = new Request("http://localhost:3000/api/admin/content/uploads/blog-cover", {
    method: "POST",
    headers: {
      origin: "https://evil.example",
    },
    body: formData,
  });

  const response = await handleBlogCoverUpload(request, {
    createServerSupabaseClient: async () => {
      throw new Error("auth should not run for untrusted origins");
    },
  });

  assert.equal(response.status, 403);
  const body = await response.json() as Record<string, unknown>;
  assert.equal(body.success, false);
  assert.equal(body.error, "Content admin Origin is not trusted");
});

test("handleBlogCoverUpload rejects unauthenticated request", async (t) => {
  setupContentAdminEnv(t);
  const { handleBlogCoverUpload } = await import(
    "../lib/admin/content-upload-route.ts"
  );

  const formData = new FormData();
  formData.append("file", new Blob(["x"], { type: "image/png" }), "test.png");

  const request = new Request("http://localhost:3000/api/admin/content/uploads/blog-cover", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "content-length": String(MAX_UPLOAD_ENVELOPE_BYTES),
    },
    body: formData,
  });

  const response = await handleBlogCoverUpload(request, {
    createServerSupabaseClient: async () => ({
      auth: {
        getUser: async () => ({ data: { user: null }, error: { message: "no session" } }),
      },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
      storage: { from: () => ({}) },
    }),
  });

  assert.equal(response.status, 401);
  const body = await response.json() as Record<string, unknown>;
  assert.equal(body.success, false);
});

test("handleBlogCoverUpload rejects non-admin user", async (t) => {
  setupContentAdminEnv(t);
  const { handleBlogCoverUpload } = await import(
    "../lib/admin/content-upload-route.ts"
  );

  const formData = new FormData();
  formData.append("file", new Blob(["x"], { type: "image/png" }), "test.png");

  const request = new Request("http://localhost:3000/api/admin/content/uploads/blog-cover", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "content-length": String(MAX_UPLOAD_ENVELOPE_BYTES),
    },
    body: formData,
  });

  const response = await handleBlogCoverUpload(request, {
    createServerSupabaseClient: async () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: "u1" } }, error: null }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { role: "user" }, error: null }),
          }),
        }),
      }),
      storage: { from: () => ({}) },
    }),
  });

  assert.equal(response.status, 403);
});

test("handleBlogCoverUpload rejects unsupported MIME type", async (t) => {
  setupContentAdminEnv(t);
  const { handleBlogCoverUpload } = await import(
    "../lib/admin/content-upload-route.ts"
  );

  const formData = new FormData();
  formData.append("file", new Blob(["x"], { type: "image/gif" }), "test.gif");

  const request = new Request("http://localhost:3000/api/admin/content/uploads/blog-cover", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "content-length": String(MAX_UPLOAD_ENVELOPE_BYTES),
    },
    body: formData,
  });

  const response = await handleBlogCoverUpload(request, {
    createServerSupabaseClient: mockAdminSupabaseClient(),
  });

  assert.equal(response.status, 400);
  const body = await response.json() as Record<string, unknown>;
  assert.equal(body.success, false);
  assert.ok(typeof body.error === "string");
  assert.ok((body.error as string).includes("Desteklenmeyen"));
});

test("handleBlogCoverUpload rejects oversized file", async (t) => {
  setupContentAdminEnv(t);
  const { handleBlogCoverUpload } = await import(
    "../lib/admin/content-upload-route.ts"
  );

  // Create a blob larger than 5MB
  const oversizedBlob = new Blob([new ArrayBuffer(6 * 1024 * 1024)], { type: "image/png" });
  const formData = new FormData();
  formData.append("file", oversizedBlob, "big.png");

  const request = new Request("http://localhost:3000/api/admin/content/uploads/blog-cover", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "content-length": String(MAX_UPLOAD_ENVELOPE_BYTES),
    },
    body: formData,
  });

  const response = await handleBlogCoverUpload(request, {
    createServerSupabaseClient: mockAdminSupabaseClient(),
  });

  assert.equal(response.status, 400);
  const body = await response.json() as Record<string, unknown>;
  assert.equal(body.success, false);
  assert.ok((body.error as string).includes("büyük"));
});

test("handleBlogCoverUpload rejects missing file", async (t) => {
  setupContentAdminEnv(t);
  const { handleBlogCoverUpload } = await import(
    "../lib/admin/content-upload-route.ts"
  );

  const formData = new FormData();
  // No file appended

  const request = new Request("http://localhost:3000/api/admin/content/uploads/blog-cover", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "content-length": String(MAX_UPLOAD_ENVELOPE_BYTES),
    },
    body: formData,
  });

  const response = await handleBlogCoverUpload(request, {
    createServerSupabaseClient: mockAdminSupabaseClient(),
  });

  assert.equal(response.status, 400);
});

test("handleBlogCoverUpload returns success shape on mocked upload", async (t) => {
  setupContentAdminEnv(t);
  const { handleBlogCoverUpload } = await import(
    "../lib/admin/content-upload-route.ts"
  );

  const formData = new FormData();
  formData.append("file", new Blob(["png-data"], { type: "image/png" }), "cover.png");

  const request = new Request("http://localhost:3000/api/admin/content/uploads/blog-cover", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "content-length": String(MAX_UPLOAD_ENVELOPE_BYTES),
    },
    body: formData,
  });

  let uploadedPath = "";
  const response = await handleBlogCoverUpload(request, {
    createServerSupabaseClient: mockAdminSupabaseClient({
      uploadResult: { error: null },
      getPublicUrlResult: { data: { publicUrl: "https://storage.example.com/content-media/blog-covers/123-abc-cover.png" } },
      onUpload: (path: string) => { uploadedPath = path; },
    }),
  });

  assert.equal(response.status, 200);
  const body = await response.json() as Record<string, unknown>;
  assert.equal(body.success, true);
  assert.ok(typeof body.data === "object" && body.data !== null);
  const data = body.data as Record<string, unknown>;
  assert.ok(typeof data.url === "string", "response must include url");
  assert.ok((data.url as string).length > 0, "url must be non-empty");
  assert.ok(uploadedPath.startsWith("blog-covers/"), "storage path must start with blog-covers/");
});

test("handleBlogCoverUpload wraps storage error without leaking details", async (t) => {
  setupContentAdminEnv(t);
  const { handleBlogCoverUpload } = await import(
    "../lib/admin/content-upload-route.ts"
  );

  const formData = new FormData();
  formData.append("file", new Blob(["png-data"], { type: "image/png" }), "cover.png");

  const request = new Request("http://localhost:3000/api/admin/content/uploads/blog-cover", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "content-length": String(MAX_UPLOAD_ENVELOPE_BYTES),
    },
    body: formData,
  });

  const response = await handleBlogCoverUpload(request, {
    createServerSupabaseClient: mockAdminSupabaseClient({
      uploadResult: { error: { message: "Internal storage failure XYZ-secret" } },
    }),
  });

  assert.equal(response.status, 500);
  const body = await response.json() as Record<string, unknown>;
  assert.equal(body.success, false);
  // Must NOT leak raw Supabase error
  assert.ok(!(body.error as string).includes("XYZ-secret"), "must not leak raw storage error");
  assert.ok((body.error as string).length > 0);
});

// ── Listing image upload route ───────────────────────────────────────────────

test("handleListingImageUpload rejects unsupported MIME type", async (t) => {
  setupContentAdminEnv(t);
  const { handleListingImageUpload } = await import(
    "../lib/admin/content-upload-route.ts"
  );

  const formData = new FormData();
  formData.append("file", new Blob(["x"], { type: "image/gif" }), "listing.gif");

  const request = new Request("http://localhost:3000/api/admin/content/uploads/listing-image", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "content-length": String(MAX_UPLOAD_ENVELOPE_BYTES),
    },
    body: formData,
  });

  const response = await handleListingImageUpload(request, {
    createServerSupabaseClient: mockAdminSupabaseClient(),
  });

  assert.equal(response.status, 400);
  const body = await response.json() as Record<string, unknown>;
  assert.equal(body.success, false);
  assert.ok((body.error as string).includes("Desteklenmeyen"));
});

test("handleListingImageUpload returns success with listing-images path prefix and content-media bucket", async (t) => {
  setupContentAdminEnv(t);
  const { handleListingImageUpload, CONTENT_MEDIA_BUCKET } = await import(
    "../lib/admin/content-upload-route.ts"
  );

  const formData = new FormData();
  formData.append("file", new Blob(["png-data"], { type: "image/png" }), "listing-photo.png");

  const request = new Request("http://localhost:3000/api/admin/content/uploads/listing-image", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "content-length": String(MAX_UPLOAD_ENVELOPE_BYTES),
    },
    body: formData,
  });

  let uploadedPath = "";
  const response = await handleListingImageUpload(request, {
    createServerSupabaseClient: mockAdminSupabaseClient({
      uploadResult: { error: null },
      getPublicUrlResult: { data: { publicUrl: "https://storage.example.com/content-media/listing-images/123-abc-listing-photo.png" } },
      onUpload: (path: string) => { uploadedPath = path; },
    }),
    processListingImageVariants: mockListingVariantProcessor,
  });

  assert.equal(response.status, 200);
  const body = await response.json() as Record<string, unknown>;
  assert.equal(body.success, true);
  assert.ok(typeof body.data === "object" && body.data !== null);
  const data = body.data as Record<string, unknown>;
  assert.equal(data.bucket, CONTENT_MEDIA_BUCKET);
  assert.ok(typeof data.path === "string");
  assert.ok((data.path as string).startsWith("listing-images/"), `storage path must start with listing-images/: got ${String(data.path)}`);
  assert.ok((data.url as string).includes("/content-media/listing-images/"), `public URL must include content-media/listing-images path: got ${String(data.url)}`);
  assert.ok(uploadedPath.startsWith("listing-images/"), `upload path must start with listing-images/: got ${uploadedPath}`);
});

test("handleListingImageUpload uploads card and detail WebP variants", async (t) => {
  setupContentAdminEnv(t);
  const { handleListingImageUpload, CONTENT_MEDIA_BUCKET } = await import(
    "../lib/admin/content-upload-route.ts"
  );

  const formData = new FormData();
  formData.append("file", new Blob(["png-data"], { type: "image/png" }), "Listing Photo.png");

  const request = new Request("http://localhost:3000/api/admin/content/uploads/listing-image", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "content-length": String(MAX_UPLOAD_ENVELOPE_BYTES),
    },
    body: formData,
  });

  const uploadedPaths: string[] = [];
  const uploadedContentTypes: string[] = [];
  const response = await handleListingImageUpload(request, {
    createServerSupabaseClient: mockAdminSupabaseClient({
      onUpload: (path: string, _body: unknown, options?: { contentType?: string }) => {
        uploadedPaths.push(path);
        uploadedContentTypes.push(String(options?.contentType ?? ""));
      },
      getPublicUrlForPath: (path: string) => ({
        data: { publicUrl: `https://storage.example.com/content-media/${path}` },
      }),
    }),
    processListingImageVariants: async () => ({
      card: {
        data: new Uint8Array([1, 2, 3]).buffer,
        width: 480,
        height: 320,
        mimeType: "image/webp",
        format: "webp",
      },
      detail: {
        data: new Uint8Array([4, 5, 6]).buffer,
        width: 1280,
        height: 853,
        mimeType: "image/webp",
        format: "webp",
      },
    }),
  });

  assert.equal(response.status, 200);
  const body = await response.json() as Record<string, unknown>;
  assert.equal(body.success, true);

  const data = body.data as Record<string, unknown>;
  assert.equal(data.bucket, CONTENT_MEDIA_BUCKET);
  assert.ok(typeof data.url === "string", "original url must remain for compatibility");
  assert.ok(typeof data.path === "string", "original path must remain for compatibility");
  assert.ok((data.path as string).startsWith("listing-images/"));

  const variants = data.variants as Record<string, Record<string, unknown>>;
  assert.ok(variants && typeof variants === "object", "response must include variants");
  assert.deepEqual(Object.keys(variants).sort(), ["card", "detail"]);

  assert.equal(variants.card.bucket, CONTENT_MEDIA_BUCKET);
  assert.equal(variants.card.format, "webp");
  assert.equal(variants.card.mimeType, "image/webp");
  assert.equal(variants.card.role, "card");
  assert.equal(variants.card.width, 480);
  assert.equal(variants.card.height, 320);
  assert.ok(String(variants.card.path).startsWith("listing-images/"));
  assert.ok(String(variants.card.path).endsWith("-card.webp"));
  assert.ok(String(variants.card.url).includes(String(variants.card.path)));

  assert.equal(variants.detail.bucket, CONTENT_MEDIA_BUCKET);
  assert.equal(variants.detail.format, "webp");
  assert.equal(variants.detail.mimeType, "image/webp");
  assert.equal(variants.detail.role, "detail");
  assert.equal(variants.detail.width, 1280);
  assert.equal(variants.detail.height, 853);
  assert.ok(String(variants.detail.path).startsWith("listing-images/"));
  assert.ok(String(variants.detail.path).endsWith("-detail.webp"));
  assert.ok(String(variants.detail.url).includes(String(variants.detail.path)));

  assert.equal(uploadedPaths.length, 3, "original plus card/detail variants must be uploaded");
  assert.ok(uploadedPaths[0].startsWith("listing-images/"));
  assert.ok(uploadedPaths[1].endsWith("-card.webp"));
  assert.ok(uploadedPaths[2].endsWith("-detail.webp"));
  assert.deepEqual(uploadedContentTypes, ["image/png", "image/webp", "image/webp"]);
});

test("handleListingImageUpload rejects oversized file", async (t) => {
  setupContentAdminEnv(t);
  const { handleListingImageUpload } = await import(
    "../lib/admin/content-upload-route.ts"
  );

  const oversizedBlob = new Blob([new ArrayBuffer(6 * 1024 * 1024)], { type: "image/png" });
  const formData = new FormData();
  formData.append("file", oversizedBlob, "big-listing.png");

  const request = new Request("http://localhost:3000/api/admin/content/uploads/listing-image", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "content-length": String(MAX_UPLOAD_ENVELOPE_BYTES),
    },
    body: formData,
  });

  const response = await handleListingImageUpload(request, {
    createServerSupabaseClient: mockAdminSupabaseClient(),
  });

  assert.equal(response.status, 400);
  const body = await response.json() as Record<string, unknown>;
  assert.equal(body.success, false);
  assert.ok(typeof body.error === "string");
  assert.ok((body.error as string).length > 0);
});

// ── Client helper ───────────────────────────────────────────────────────────

test("uploadBlogCoverImage sends FormData and returns url on success", async () => {
  const { uploadBlogCoverImage } = await import(
    "../lib/admin-ui/content-client.ts"
  );

  const mockFile = new File(["png-data"], "test.png", { type: "image/png" });
  const expectedUrl = "https://storage.example.com/content-media/blog-covers/test.png";

  const result = await uploadBlogCoverImage(mockFile, {
    fetcher: async (_input, init) => {
      // Verify FormData was sent
      assert.ok(init?.body instanceof FormData, "body must be FormData");
      const fd = init!.body as FormData;
      assert.ok(fd.has("file"), "FormData must contain 'file' field");

      return new Response(
        JSON.stringify({ success: true, data: { url: expectedUrl } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  assert.equal(result, expectedUrl);
});

test("uploadListingImage sends FormData to listing-image endpoint and returns url/path/bucket", async () => {
  const { uploadListingImage } = await import(
    "../lib/admin-ui/listings-client.ts"
  );

  const mockFile = new File(["png-data"], "listing.png", { type: "image/png" });
  const expectedUrl = "https://storage.example.com/content-media/listing-images/listing.png";
  const expectedPath = "listing-images/1714830000000-abc123-listing.png";
  const expectedBucket = "content-media";

  let calledEndpoint = "";
  const result = await uploadListingImage(mockFile, {
    fetcher: async (input, init) => {
      calledEndpoint = typeof input === "string" ? input : input.toString();
      assert.ok(init?.body instanceof FormData, "body must be FormData");
      const fd = init!.body as FormData;
      assert.ok(fd.has("file"), "FormData must contain 'file' field");

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            url: expectedUrl,
            path: expectedPath,
            bucket: expectedBucket,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  assert.ok(calledEndpoint.includes("listing-image"), `must call listing-image endpoint: got ${calledEndpoint}`);
  assert.deepEqual(result, {
    url: expectedUrl,
    path: expectedPath,
    bucket: expectedBucket,
  });
});

test("uploadListingImage throws AdminListingsClientError on invalid upload response", async () => {
  const { uploadListingImage, AdminListingsClientError } = await import(
    "../lib/admin-ui/listings-client.ts"
  );

  const mockFile = new File(["data"], "listing.png", { type: "image/png" });

  await assert.rejects(
    () => uploadListingImage(mockFile, {
      fetcher: async () => new Response(
        JSON.stringify({ success: true, data: null }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    }),
    (err: unknown) => {
      assert.ok(err instanceof AdminListingsClientError);
      assert.equal((err as InstanceType<typeof AdminListingsClientError>).status, 500);
      return true;
    },
  );
});

test("uploadBlogCoverImage throws ContentAdminClientError on failure", async () => {
  const { uploadBlogCoverImage, ContentAdminClientError } = await import(
    "../lib/admin-ui/content-client.ts"
  );

  const mockFile = new File(["data"], "test.png", { type: "image/png" });

  await assert.rejects(
    () => uploadBlogCoverImage(mockFile, {
      fetcher: async () => new Response(
        JSON.stringify({ success: false, error: "Dosya çok büyük" }),
        { status: 400, headers: { "content-type": "application/json" } },
      ),
    }),
    (err: unknown) => {
      assert.ok(err instanceof ContentAdminClientError);
      assert.equal((err as InstanceType<typeof ContentAdminClientError>).status, 400);
      return true;
    },
  );
});

// ── Consultant photo upload route ───────────────────────────────────────────

test("handleConsultantPhotoUpload rejects unsupported MIME type", async (t) => {
  setupContentAdminEnv(t);
  const { handleConsultantPhotoUpload } = await import(
    "../lib/admin/content-upload-route.ts"
  );

  const formData = new FormData();
  formData.append("file", new Blob(["x"], { type: "image/gif" }), "test.gif");

  const request = new Request("http://localhost:3000/api/admin/content/uploads/consultant-photo", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "content-length": String(MAX_UPLOAD_ENVELOPE_BYTES),
    },
    body: formData,
  });

  const response = await handleConsultantPhotoUpload(request, {
    createServerSupabaseClient: mockAdminSupabaseClient(),
  });

  assert.equal(response.status, 400);
  const body = await response.json() as Record<string, unknown>;
  assert.equal(body.success, false);
  assert.ok((body.error as string).includes("Desteklenmeyen"));
});

test("handleConsultantPhotoUpload rejects oversized file", async (t) => {
  setupContentAdminEnv(t);
  const { handleConsultantPhotoUpload } = await import(
    "../lib/admin/content-upload-route.ts"
  );

  const oversizedBlob = new Blob([new ArrayBuffer(6 * 1024 * 1024)], { type: "image/png" });
  const formData = new FormData();
  formData.append("file", oversizedBlob, "big.png");

  const request = new Request("http://localhost:3000/api/admin/content/uploads/consultant-photo", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "content-length": String(MAX_UPLOAD_ENVELOPE_BYTES),
    },
    body: formData,
  });

  const response = await handleConsultantPhotoUpload(request, {
    createServerSupabaseClient: mockAdminSupabaseClient(),
  });

  assert.equal(response.status, 400);
  const body = await response.json() as Record<string, unknown>;
  assert.equal(body.success, false);
  assert.ok((body.error as string).includes("büyük"));
});

test("handleConsultantPhotoUpload returns success with consultants/photos/ path prefix", async (t) => {
  setupContentAdminEnv(t);
  const { handleConsultantPhotoUpload } = await import(
    "../lib/admin/content-upload-route.ts"
  );

  const formData = new FormData();
  formData.append("file", new Blob(["png-data"], { type: "image/png" }), "profile.png");

  const request = new Request("http://localhost:3000/api/admin/content/uploads/consultant-photo", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "content-length": String(MAX_UPLOAD_ENVELOPE_BYTES),
    },
    body: formData,
  });

  let uploadedPath = "";
  const response = await handleConsultantPhotoUpload(request, {
    createServerSupabaseClient: mockAdminSupabaseClient({
      uploadResult: { error: null },
      getPublicUrlResult: { data: { publicUrl: "https://storage.example.com/content-media/consultants/photos/123-abc-profile.png" } },
      onUpload: (path: string) => { uploadedPath = path; },
    }),
  });

  assert.equal(response.status, 200);
  const body = await response.json() as Record<string, unknown>;
  assert.equal(body.success, true);
  const data = body.data as Record<string, unknown>;
  assert.ok(typeof data.url === "string", "must include url");
  assert.ok((data.url as string).length > 0, "url must be non-empty");
  assert.ok(uploadedPath.startsWith("consultants/photos/"), `storage path must start with consultants/photos/: got ${uploadedPath}`);
});

// ── Consultant photo client helper ──────────────────────────────────────────

test("uploadConsultantPhoto sends FormData to consultant-photo endpoint", async () => {
  const { uploadConsultantPhoto } = await import(
    "../lib/admin-ui/content-client.ts"
  );

  const mockFile = new File(["png-data"], "profile.png", { type: "image/png" });
  const expectedUrl = "https://storage.example.com/content-media/consultants/photos/profile.png";

  let calledEndpoint = "";
  const result = await uploadConsultantPhoto(mockFile, {
    fetcher: async (input, init) => {
      calledEndpoint = typeof input === "string" ? input : input.toString();
      assert.ok(init?.body instanceof FormData, "body must be FormData");
      return new Response(
        JSON.stringify({ success: true, data: { url: expectedUrl } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  assert.equal(result, expectedUrl);
  assert.ok(calledEndpoint.includes("consultant-photo"), `must call consultant-photo endpoint: got ${calledEndpoint}`);
});

// ── Helper: mock admin Supabase client ──────────────────────────────────────

function mockAdminSupabaseClient(opts?: {
  uploadResult?: { error: { message: string } | null };
  getPublicUrlResult?: { data: { publicUrl: string } };
  getPublicUrlForPath?: (path: string) => { data: { publicUrl: string } };
  onUpload?: (path: string, body: unknown, options?: { contentType?: string; upsert?: boolean }) => void;
}) {
  const uploadResult = opts?.uploadResult ?? { error: null };
  const getPublicUrlResult = opts?.getPublicUrlResult ?? {
    data: { publicUrl: "https://storage.example.com/content-media/test.png" },
  };

  return async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "admin-1" } }, error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { role: "admin" }, error: null }),
        }),
      }),
    }),
    storage: {
      from: (/* _bucket */) => ({
        upload: async (path: string, ...args: unknown[]) => {
          opts?.onUpload?.(path, args[0], args[1] as { contentType?: string; upsert?: boolean } | undefined);
          return uploadResult;
        },
        getPublicUrl: (path: string) => opts?.getPublicUrlForPath?.(path) ?? getPublicUrlResult,
      }),
    },
  });
}

async function mockListingVariantProcessor() {
  return {
    card: {
      data: new Uint8Array([1, 2, 3]).buffer,
      width: 480,
      height: 320,
      mimeType: "image/webp" as const,
      format: "webp" as const,
    },
    detail: {
      data: new Uint8Array([4, 5, 6]).buffer,
      width: 1280,
      height: 853,
      mimeType: "image/webp" as const,
      format: "webp" as const,
    },
  };
}
