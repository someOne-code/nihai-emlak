// Phase 9B: Route handlers for global catalog administration.
//
// Endpoints:
//   GET  /api/admin/catalog/main-items            -> handleAdminCatalogMainItemGet
//   POST /api/admin/catalog/main-items            -> handleAdminCatalogMainItemPost
//   PATCH /api/admin/catalog/main-items/:code     -> handleAdminCatalogMainItemPatch
//   GET  /api/admin/catalog/services              -> handleAdminCatalogServiceGet
//   POST /api/admin/catalog/services              -> handleAdminCatalogServicePost
//   PATCH /api/admin/catalog/services/:code       -> handleAdminCatalogServicePatch
//
// Authorization: profiles.role = 'admin' (route guard) plus DB-level
//   auth.uid() + public.is_admin() inside the RPC bodies.

import {
  readStateChangingJsonRequestPayload,
  validateStateChangingJsonRequestEnvelope,
  type StateChangingJsonRouteConfig,
} from "../http/state-changing-json-route.ts";
import {
  asNonEmptyString,
  guardAdminListingsRequest,
  jsonError,
  jsonResponse,
  mapAdminListingRpcError,
  type AdminListingsRouteDependencies,
} from "./listings-shared.ts";

const ADMIN_CATALOG_JSON_ROUTE_CONFIG: StateChangingJsonRouteConfig = {
  maxBodyBytes: 8 * 1024,
  routeLabel: "Admin catalog",
};

// ---------------------------------------------------------------------------
// GET /api/admin/catalog/main-items
// ---------------------------------------------------------------------------

export async function handleAdminCatalogMainItemGet(
  _request: Request,
  dependencies: AdminListingsRouteDependencies,
): Promise<Response> {
  const guard = await guardAdminListingsRequest(dependencies);
  if (!guard.ok) {
    return guard.response;
  }

  const rpcResult = await guard.supabase.rpc(
    "admin_list_main_item_catalog",
    {},
  );
  if (rpcResult.error) {
    return jsonError(
      ...mapAdminListingRpcError(
        rpcResult.error,
        "Ana kalem kataloğu bulunamadı",
        "Ana kalem kataloğu yüklenemedi",
      ),
    );
  }

  return jsonResponse({ success: true, data: rpcResult.data }, 200);
}

// ---------------------------------------------------------------------------
// POST /api/admin/catalog/main-items
// ---------------------------------------------------------------------------

export async function handleAdminCatalogMainItemPost(
  request: Request,
  dependencies: AdminListingsRouteDependencies,
): Promise<Response> {
  const envelopeResult = validateCatalogRequestEnvelope(request);
  if (!envelopeResult.ok) {
    return jsonError(envelopeResult.error, envelopeResult.status);
  }

  const guard = await guardAdminListingsRequest(dependencies);
  if (!guard.ok) {
    return guard.response;
  }

  const bodyResult = await readCatalogPayload(request);
  if (!bodyResult.ok) {
    return jsonError(bodyResult.error, bodyResult.status);
  }

  const validationError = validateMainItemPayload(bodyResult.value);
  if (validationError) {
    return jsonError(validationError, 400);
  }

  const rpcResult = await guard.supabase.rpc("admin_create_main_item_catalog", {
    p_payload: bodyResult.value,
  });

  if (rpcResult.error) {
    return jsonError(...mapAdminCatalogRpcError(rpcResult.error));
  }

  if (!isPlainObject(rpcResult.data)) {
    return jsonError("Invalid catalog RPC response", 500);
  }

  return jsonResponse({ success: true, data: rpcResult.data }, 201);
}

// ---------------------------------------------------------------------------
// PATCH /api/admin/catalog/main-items/:code
// ---------------------------------------------------------------------------

export async function handleAdminCatalogMainItemPatch(
  request: Request,
  dependencies: AdminListingsRouteDependencies,
  params: { code: string },
): Promise<Response> {
  const envelopeResult = validateCatalogRequestEnvelope(request);
  if (!envelopeResult.ok) {
    return jsonError(envelopeResult.error, envelopeResult.status);
  }

  const code = asNonEmptyString(params.code);
  if (!code) {
    return jsonError("Invalid catalog item code", 400);
  }

  const guard = await guardAdminListingsRequest(dependencies);
  if (!guard.ok) {
    return guard.response;
  }

  const bodyResult = await readCatalogPayload(request);
  if (!bodyResult.ok) {
    return jsonError(bodyResult.error, bodyResult.status);
  }

  const validationError = validateMainItemPayload(bodyResult.value);
  if (validationError) {
    return jsonError(validationError, 400);
  }

  const rpcResult = await guard.supabase.rpc("admin_update_main_item_catalog", {
    p_code: code,
    p_payload: bodyResult.value,
  });

  if (rpcResult.error) {
    return jsonError(...mapAdminCatalogRpcError(rpcResult.error));
  }

  if (!isPlainObject(rpcResult.data)) {
    return jsonError("Invalid catalog RPC response", 500);
  }

  return jsonResponse({ success: true, data: rpcResult.data }, 200);
}

// ---------------------------------------------------------------------------
// GET /api/admin/catalog/services
// ---------------------------------------------------------------------------

