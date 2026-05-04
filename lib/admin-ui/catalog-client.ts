// Phase 9B: typed admin catalog API client for /admin/listing-catalog.
//
// Targets:
//   GET  /api/admin/catalog/main-items
//   POST /api/admin/catalog/main-items
//   PATCH /api/admin/catalog/main-items/:code
//   GET  /api/admin/catalog/services
//   POST /api/admin/catalog/services
//   PATCH /api/admin/catalog/services/:code
//
// Follows the same envelope, credentials, and error pattern as listings-client.ts.

export type AdminCatalogFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type AdminCatalogClientOptions = {
  fetcher?: AdminCatalogFetch;
};

export type AdminCatalogMainItemCreatePayload = {
  code: string;
  label: string;
  pricing_strategy?: string;
  description?: string | null;
  default_amount?: number | null;
  default_multiplier?: number | null;
  is_active?: boolean;
  sort_order?: number;
};

export type AdminCatalogMainItemUpdatePayload = {
  label?: string;
  description?: string | null;
  pricing_strategy?: string;
  default_amount?: number | null;
  default_multiplier?: number | null;
  is_active?: boolean;
  sort_order?: number;
};

export type AdminCatalogServiceCreatePayload = {
  code: string;
  name: string;
  description?: string | null;
  base_price?: number;
  is_active?: boolean;
};

export type AdminCatalogServiceUpdatePayload = {
  name?: string;
  description?: string | null;
  base_price?: number;
  is_active?: boolean;
};

export class AdminCatalogClientError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminCatalogClientError";
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Main item catalog
// ---------------------------------------------------------------------------

export async function fetchAdminCatalogMainItems(
  options: AdminCatalogClientOptions = {},
): Promise<unknown[]> {
  const data = await requestAdminCatalogJson<unknown[]>(
    "/api/admin/catalog/main-items",
    { method: "GET" },
    options,
  );
  return Array.isArray(data) ? data : [];
}

export async function createAdminCatalogMainItem(
  payload: AdminCatalogMainItemCreatePayload,
  options: AdminCatalogClientOptions = {},
): Promise<unknown> {
  return jsonRequest(
    "/api/admin/catalog/main-items",
    "POST",
    payload as Record<string, unknown>,
    options,
  );
}

export async function updateAdminCatalogMainItem(
  code: string,
  payload: AdminCatalogMainItemUpdatePayload,
  options: AdminCatalogClientOptions = {},
): Promise<unknown> {
  return jsonRequest(
    `/api/admin/catalog/main-items/${encodeURIComponent(code)}`,
    "PATCH",
    payload as Record<string, unknown>,
    options,
  );
}

// ---------------------------------------------------------------------------
// Service catalog
// ---------------------------------------------------------------------------

export async function fetchAdminCatalogServices(
  options: AdminCatalogClientOptions = {},
): Promise<unknown[]> {
  const data = await requestAdminCatalogJson<unknown[]>(
    "/api/admin/catalog/services",
    { method: "GET" },
    options,
  );
  return Array.isArray(data) ? data : [];
}

export async function createAdminCatalogService(
  payload: AdminCatalogServiceCreatePayload,
  options: AdminCatalogClientOptions = {},
): Promise<unknown> {
  return jsonRequest(
    "/api/admin/catalog/services",
    "POST",
    payload as Record<string, unknown>,
    options,
  );
}

export async function updateAdminCatalogService(
  code: string,
  payload: AdminCatalogServiceUpdatePayload,
  options: AdminCatalogClientOptions = {},
): Promise<unknown> {
  return jsonRequest(
    `/api/admin/catalog/services/${encodeURIComponent(code)}`,
    "PATCH",
    payload as Record<string, unknown>,
    options,
  );
}

// ---------------------------------------------------------------------------
// Shared internals
// ---------------------------------------------------------------------------

function jsonRequest<T = unknown>(
  url: string,
  method: "POST" | "PATCH",
  body: Record<string, unknown>,
  options: AdminCatalogClientOptions,
): Promise<T> {
  return requestAdminCatalogJson<T>(
    url,
    {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
    options,
  );
}

async function requestAdminCatalogJson<T = unknown>(
  url: string,
  init: RequestInit,
  options: AdminCatalogClientOptions,
): Promise<T> {
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  const response = await fetcher(url, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
  });
  const envelope = await readJsonEnvelope(response);

  if (!envelope.success) {
    throw new AdminCatalogClientError(envelope.error, response.status);
  }

  if (!response.ok) {
    throw new AdminCatalogClientError("Admin catalog request failed", response.status);
  }

  return envelope.data as T;
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
    return { success: false, error: "Invalid admin catalog response" };
  }

  if (!isRecord(payload)) {
    return { success: false, error: "Invalid admin catalog response" };
  }

  if (payload.success === true) {
    return { success: true, data: payload.data };
  }

  if (payload.success === false) {
    return {
      success: false,
      error: asNonEmptyString(payload.error) ?? "Admin catalog request failed",
    };
  }

  return { success: false, error: "Invalid admin catalog response" };
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
