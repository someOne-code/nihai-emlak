// Phase 8.5: typed admin listings API client used by /admin/listings.
//
// Each helper targets one Phase 8 admin route and returns the unwrapped
// `data` field of the canonical envelope. Failures throw a typed
// AdminListingsClientError so the controller can render them safely.

export type AdminListingsFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type AdminListingsClientOptions = {
  fetcher?: AdminListingsFetch;
  requestTimeoutMs?: number;
  signal?: AbortSignal;
};

export type AdminListingsListFilters = {
  status?: "active" | "passive";
  type?: "sale" | "rent";
  limit?: number;
  offset?: number;
};

export type AdminListingsListResponse = {
  items: unknown[];
  limit: number;
  offset: number;
};

export type AdminListingMainItemPayload = {
  is_enabled?: boolean;
  override_label?: string | null;
  override_amount?: number | null;
  override_multiplier?: number | null;
  sort_order?: number;
};

export type AdminListingServicePayload = {
  is_enabled?: boolean;
  override_price?: number | null;
};

export type AdminListingImageAddPayload = {
  image_url: string;
  alt_text?: string | null;
  is_primary?: boolean;
};

export class AdminListingsClientError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminListingsClientError";
    this.status = status;
  }
}

const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const ADMIN_LISTINGS_TIMEOUT_MESSAGE = "Admin ilan isteği zaman aşımına uğradı.";

export async function fetchAdminListingsList(
  filters: AdminListingsListFilters,
  options: AdminListingsClientOptions = {},
): Promise<AdminListingsListResponse> {
  const url = buildListUrl(filters);
  const data = await requestAdminJson<AdminListingsListResponse>(
    url,
    { method: "GET" },
    options,
  );

  return data;
}

export async function fetchAdminListingSnapshot(
  listingId: string,
  options: AdminListingsClientOptions = {},
): Promise<unknown> {
  return requestAdminJson(
    `/api/admin/listings/${encodeURIComponent(listingId)}`,
    { method: "GET" },
    options,
  );
}

export async function createAdminListing(
  payload: Record<string, unknown>,
  options: AdminListingsClientOptions = {},
): Promise<unknown> {
  return jsonRequest("/api/admin/listings", "POST", payload, options);
}

export async function updateAdminListing(
  listingId: string,
  payload: Record<string, unknown>,
  options: AdminListingsClientOptions = {},
): Promise<unknown> {
  return jsonRequest(
    `/api/admin/listings/${encodeURIComponent(listingId)}`,
    "PATCH",
    payload,
    options,
  );
}

export async function setAdminListingStatus(
  listingId: string,
  status: "active" | "passive",
  options: AdminListingsClientOptions = {},
): Promise<unknown> {
  return jsonRequest(
    `/api/admin/listings/${encodeURIComponent(listingId)}`,
    "PATCH",
    { status },
    options,
  );
}

export async function addAdminListingImage(
  listingId: string,
  payload: AdminListingImageAddPayload,
  options: AdminListingsClientOptions = {},
): Promise<unknown> {
  return jsonRequest(
    `/api/admin/listings/${encodeURIComponent(listingId)}/images`,
    "POST",
    payload as Record<string, unknown>,
    options,
  );
}

export async function reorderAdminListingImages(
  listingId: string,
  imageIds: string[],
  options: AdminListingsClientOptions = {},
): Promise<unknown> {
  return jsonRequest(
    `/api/admin/listings/${encodeURIComponent(listingId)}/images/order`,
    "PATCH",
    { order: imageIds },
    options,
  );
}

export async function deleteAdminListingImage(
  listingId: string,
  imageId: string,
  options: AdminListingsClientOptions = {},
): Promise<null> {
  const response = await requestAdminResponse(
    `/api/admin/listings/${encodeURIComponent(listingId)}/images/${encodeURIComponent(imageId)}`,
    { method: "DELETE" },
    options,
  );

  if (response.status === 204) {
    return null;
  }

  // Non-204 means an error envelope was returned by the route.
  const envelope = await readJsonEnvelope(response);
  if (envelope.success) {
    // 200 with body still treated as success but no payload to return.
    return null;
  }

  throw new AdminListingsClientError(envelope.error, response.status);
}

export async function configureAdminListingMainItem(
  listingId: string,
  code: string,
  payload: AdminListingMainItemPayload,
  options: AdminListingsClientOptions = {},
): Promise<unknown> {
  return jsonRequest(
    `/api/admin/listings/${encodeURIComponent(listingId)}/main-items/${encodeURIComponent(code)}`,
    "PATCH",
    payload as Record<string, unknown>,
    options,
  );
}

export async function configureAdminListingService(
  listingId: string,
  code: string,
  payload: AdminListingServicePayload,
  options: AdminListingsClientOptions = {},
): Promise<unknown> {
  return jsonRequest(
    `/api/admin/listings/${encodeURIComponent(listingId)}/services/${encodeURIComponent(code)}`,
    "PATCH",
    payload as Record<string, unknown>,
    options,
  );
}

