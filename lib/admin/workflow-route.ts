import {
  readStateChangingJsonRequestPayload,
  validateStateChangingJsonRequestEnvelope,
  type StateChangingJsonRouteConfig,
} from "../http/state-changing-json-route.ts";

type SupabaseError = {
  code?: string | null;
  message?: string | null;
};

type SupabaseMaybeSingleResponse = {
  data: unknown;
  error: SupabaseError | null;
};

type SupabaseRpcResponse = {
  data: unknown;
  error: SupabaseError | null;
};

type SupabaseClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: SupabaseError | null;
    }>;
  };
  from: (table: "profiles") => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<SupabaseMaybeSingleResponse>;
      };
    };
  };
  rpc: (
    functionName:
      | "admin_cancel_reservation"
      | "admin_confirm_reservation"
      | "admin_reopen_listing",
    args: Record<string, unknown>,
  ) => Promise<SupabaseRpcResponse>;
};

export type AdminWorkflowRouteDependencies = {
  createServerSupabaseClient: () => Promise<unknown>;
};

const ADMIN_WORKFLOW_JSON_ROUTE_CONFIG: StateChangingJsonRouteConfig = {
  maxBodyBytes: 8 * 1024,
  routeLabel: "Admin workflow",
};

export async function handleAdminCancelReservationPost(
  request: Request,
  dependencies: AdminWorkflowRouteDependencies,
  params: { reservationId: string },
): Promise<Response> {
  const guard = await guardAdminWorkflowRequest(request, dependencies);
  if (!guard.ok) {
    return guard.response;
  }

  const reservationId = asUuid(params.reservationId);
  if (!reservationId) {
    return jsonError("Invalid reservation id", 400);
  }

  const bodyResult = await parseAdminCancelBody(request);
  if (!bodyResult.ok) {
    return jsonError(bodyResult.error, bodyResult.status);
  }

  const rpcResult = await guard.supabase.rpc("admin_cancel_reservation", {
    p_reservation_id: reservationId,
    p_cancel_reason: bodyResult.body.reason,
    p_note: bodyResult.body.note,
  });

  return buildWorkflowResponse(
    rpcResult,
    "Reservation not found",
    parseReservationWorkflowSuccess,
  );
}

export async function handleAdminConfirmReservationPost(
  request: Request,
  dependencies: AdminWorkflowRouteDependencies,
  params: { reservationId: string },
): Promise<Response> {
  const guard = await guardAdminWorkflowRequest(request, dependencies);
  if (!guard.ok) {
    return guard.response;
  }

  const reservationId = asUuid(params.reservationId);
  if (!reservationId) {
    return jsonError("Invalid reservation id", 400);
  }

  const bodyResult = await parseAdminNoteOnlyBody(request);
  if (!bodyResult.ok) {
    return jsonError(bodyResult.error, bodyResult.status);
  }

  const rpcResult = await guard.supabase.rpc("admin_confirm_reservation", {
    p_reservation_id: reservationId,
    p_note: bodyResult.body.note,
  });

  return buildWorkflowResponse(
    rpcResult,
    "Reservation not found",
    parseReservationWorkflowSuccess,
  );
}

export async function handleAdminReopenListingPost(
  request: Request,
  dependencies: AdminWorkflowRouteDependencies,
  params: { listingId: string },
): Promise<Response> {
  const guard = await guardAdminWorkflowRequest(request, dependencies);
  if (!guard.ok) {
    return guard.response;
  }

  const listingId = asUuid(params.listingId);
  if (!listingId) {
    return jsonError("Invalid listing id", 400);
  }

  const bodyResult = await parseAdminReasonBody(request, "Admin reopen reason is required");
  if (!bodyResult.ok) {
    return jsonError(bodyResult.error, bodyResult.status);
  }

  const rpcResult = await guard.supabase.rpc("admin_reopen_listing", {
    p_listing_id: listingId,
    p_reason: bodyResult.body.reason,
    p_note: bodyResult.body.note,
  });

  return buildWorkflowResponse(
    rpcResult,
    "Listing not found",
    parseListingWorkflowSuccess,
  );
}

