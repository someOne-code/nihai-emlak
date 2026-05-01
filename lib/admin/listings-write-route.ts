// Phase 8.2: admin listing config write route handlers.
//
// Endpoints:
//   POST  /api/admin/listings              -> handleAdminListingsCreatePost
//   PATCH /api/admin/listings/:listingId   -> handleAdminListingsUpdatePatch
//
// PATCH dispatches to:
//   - admin_set_listing_status when the only field is `status`
//   - admin_update_listing for everything else
//
// Contract: docs/ADMIN_LISTING_CONFIG_CONTRACT.md
// Authorization: profiles.role = 'admin' (route guard) plus DB-level
// auth.uid() + public.is_admin() inside the RPC bodies.

import {
  readStateChangingJsonRequestPayload,
  validateStateChangingJsonRequestEnvelope,
  type StateChangingJsonRouteConfig,
} from "../http/state-changing-json-route.ts";
import {
  asUuid,
  guardAdminListingsRequest,
  jsonError,
  jsonResponse,
  mapAdminListingRpcError,
  type AdminListingsRouteDependencies,
} from "./listings-shared.ts";

const ADMIN_LISTING_JSON_ROUTE_CONFIG: StateChangingJsonRouteConfig = {
  maxBodyBytes: 8 * 1024,
  routeLabel: "Admin listing",
};

const ALLOWED_LISTING_STATUSES = new Set(["active", "passive"]);

export async function handleAdminListingsCreatePost(
  request: Request,
  dependencies: AdminListingsRouteDependencies,
): Promise<Response> {
  const envelopeResult = validateAdminListingRequestEnvelope(request);
  if (!envelopeResult.ok) {
    return jsonError(envelopeResult.error, envelopeResult.status);
  }

  const guard = await guardAdminListingsRequest(dependencies);
  if (!guard.ok) {
    return guard.response;
  }

  const bodyResult = await readAdminListingPayload(request);
  if (!bodyResult.ok) {
    return jsonError(bodyResult.error, bodyResult.status);
  }

  const rpcResult = await guard.supabase.rpc("admin_create_listing", {
    p_payload: bodyResult.value,
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
    201,
  );
}

export async function handleAdminListingsUpdatePatch(
  request: Request,
  dependencies: AdminListingsRouteDependencies,
  params: { listingId: string },
): Promise<Response> {
  const envelopeResult = validateAdminListingRequestEnvelope(request);
  if (!envelopeResult.ok) {
    return jsonError(envelopeResult.error, envelopeResult.status);
  }

  const listingId = asUuid(params.listingId);
  if (!listingId) {
    return jsonError("Invalid listing id", 400);
  }

  const guard = await guardAdminListingsRequest(dependencies);
  if (!guard.ok) {
    return guard.response;
  }

  const bodyResult = await readAdminListingPayload(request);
  if (!bodyResult.ok) {
    return jsonError(bodyResult.error, bodyResult.status);
  }

  const dispatch = classifyAdminListingPatch(bodyResult.value);
  if (!dispatch.ok) {
    return jsonError(dispatch.error, dispatch.status);
  }

  const rpcResult = dispatch.kind === "status"
    ? await guard.supabase.rpc("admin_set_listing_status", {
        p_listing_id: listingId,
        p_status: dispatch.status,
      })
    : await guard.supabase.rpc("admin_update_listing", {
        p_listing_id: listingId,
        p_payload: bodyResult.value,
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

function validateAdminListingRequestEnvelope(
  request: Request,
): { ok: true } | { ok: false; status: number; error: string } {
  return validateStateChangingJsonRequestEnvelope(request, ADMIN_LISTING_JSON_ROUTE_CONFIG, {
    invalidConfigError: "Admin listing trusted origin configuration is invalid",
    missingConfigError: "Admin listing private SITE_URL must be configured outside development/test",
    strategy: "site-url-only",
  });
}

async function readAdminListingPayload(
  request: Request,
):
  | Promise<{ ok: true; value: Record<string, unknown> } | { ok: false; status: number; error: string }> {
  const payloadResult = await readStateChangingJsonRequestPayload(
    request,
    ADMIN_LISTING_JSON_ROUTE_CONFIG,
  );
  if (!payloadResult.ok) {
    return payloadResult;
  }

  if (!isPlainObject(payloadResult.value)) {
    return {
      ok: false,
      status: 400,
      error: "Invalid JSON request body",
    };
  }

  return {
    ok: true,
    value: payloadResult.value,
  };
}

function classifyAdminListingPatch(
  body: Record<string, unknown>,
):
  | { ok: true; kind: "status"; status: string }
  | { ok: true; kind: "update" }
  | { ok: false; status: number; error: string } {
  const keys = Object.keys(body);

  if (keys.length === 0) {
    return {
      ok: false,
      status: 400,
      error: "Empty admin listing patch payload",
    };
  }

  if (keys.length === 1 && keys[0] === "status") {
    const status = typeof body.status === "string" ? body.status.trim() : "";
    if (!ALLOWED_LISTING_STATUSES.has(status)) {
      return {
        ok: false,
        status: 400,
        error: "Invalid admin listing status",
      };
    }
    return {
      ok: true,
      kind: "status",
      status,
    };
  }

  if (keys.includes("status")) {
    return {
      ok: false,
      status: 400,
      error: "Admin listing status must be patched on its own",
    };
  }

  return {
    ok: true,
    kind: "update",
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
