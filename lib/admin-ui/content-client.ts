// Phase 9A Task 7: Content admin client helpers.
// Phase 9A Task 8: PostsListFilters and buildPostsUrl unified with ui-helpers.
//
// Each helper calls our Next.js route proxy, not Payload directly.
// Mirrors lib/admin-ui/listings-client.ts pattern: credentials: same-origin,
// cache: no-store, typed error class, { success, data|error } envelope.

// ── Shared ─────────────────────────────────────────────────────────────────

export type ContentAdminFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type ContentAdminClientOptions = {
  fetcher?: ContentAdminFetch;
  requestTimeoutMs?: number;
};

export class ContentAdminClientError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ContentAdminClientError";
    this.status = status;
  }
}

async function readEnvelope(
  response: Response,
): Promise<{ success: true; data: unknown } | { success: false; error: string }> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { success: false, error: "Invalid content admin response" };
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { success: false, error: "Invalid content admin response" };
  }
  const rec = payload as Record<string, unknown>;
  if (rec.success === true) return { success: true, data: rec.data };
  if (rec.success === false) {
    const err = typeof rec.error === "string" && rec.error.trim().length > 0
      ? rec.error.trim()
      : "Content admin request failed";
    return { success: false, error: err };
  }
  return { success: false, error: "Invalid content admin response" };
}

