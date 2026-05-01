// Phase 8.1: admin listing config read route handlers.
//
// Endpoints:
//   GET /api/admin/listings              -> handleAdminListingsListGet
//   GET /api/admin/listings/:listingId   -> handleAdminListingsSnapshotGet
//
// Contract: docs/ADMIN_LISTING_CONFIG_CONTRACT.md
// Authorization: profiles.role = 'admin' (route guard) plus DB-level
// auth.uid() + public.is_admin() inside the RPC bodies.

import {
  asNonEmptyString,
  asUuid,
  guardAdminListingsRequest,
  jsonError,
  jsonResponse,
  mapAdminListingRpcError,
  type AdminListingsRouteDependencies,
} from "./listings-shared.ts";

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;
const ALLOWED_STATUSES = new Set(["active", "passive"]);
const ALLOWED_TYPES = new Set(["sale", "rent"]);

export async function handleAdminListingsListGet(
  request: Request,
  dependencies: AdminListingsRouteDependencies,
): Promise<Response> {
  const guard = await guardAdminListingsRequest(dependencies);
  if (!guard.ok) {
    return guard.response;
  }

  const queryResult = parseListQuery(request);
  if (!queryResult.ok) {
    return jsonError(queryResult.error, 400);
  }

  const rpcResult = await guard.supabase.rpc("admin_list_listings", {
    p_status: queryResult.value.status,
    p_type: queryResult.value.type,
    p_limit: queryResult.value.limit,
    p_offset: queryResult.value.offset,
  });

  if (rpcResult.error) {
    return jsonError(...mapAdminListingRpcError(rpcResult.error, "Listing not found"));
  }

  if (!isPlainObject(rpcResult.data)) {
    return jsonError("Invalid admin listing RPC response", 500);
  }

  return jsonResponse(
    {
      success: true,
      data: rpcResult.data,
    },
    200,
  );
}

export async function handleAdminListingsSnapshotGet(
  _request: Request,
  dependencies: AdminListingsRouteDependencies,
  params: { listingId: string },
): Promise<Response> {
  const listingId = asUuid(params.listingId);
  if (!listingId) {
    return jsonError("Invalid listing id", 400);
  }

  const guard = await guardAdminListingsRequest(dependencies);
  if (!guard.ok) {
    return guard.response;
  }

  const rpcResult = await guard.supabase.rpc("admin_get_listing", {
    p_listing_id: listingId,
  });

  if (rpcResult.error) {
    return jsonError(...mapAdminListingRpcError(rpcResult.error, "Listing not found"));
  }

  if (rpcResult.data === null || rpcResult.data === undefined) {
    return jsonError("Listing not found", 404);
  }

  if (!isPlainObject(rpcResult.data)) {
    return jsonError("Invalid admin listing RPC response", 500);
  }

  return jsonResponse(
    {
      success: true,
      data: rpcResult.data,
    },
    200,
  );
}

function parseListQuery(
  request: Request,
):
  | {
      ok: true;
      value: {
        status: string | null;
        type: string | null;
        limit: number;
        offset: number;
      };
    }
  | { ok: false; error: string } {
  const url = safeRequestUrl(request);
  if (!url) {
    return {
      ok: false,
      error: "Invalid admin listings request URL",
    };
  }

  const params = url.searchParams;
  const status = asNonEmptyString(params.get("status"));
  const type = asNonEmptyString(params.get("type"));
  const rawLimit = asNonEmptyString(params.get("limit"));
  const rawOffset = asNonEmptyString(params.get("offset"));

  if (status !== null && !ALLOWED_STATUSES.has(status)) {
    return {
      ok: false,
      error: "Invalid admin listings status filter",
    };
  }

  if (type !== null && !ALLOWED_TYPES.has(type)) {
    return {
      ok: false,
      error: "Invalid admin listings type filter",
    };
  }

  const limit = parsePositiveInteger(rawLimit, DEFAULT_LIST_LIMIT);
  if (limit === null || limit < 1 || limit > MAX_LIST_LIMIT) {
    return {
      ok: false,
      error: "Invalid admin listings limit",
    };
  }

  const offset = parseNonNegativeInteger(rawOffset, 0);
  if (offset === null) {
    return {
      ok: false,
      error: "Invalid admin listings offset",
    };
  }

  return {
    ok: true,
    value: {
      status,
      type,
      limit,
      offset,
    },
  };
}

function safeRequestUrl(request: Request): URL | null {
  try {
    return new URL(request.url);
  } catch {
    return null;
  }
}

function parsePositiveInteger(value: string | null, fallback: number): number | null {
  if (value === null) {
    return fallback;
  }
  if (!/^[0-9]+$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }
  return parsed;
}

function parseNonNegativeInteger(value: string | null, fallback: number): number | null {
  if (value === null) {
    return fallback;
  }
  if (!/^[0-9]+$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