export async function handleAdminCatalogServiceGet(
  _request: Request,
  dependencies: AdminListingsRouteDependencies,
): Promise<Response> {
  const guard = await guardAdminListingsRequest(dependencies);
  if (!guard.ok) {
    return guard.response;
  }

  const rpcResult = await guard.supabase.rpc("admin_list_service_catalog", {});
  if (rpcResult.error) {
    return jsonError(
      ...mapAdminListingRpcError(
        rpcResult.error,
        "Ek hizmet kataloğu bulunamadı",
        "Ek hizmet kataloğu yüklenemedi",
      ),
    );
  }

  return jsonResponse({ success: true, data: rpcResult.data }, 200);
}

// ---------------------------------------------------------------------------
// POST /api/admin/catalog/services
// ---------------------------------------------------------------------------

export async function handleAdminCatalogServicePost(
  request: Request,
  dependencies: AdminListingsRouteDependencies,
): Promise<Response> {
  const envelopeResult = validateCatalogRequestEnvelope(request);
  if (!envelopeResult.ok) {
    return jsonError(envelopeResult.error, envelopeResult.status);
  }

  const guard = await guardAdminListingsRequest(dependencies);
  if (!guard.ok) {
    return guard.response;
  }

  const bodyResult = await readCatalogPayload(request);
  if (!bodyResult.ok) {
    return jsonError(bodyResult.error, bodyResult.status);
  }

  const validationError = validateServicePayload(bodyResult.value);
  if (validationError) {
    return jsonError(validationError, 400);
  }

  const rpcResult = await guard.supabase.rpc("admin_create_service_catalog", {
    p_payload: bodyResult.value,
  });

  if (rpcResult.error) {
    return jsonError(...mapAdminCatalogRpcError(rpcResult.error));
  }

  if (!isPlainObject(rpcResult.data)) {
    return jsonError("Invalid catalog RPC response", 500);
  }

  return jsonResponse({ success: true, data: rpcResult.data }, 201);
}

// ---------------------------------------------------------------------------
// PATCH /api/admin/catalog/services/:code
// ---------------------------------------------------------------------------

export async function handleAdminCatalogServicePatch(
  request: Request,
  dependencies: AdminListingsRouteDependencies,
  params: { code: string },
): Promise<Response> {
  const envelopeResult = validateCatalogRequestEnvelope(request);
  if (!envelopeResult.ok) {
    return jsonError(envelopeResult.error, envelopeResult.status);
  }

  const code = asNonEmptyString(params.code);
  if (!code) {
    return jsonError("Invalid catalog item code", 400);
  }

  const guard = await guardAdminListingsRequest(dependencies);
  if (!guard.ok) {
    return guard.response;
  }

  const bodyResult = await readCatalogPayload(request);
  if (!bodyResult.ok) {
    return jsonError(bodyResult.error, bodyResult.status);
  }

  const validationError = validateServicePayload(bodyResult.value);
  if (validationError) {
    return jsonError(validationError, 400);
  }

  const rpcResult = await guard.supabase.rpc("admin_update_service_catalog", {
    p_code: code,
    p_payload: bodyResult.value,
  });

  if (rpcResult.error) {
    return jsonError(...mapAdminCatalogRpcError(rpcResult.error));
  }

  if (!isPlainObject(rpcResult.data)) {
    return jsonError("Invalid catalog RPC response", 500);
  }

  return jsonResponse({ success: true, data: rpcResult.data }, 200);
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateMainItemPayload(body: Record<string, unknown>): string | null {
  if (body.default_amount !== undefined && body.default_amount !== null) {
    const amount = Number(body.default_amount);
    if (!Number.isFinite(amount) || amount < 0) {
      return "default_amount negatif olamaz";
    }
  }
  if (
    body.default_multiplier !== undefined &&
    body.default_multiplier !== null
  ) {
    const mult = Number(body.default_multiplier);
    if (!Number.isFinite(mult) || mult < 0) {
      return "default_multiplier negatif olamaz";
    }
  }
  return null;
}

function validateServicePayload(body: Record<string, unknown>): string | null {
  if (body.base_price !== undefined && body.base_price !== null) {
    const price = Number(body.base_price);
    if (!Number.isFinite(price) || price < 0) {
      return "base_price negatif olamaz";
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function validateCatalogRequestEnvelope(
  request: Request,
): { ok: true } | { ok: false; status: number; error: string } {
  // GET requests don't need body validation
  if (request.method === "GET") {
    return { ok: true };
  }
  return validateStateChangingJsonRequestEnvelope(
    request,
    ADMIN_CATALOG_JSON_ROUTE_CONFIG,
    {
      invalidConfigError:
        "Admin catalog trusted origin configuration is invalid",
      missingConfigError:
        "Admin catalog private SITE_URL must be configured outside development/test",
      strategy: "site-url-only",
    },
  );
}

async function readCatalogPayload(
  request: Request,
): Promise<
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; status: number; error: string }
> {
  const payloadResult = await readStateChangingJsonRequestPayload(
    request,
    ADMIN_CATALOG_JSON_ROUTE_CONFIG,
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

  return { ok: true, value: payloadResult.value };
}

function mapAdminCatalogRpcError(error: {
  code?: string | null;
  message?: string | null;
}): [string, number] {
  if (error.code === "23505" && error.message?.includes("main item label")) {
    return ["Ana ödeme kalemi etiketi zaten kullanılıyor", 409];
  }

  return mapAdminListingRpcError(
    error,
    "Katalog kalemi bulunamadı",
    "Katalog kaydedilemedi",
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