async function requestJson<T = unknown>(
  url: string,
  init: RequestInit,
  options: ContentAdminClientOptions,
): Promise<T> {
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  const controller = new AbortController();
  const timeoutMs = options.requestTimeoutMs ?? 15_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetcher(url, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ContentAdminClientError("İçerik isteği zaman aşımına uğradı.", 408);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
  const envelope = await readEnvelope(response);
  if (!envelope.success) throw new ContentAdminClientError(envelope.error, response.status);
  return envelope.data as T;
}

function jsonRequest<T = unknown>(
  url: string,
  method: "POST" | "PATCH",
  body: Record<string, unknown>,
  options: ContentAdminClientOptions,
): Promise<T> {
  return requestJson<T>(
    url,
    { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
    options,
  );
}

// ── Posts client ───────────────────────────────────────────────────────────
//
// PostsListFilters and buildPostsUrl are defined in content-posts-ui-helpers.ts
// and re-exported here so existing imports from content-client.ts still work.

export type { PostsListFilters } from "./content-posts-ui-helpers.ts";
import { buildPostsUrl, type PostsListFilters as PostsListFiltersType } from "./content-posts-ui-helpers.ts";

export async function fetchAdminPostsList(
  filters: PostsListFiltersType = {},
  options: ContentAdminClientOptions = {},
): Promise<unknown> {
  return requestJson(buildPostsUrl(filters), { method: "GET" }, options);
}

export async function fetchAdminPostsListFiltered(
  filters: PostsListFiltersType = {},
  options: ContentAdminClientOptions = {},
): Promise<unknown> {
  return requestJson(buildPostsUrl(filters), { method: "GET" }, options);
}

export async function fetchAdminPost(
  id: string,
  options: ContentAdminClientOptions = {},
): Promise<unknown> {
  return requestJson(`/api/admin/content/posts/${encodeURIComponent(id)}`, { method: "GET" }, options);
}

export async function createAdminPost(
  payload: Record<string, unknown>,
  options: ContentAdminClientOptions = {},
): Promise<unknown> {
  return jsonRequest("/api/admin/content/posts", "POST", payload, options);
}

export async function updateAdminPost(
  id: string,
  payload: Record<string, unknown>,
  options: ContentAdminClientOptions = {},
): Promise<unknown> {
  return jsonRequest(`/api/admin/content/posts/${encodeURIComponent(id)}`, "PATCH", payload, options);
}

export async function deleteAdminPost(
  id: string,
  options: ContentAdminClientOptions = {},
): Promise<void> {
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  const response = await fetcher(`/api/admin/content/posts/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
    cache: "no-store",
  });
  if (response.ok) return;
  const envelope = await readEnvelope(response);
  throw new ContentAdminClientError(
    envelope.success ? "Delete failed" : envelope.error,
    response.status,
  );
}

// ── Blog cover image upload ──────────────────────────────────────────────

/** Upload timeout in milliseconds (30 s). */
const UPLOAD_TIMEOUT_MS = 30_000;

export async function uploadBlogCoverImage(
  file: File,
  options: ContentAdminClientOptions = {},
): Promise<string> {
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  const formData = new FormData();
  formData.append("file", file);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetcher("/api/admin/content/uploads/blog-cover", {
      method: "POST",
      body: formData,
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ContentAdminClientError("Yükleme zaman aşımına uğradı.", 408);
    }
    throw new ContentAdminClientError("Yükleme sırasında bağlantı hatası.", 0);
  } finally {
    clearTimeout(timer);
  }

  const envelope = await readEnvelope(response);
  if (!envelope.success) {
    throw new ContentAdminClientError(envelope.error, response.status);
  }

  const data = envelope.data as Record<string, unknown> | null;
  if (!data || typeof data.url !== "string" || data.url.length === 0) {
    throw new ContentAdminClientError("Yükleme yanıtı geçersiz.", 500);
  }

  return data.url;
}

// ── Categories client ──────────────────────────────────────────────────────

export async function fetchAdminCategoriesList(
  options: ContentAdminClientOptions = {},
): Promise<unknown> {
  return requestJson("/api/admin/content/categories", { method: "GET" }, options);
}

export async function fetchAdminCategoryOptions(
  options: ContentAdminClientOptions = {},
): Promise<unknown> {
  return requestJson("/api/admin/content/categories/options", { method: "GET" }, options);
}

export async function fetchAdminCategory(
  id: string,
  options: ContentAdminClientOptions = {},
): Promise<unknown> {
  return requestJson(`/api/admin/content/categories/${encodeURIComponent(id)}`, { method: "GET" }, options);
}

export async function createAdminCategory(
  payload: Record<string, unknown>,
  options: ContentAdminClientOptions = {},
): Promise<unknown> {
  return jsonRequest("/api/admin/content/categories", "POST", payload, options);
}

export async function updateAdminCategory(
  id: string,
  payload: Record<string, unknown>,
  options: ContentAdminClientOptions = {},
): Promise<unknown> {
  return jsonRequest(`/api/admin/content/categories/${encodeURIComponent(id)}`, "PATCH", payload, options);
}

export async function deleteAdminCategory(
  id: string,
  options: ContentAdminClientOptions = {},
): Promise<void> {
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  const response = await fetcher(`/api/admin/content/categories/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
    cache: "no-store",
  });
  if (response.ok) return;
  const envelope = await readEnvelope(response);
  throw new ContentAdminClientError(
    envelope.success ? "Delete failed" : envelope.error,
    response.status,
  );
}

// ── Consultants client ─────────────────────────────────────────────────────

export async function fetchAdminConsultantsList(
  options: ContentAdminClientOptions = {},
): Promise<unknown> {
  return requestJson("/api/admin/content/consultants", { method: "GET" }, options);
}

export async function fetchAdminConsultant(
  id: string,
  options: ContentAdminClientOptions = {},
): Promise<unknown> {
  return requestJson(`/api/admin/content/consultants/${encodeURIComponent(id)}`, { method: "GET" }, options);
}

export async function createAdminConsultant(
  payload: Record<string, unknown>,
  options: ContentAdminClientOptions = {},
): Promise<unknown> {
  return jsonRequest("/api/admin/content/consultants", "POST", payload, options);
}

export async function updateAdminConsultant(
  id: string,
  payload: Record<string, unknown>,
  options: ContentAdminClientOptions = {},
): Promise<unknown> {
  return jsonRequest(`/api/admin/content/consultants/${encodeURIComponent(id)}`, "PATCH", payload, options);
}

export async function deleteAdminConsultant(
  id: string,
  options: ContentAdminClientOptions = {},
): Promise<void> {
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  const response = await fetcher(`/api/admin/content/consultants/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
    cache: "no-store",
  });
  if (response.ok) return;
  const envelope = await readEnvelope(response);
  throw new ContentAdminClientError(
    envelope.success ? "Delete failed" : envelope.error,
    response.status,
  );
}

// ── Consultant photo upload ─────────────────────────────────────────────────

export async function uploadConsultantPhoto(
  file: File,
  options: ContentAdminClientOptions = {},
): Promise<string> {
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  const formData = new FormData();
  formData.append("file", file);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetcher("/api/admin/content/uploads/consultant-photo", {
      method: "POST",
      body: formData,
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ContentAdminClientError("Yükleme zaman aşımına uğradı.", 408);
    }
    throw new ContentAdminClientError("Yükleme sırasında bağlantı hatası.", 0);
  } finally {
    clearTimeout(timer);
  }

  const envelope = await readEnvelope(response);
  if (!envelope.success) {
    throw new ContentAdminClientError(envelope.error, response.status);
  }

  const data = envelope.data as Record<string, unknown> | null;
  if (!data || typeof data.url !== "string" || data.url.length === 0) {
    throw new ContentAdminClientError("Yükleme yanıtı geçersiz.", 500);
  }

  return data.url;
}
