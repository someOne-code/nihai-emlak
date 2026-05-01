// Phase 8.4: admin listing main item and service pricing config route handlers.
//
// Endpoints:
//   PATCH /api/admin/listings/:listingId/main-items/:code -> handleAdminListingsMainItemPatch
//   PATCH /api/admin/listings/:listingId/services/:code    -> handleAdminListingsServicePatch
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

const ADMIN_LISTING_PRICING_JSON_ROUTE_CONFIG: StateChangingJsonRouteConfig = {
  maxBodyBytes: 8 * 1024,
  routeLabel: "Admin listing pricing",
};

// ---------------------------------------------------------------------------
// PATCH /api/admin/listings/:listingId/main-items/:code
// ---------------------------------------------------------------------------

export async function handleAdminListingsMainItemPatch(
  request: Request,
  dependencies: AdminListingsRouteDependencies,
  params: { listingId: string; code: string },
): Promise<Response> {
  const envelopeResult = validateAdminListingPricingRequestEnvelope(request);
  if (!envelopeResult.ok) {
    return jsonError(envelopeResult.error, envelopeResult.status);
  }

  const listingId = asUuid(params.listingId);
  if (!listingId) {
    return jsonError("Invalid listing id", 400);
  }

  const code = params.code?.trim();
  if (!code || code.length === 0) {
    return jsonError("Invalid main item code", 400);
  }

  const guard = await guardAdminListingsRequest(dependencies);
  if (!guard.ok) {
    return guard.response;
  }

  const bodyResult = await readAdminListingPricingPayload(request);
  if (!bodyResult.ok) {
    return jsonError(bodyResult.error, bodyResult.status);
  }

  const rpcResult = await guard.supabase.rpc("admin_configure_listing_main_item", {
    p_listing_id: listingId,
    p_code: code,
    p_payload: bodyResult.value,
  });

  if (rpcResult.error) {
    return jsonError(...mapAdminListingRpcError(rpcResult.error, "Main item catalog entry not found"));
  }

  if (!isPlainObject(rpcResult.data)) {
    return jsonError("Invalid admin listing pricing RPC response", 500);
  }

  return jsonResponse(
    {
      success: true,
      data: rpcResult.data,
    },
    200,
  );
}

// ---------------------------------------------------------------------------
// PATCH /api/admin/listings/:listingId/services/:code
// ---------------------------------------------------------------------------

export async function handleAdminListingsServicePatch(
  request: Request,
  dependencies: AdminListingsRouteDependencies,
  params: { listingId: string; code: string },
): Promise<Response> {
  const envelopeResult = validateAdminListingPricingRequestEnvelope(request);
  if (!envelopeResult.ok) {
    return jsonError(envelopeResult.error, envelopeResult.status);
  }

  const listingId = asUuid(params.listingId);
  if (!listingId) {
    return jsonError("Invalid listing id", 400);
  }

  const code = params.code?.trim();
  if (!code || code.length === 0) {
    return jsonError("Invalid service code", 400);
  }

  const guard = await guardAdminListingsRequest(dependencies);
  if (!guard.ok) {
    return guard.response;
  }

  const bodyResult = await readAdminListingPricingPayload(request);
  if (!bodyResult.ok) {
    return jsonError(bodyResult.error, bodyResult.status);
  }

  const rpcResult = await guard.supabase.rpc("admin_configure_listing_service", {
    p_listing_id: listingId,
    p_code: code,
    p_payload: bodyResult.value,
  });

  if (rpcResult.error) {
    return jsonError(...mapAdminListingRpcError(rpcResult.error, "Service catalog entry not found"));
  }

  if (!isPlainObject(rpcResult.data)) {
    return jsonError("Invalid admin listing pricing RPC response", 500);
  }

  return jsonResponse(
    {
      success: true,
      data: rpcResult.data,
    },
    200,
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateAdminListingPricingRequestEnvelope(
  request: Request,
): { ok: true } | { ok: false; status: number; error: string } {
  return validateStateChangingJsonRequestEnvelope(request, ADMIN_LISTING_PRICING_JSON_ROUTE_CONFIG, {
    invalidConfigError: "Admin listing pricing trusted origin configuration is invalid",
    missingConfigError: "Admin listing pricing private SITE_URL must be configured outside development/test",
    strategy: "site-url-only",
  });
}

async function readAdminListingPricingPayload(
  request: Request,
): Promise<
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; status: number; error: string }
> {
  const payloadResult = await readStateChangingJsonRequestPayload(
    request,
    ADMIN_LISTING_PRICING_JSON_ROUTE_CONFIG,
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}