async function guardAdminWorkflowRequest(
  request: Request,
  dependencies: AdminWorkflowRouteDependencies,
): Promise<
  | { ok: true; supabase: SupabaseClient }
  | { ok: false; response: Response }
> {
  const trustedRequestResult = validateStateChangingJsonRequestEnvelope(
    request,
    ADMIN_WORKFLOW_JSON_ROUTE_CONFIG,
  );
  if (!trustedRequestResult.ok) {
    return {
      ok: false,
      response: jsonError(trustedRequestResult.error, trustedRequestResult.status),
    };
  }

  const supabase = (await dependencies.createServerSupabaseClient()) as SupabaseClient;
  const userResult = await supabase.auth.getUser();
  if (userResult.error || !userResult.data.user) {
    return {
      ok: false,
      response: jsonError("Authentication required", 401),
    };
  }

  const profileResult = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userResult.data.user.id)
    .maybeSingle();

  const role = asNonEmptyString((profileResult.data as Record<string, unknown> | null)?.role ?? null);
  if (profileResult.error || role !== "admin") {
    return {
      ok: false,
      response: jsonError("Admin role required", 403),
    };
  }

  return {
    ok: true,
    supabase,
  };
}

async function parseAdminCancelBody(
  request: Request,
): Promise<
  | { ok: true; body: { reason: string; note: string | null } }
  | { ok: false; status: number; error: string }
> {
  return parseAdminReasonBody(request, "Admin cancel reason is required");
}

async function parseAdminReasonBody(
  request: Request,
  missingReasonError: string,
): Promise<
  | { ok: true; body: { reason: string; note: string | null } }
  | { ok: false; status: number; error: string }
> {
  const payloadResult = await readStateChangingJsonRequestPayload(
    request,
    ADMIN_WORKFLOW_JSON_ROUTE_CONFIG,
  );
  if (!payloadResult.ok) {
    return payloadResult;
  }

  if (!payloadResult.value || typeof payloadResult.value !== "object" || Array.isArray(payloadResult.value)) {
    return {
      ok: false,
      status: 400,
      error: "Invalid JSON request body",
    };
  }

  const body = payloadResult.value as Record<string, unknown>;
  const reason = asNonEmptyString(body.reason);
  const note = asOptionalBoundedString(body.note);

  if (!reason) {
    return {
      ok: false,
      status: 400,
      error: missingReasonError,
    };
  }

  if (reason.length > 120) {
    return {
      ok: false,
      status: 400,
      error: "Admin workflow reason is too long",
    };
  }

  if (typeof body.note === "string" && note === null) {
    return {
      ok: false,
      status: 400,
      error: "Admin workflow note is too long",
    };
  }

  return {
    ok: true,
    body: {
      reason,
      note,
    },
  };
}

async function parseAdminNoteOnlyBody(
  request: Request,
): Promise<
  | { ok: true; body: { note: string | null } }
  | { ok: false; status: number; error: string }
> {
  const payloadResult = await readStateChangingJsonRequestPayload(
    request,
    ADMIN_WORKFLOW_JSON_ROUTE_CONFIG,
  );
  if (!payloadResult.ok) {
    return payloadResult;
  }

  if (!payloadResult.value || typeof payloadResult.value !== "object" || Array.isArray(payloadResult.value)) {
    return {
      ok: false,
      status: 400,
      error: "Invalid JSON request body",
    };
  }

  const body = payloadResult.value as Record<string, unknown>;
  const note = asOptionalBoundedString(body.note);
  if (typeof body.note === "string" && note === null) {
    return {
      ok: false,
      status: 400,
      error: "Admin workflow note is too long",
    };
  }

  return {
    ok: true,
    body: { note },
  };
}