function buildListUrl(filters: AdminListingsListFilters): string {
  const params = new URLSearchParams();
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.type) {
    params.set("type", filters.type);
  }
  if (filters.limit !== undefined) {
    params.set("limit", String(filters.limit));
  }
  if (filters.offset !== undefined) {
    params.set("offset", String(filters.offset));
  }

  const query = params.toString();
  return query.length === 0 ? "/api/admin/listings" : `/api/admin/listings?${query}`;
}

function jsonRequest<T = unknown>(
  url: string,
  method: "POST" | "PATCH",
  body: Record<string, unknown>,
  options: AdminListingsClientOptions,
): Promise<T> {
  return requestAdminJson<T>(
    url,
    {
      method,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
    options,
  );
}

async function requestAdminJson<T = unknown>(
  url: string,
  init: RequestInit,
  options: AdminListingsClientOptions,
): Promise<T> {
  const response = await requestAdminResponse(url, init, options);
  const envelope = await readJsonEnvelope(response);

  if (!envelope.success) {
    throw new AdminListingsClientError(envelope.error, response.status);
  }

  if (!response.ok) {
    throw new AdminListingsClientError("Admin listings request failed", response.status);
  }

  return envelope.data as T;
}

async function requestAdminResponse(
  url: string,
  init: RequestInit,
  options: AdminListingsClientOptions,
): Promise<Response> {
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  const abort = createRequestAbort(options);

  try {
    return await fetcher(url, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
      signal: abort.signal,
    });
  } catch (err) {
    if (isAbortError(err)) {
      throw new AdminListingsClientError(ADMIN_LISTINGS_TIMEOUT_MESSAGE, 408);
    }
    throw err;
  } finally {
    abort.cleanup();
  }
}

function createRequestAbort(options: AdminListingsClientOptions): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const externalSignal = options.signal;
  const abortFromExternal = () => controller.abort();
  const timer = setTimeout(
    () => controller.abort(),
    options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
  );

  if (externalSignal?.aborted) {
    controller.abort();
  } else {
    externalSignal?.addEventListener("abort", abortFromExternal, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      externalSignal?.removeEventListener("abort", abortFromExternal);
    },
  };
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

async function readJsonEnvelope(
  response: Response,
): Promise<
  | { success: true; data: unknown }
  | { success: false; error: string }
> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return {
      success: false,
      error: "Invalid admin listings response",
    };
  }

  if (!isRecord(payload)) {
    return {
      success: false,
      error: "Invalid admin listings response",
    };
  }

  if (payload.success === true) {
    return {
      success: true,
      data: payload.data,
    };
  }

  if (payload.success === false) {
    return {
      success: false,
      error: asNonEmptyString(payload.error) ?? "Admin listings request failed",
    };
  }

  return {
    success: false,
    error: "Invalid admin listings response",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return value.trim();
}

// ── Listing image file upload ───────────────────────────────────────────────

export type ListingImageUploadResult = {
  url: string;
  path: string;
  bucket: string;
  variants?: Record<string, unknown>;
};

export function resolveListingImageUploadUrl(result: ListingImageUploadResult): string {
  return (
    getUploadVariantUrl(result.variants, "canonical") ??
    getUploadVariantUrl(result.variants, "detail") ??
    getUploadVariantUrl(result.variants, "card") ??
    result.url
  );
}

export async function uploadListingImage(
  file: File,
  options: AdminListingsClientOptions = {},
): Promise<ListingImageUploadResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await requestAdminResponse("/api/admin/content/uploads/listing-image", {
    method: "POST",
    body: formData,
  }, options);

  if (!response.ok) {
    let message = `Upload failed (${response.status})`;
    try {
      const body = await response.json();
      if (isRecord(body) && typeof body.error === "string") {
        message = body.error;
      }
    } catch {
      // ignore parse errors
    }
    throw new AdminListingsClientError(message, response.status);
  }

  const body = await response.json();
  if (!isRecord(body) || !isRecord(body.data)) {
    throw new AdminListingsClientError("Invalid upload response", 500);
  }

  const data = body.data as Record<string, unknown>;
  const variants = isRecord(data.variants) ? data.variants : undefined;
  return {
    url: String(data.url ?? ""),
    path: String(data.path ?? ""),
    bucket: String(data.bucket ?? ""),
    ...(variants ? { variants } : {}),
  };
}

function getUploadVariantUrl(
  variants: Record<string, unknown> | undefined,
  key: "canonical" | "detail" | "card",
): string | null {
  if (!variants) {
    return null;
  }

  const variant = variants[key];
  if (!isRecord(variant)) {
    return null;
  }

  return asNonEmptyString(variant.url);
}
