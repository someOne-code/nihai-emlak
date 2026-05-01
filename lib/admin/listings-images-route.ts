// Phase 8.3: admin listing image management route handlers.
//
// Endpoints:
//   POST   /api/admin/listings/:listingId/images           -> handleAdminListingsImagesAddPost
//   PATCH  /api/admin/listings/:listingId/images/order      -> handleAdminListingsImagesReorderPatch
//   DELETE /api/admin/listings/:listingId/images/:imageId   -> handleAdminListingsImagesDelete
//
// Contract: docs/ADMIN_LISTING_CONFIG_CONTRACT.md
// Authorization: profiles.role = 'admin' (route guard) plus DB-level
// auth.uid() + public.is_admin() inside the RPC bodies.

import {
  readStateChangingJsonRequestPayload,
  validateStateChangingJsonRequestEnvelope,
  validateStateChangingRequestOrigin,
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

const ADMIN_LISTING_IMAGE_JSON_ROUTE_CONFIG: StateChangingJsonRouteConfig = {
  maxBodyBytes: 8 * 1024,
  routeLabel: "Admin listing image",
};

// ---------------------------------------------------------------------------
// POST /api/admin/listings/:listingId/images
// ---------------------------------------------------------------------------

export async function handleAdminListingsImagesAddPost(
  request: Request,
  dependencies: AdminListingsRouteDependencies,
  params: { listingId: string },
): Promise<Response> {
  const envelopeResult = validateAdminListingImageRequestEnvelope(request);
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

  const bodyResult = await readAdminListingImagePayload(request);
  if (!bodyResult.ok) {
    return jsonError(bodyResult.error, bodyResult.status);
  }

  const { image_url, alt_text, is_primary } = bodyResult.value;

  if (typeof image_url !== "string" || !isValidHttpImageUrl(image_url)) {
    return jsonError("Invalid image url", 400);
  }

  const rpcResult = await guard.supabase.rpc("admin_add_listing_image", {
    p_listing_id: listingId,
    p_image_url: image_url.trim(),
    p_alt_text: typeof alt_text === "string" && alt_text.trim().length > 0 ? alt_text.trim() : null,
    p_is_primary: is_primary === true,
  });

  if (rpcResult.error) {
    return jsonError(...mapAdminListingRpcError(rpcResult.error, "Listing not found"));
  }

  if (!isPlainObject(rpcResult.data)) {
    return jsonError("Invalid admin listing image RPC response", 500);
  }

  return jsonResponse(
    {
      success: true,
      data: rpcResult.data,
    },
    201,
  );
}

// ---------------------------------------------------------------------------
// PATCH /api/admin/listings/:listingId/images/order
// ---------------------------------------------------------------------------

export async function handleAdminListingsImagesReorderPatch(
  request: Request,
  dependencies: AdminListingsRouteDependencies,
  params: { listingId: string },
): Promise<Response> {
  const envelopeResult = validateAdminListingImageRequestEnvelope(request);
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

  const bodyResult = await readAdminListingImagePayload(request);
  if (!bodyResult.ok) {
    return jsonError(bodyResult.error, bodyResult.status);
  }

  const order = bodyResult.value.order;
  if (!Array.isArray(order) || order.length === 0) {
    return jsonError("Invalid image order payload", 400);
  }

  // Validate all elements are non-empty strings.
  for (const id of order) {
    if (typeof id !== "string" || id.trim().length === 0) {
      return jsonError("Invalid image order payload", 400);
    }
  }

  const rpcResult = await guard.supabase.rpc("admin_reorder_listing_images", {
    p_listing_id: listingId,
    p_order: order,
  });

  if (rpcResult.error) {
    return jsonError(...mapAdminListingRpcError(rpcResult.error, "Listing not found"));
  }

  if (!Array.isArray(rpcResult.data)) {
    return jsonError("Invalid admin listing image RPC response", 500);
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
// DELETE /api/admin/listings/:listingId/images/:imageId
// ---------------------------------------------------------------------------

export async function handleAdminListingsImagesDelete(
  request: Request,
  dependencies: AdminListingsRouteDependencies,
  params: { listingId: string; imageId: string },
): Promise<Response> {
  const originResult = validateAdminListingImageRequestOrigin(request);
  if (!originResult.ok) {
    return jsonError(originResult.error, originResult.status);
  }

  const listingId = asUuid(params.listingId);
  if (!listingId) {
    return jsonError("Invalid listing id", 400);
  }

  const imageId = asUuid(params.imageId);
  if (!imageId) {
    return jsonError("Invalid image id", 400);
  }

  const guard = await guardAdminListingsRequest(dependencies);
  if (!guard.ok) {
    return guard.response;
  }

  const rpcResult = await guard.supabase.rpc("admin_delete_listing_image", {
    p_listing_id: listingId,
    p_image_id: imageId,
  });

  if (rpcResult.error) {
    return jsonError(...mapAdminListingRpcError(rpcResult.error, "Image not found"));
  }

  return new Response(null, {
    status: 204,
    headers: {
      "cache-control": "no-store",
    },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateAdminListingImageRequestEnvelope(
  request: Request,
): { ok: true } | { ok: false; status: number; error: string } {
  return validateStateChangingJsonRequestEnvelope(request, ADMIN_LISTING_IMAGE_JSON_ROUTE_CONFIG, {
    invalidConfigError: "Admin listing image trusted origin configuration is invalid",
    missingConfigError: "Admin listing image private SITE_URL must be configured outside development/test",
    strategy: "site-url-only",
  });
}

function validateAdminListingImageRequestOrigin(
  request: Request,
): { ok: true } | { ok: false; status: number; error: string } {
  return validateStateChangingRequestOrigin(request, ADMIN_LISTING_IMAGE_JSON_ROUTE_CONFIG, {
    invalidConfigError: "Admin listing image trusted origin configuration is invalid",
    missingConfigError: "Admin listing image private SITE_URL must be configured outside development/test",
    strategy: "site-url-only",
  });
}

async function readAdminListingImagePayload(
  request: Request,
): Promise<
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; status: number; error: string }
> {
  const payloadResult = await readStateChangingJsonRequestPayload(
    request,
    ADMIN_LISTING_IMAGE_JSON_ROUTE_CONFIG,
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

function isValidHttpImageUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return false;
  }

  return parsed.protocol === "http:" || parsed.protocol === "https:";
}