function buildWorkflowResponse<T>(
  rpcResult: SupabaseRpcResponse,
  notFoundError: string,
  parseSuccess: (value: unknown) => T | null,
): Response {
  if (rpcResult.error) {
    return jsonError(...mapAdminWorkflowRpcError(rpcResult.error, notFoundError));
  }

  const summary = parseSuccess(rpcResult.data);
  if (!summary) {
    return jsonError("Invalid admin workflow RPC response", 500);
  }

  return jsonResponse(
    {
      success: true,
      data: summary,
    },
    200,
  );
}

function mapAdminWorkflowRpcError(
  error: SupabaseError,
  notFoundError: string,
): [string, number] {
  const code = asNonEmptyString(error.code);
  const message = asNonEmptyString(error.message);

  if (code === "28000") {
    return ["Authentication required", 401];
  }

  if (code === "42501") {
    return ["Admin role required", 403];
  }

  if (code === "P0002") {
    return [notFoundError, 404];
  }

  if (code === "P0001") {
    return ["Admin workflow conflict", 409];
  }

  if (code === "P0004") {
    return ["Admin workflow invariant violation", 500];
  }

  if (code === "22023") {
    if (isAdminWorkflowInvariantMessage(message)) {
      return ["Admin workflow invariant violation", 500];
    }

    return ["Invalid admin workflow request", 400];
  }

  return ["Admin workflow RPC failed", 500];
}

function isAdminWorkflowInvariantMessage(message: string | null): boolean {
  const normalizedMessage = message?.trim().toLowerCase() ?? "";
  if (!normalizedMessage) {
    return false;
  }

  return normalizedMessage.includes("invariant");
}

function parseReservationWorkflowSuccess(value: unknown): {
  result: string;
  eventId: string;
  reservation: { id: string; status: string };
  order: { id: string; status: string };
  payment: { id: string; status: string };
  listing: { id: string; status: string };
} | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;
  const result = asNonEmptyString(row.result);
  const eventId = asUuid(row.event_id);
  const reservationId = asUuid(row.reservation_id);
  const orderId = asUuid(row.order_id);
  const paymentId = asUuid(row.payment_id);
  const listingId = asUuid(row.listing_id);
  const reservationStatus = asNonEmptyString(row.reservation_status);
  const orderStatus = asNonEmptyString(row.order_status);
  const paymentStatus = asNonEmptyString(row.payment_status);
  const listingStatus = asNonEmptyString(row.listing_status);

  if (
    !result
    || !eventId
    || !reservationId
    || !orderId
    || !paymentId
    || !listingId
    || !reservationStatus
    || !orderStatus
    || !paymentStatus
    || !listingStatus
  ) {
    return null;
  }

  return {
    result,
    eventId,
    reservation: {
      id: reservationId,
      status: reservationStatus,
    },
    order: {
      id: orderId,
      status: orderStatus,
    },
    payment: {
      id: paymentId,
      status: paymentStatus,
    },
    listing: {
      id: listingId,
      status: listingStatus,
    },
  };
}

function parseListingWorkflowSuccess(value: unknown): {
  result: string;
  eventId: string;
  listing: { id: string; status: string };
} | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;
  const result = asNonEmptyString(row.result);
  const eventId = asUuid(row.event_id);
  const listingId = asUuid(row.listing_id);
  const listingStatus = asNonEmptyString(row.listing_status);

  if (!result || !eventId || !listingId || !listingStatus) {
    return null;
  }

  return {
    result,
    eventId,
    listing: {
      id: listingId,
      status: listingStatus,
    },
  };
}

function jsonError(error: string, status: number): Response {
  return jsonResponse(
    {
      success: false,
      error,
    },
    status,
  );
}

function jsonResponse(payload: unknown, status: number): Response {
  return Response.json(payload, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}

function asOptionalBoundedString(value: unknown): string | null {
  const normalized = asNonEmptyString(value);
  if (!normalized) {
    return null;
  }

  if (normalized.length > 1000) {
    return null;
  }

  return normalized;
}

function asUuid(value: unknown): string | null {
  const normalized = asNonEmptyString(value);
  if (!normalized || !isUuid(normalized)) {
    return null;
  }

  return normalized.toLowerCase();
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return value.trim();
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
