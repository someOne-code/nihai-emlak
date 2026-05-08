import {
  validateStateChangingJsonRequestEnvelope,
  readStateChangingJsonRequestPayload,
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
      | "admin_request_documents"
      | "admin_mark_documents_waiting"
      | "admin_mark_documents_completed"
      | "admin_mark_documents_failed"
      | "get_admin_reservation_documents"
      | "admin_mark_refund_required"
      | "admin_mark_refund_requested"
      | "admin_mark_refund_completed"
      | "admin_mark_deposit_forfeited"
      | "admin_mark_manual_resolution_required"
      | "admin_mark_conflict_payment"
      | "admin_mark_payment_issue_resolved"
      | "admin_mark_payment_not_received"
      | "get_admin_reservation_finance_ops"
      | "list_admin_reservation_event_history"
      | "admin_reopen_listing"
      | "log_admin_workflow_invariant_rejection",
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
    p_refund_decision: bodyResult.body.refundDecision,
    p_note: bodyResult.body.note,
  });
  const invariantAuditFailure = await auditAdminWorkflowInvariantRejection(guard.supabase, rpcResult.error, {
    workflowName: "admin_cancel_reservation_rejected",
    reservationId,
    listingId: null,
    reason: bodyResult.body.refundDecision,
    note: bodyResult.body.note,
  });
  if (invariantAuditFailure) {
    return invariantAuditFailure;
  }

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
  const invariantAuditFailure = await auditAdminWorkflowInvariantRejection(guard.supabase, rpcResult.error, {
    workflowName: "admin_confirm_reservation_rejected",
    reservationId,
    listingId: null,
    reason: null,
    note: bodyResult.body.note,
  });
  if (invariantAuditFailure) {
    return invariantAuditFailure;
  }

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
  const invariantAuditFailure = await auditAdminWorkflowInvariantRejection(guard.supabase, rpcResult.error, {
    workflowName: "admin_reopen_listing_rejected",
    reservationId: null,
    listingId,
    reason: bodyResult.body.reason,
    note: bodyResult.body.note,
  });
  if (invariantAuditFailure) {
    return invariantAuditFailure;
  }

  return buildWorkflowResponse(
    rpcResult,
    "Listing not found",
    parseListingWorkflowSuccess,
  );
}

export async function handleAdminReservationDocumentsGet(
  _request: Request,
  dependencies: AdminWorkflowRouteDependencies,
  params: { reservationId: string },
): Promise<Response> {
  const guard = await guardAdminWorkflowReadRequest(dependencies);
  if (!guard.ok) {
    return guard.response;
  }

  const reservationId = asUuid(params.reservationId);
  if (!reservationId) {
    return jsonError("Invalid reservation id", 400);
  }

  const rpcResult = await guard.supabase.rpc("get_admin_reservation_documents", {
    p_reservation_id: reservationId,
  });
  if (rpcResult.error) {
    return jsonError(...mapAdminWorkflowRpcError(rpcResult.error, "Reservation not found"));
  }

  if (!isRecord(rpcResult.data)) {
    return jsonError("Invalid admin document tracking RPC response", 500);
  }

  return jsonResponse({ success: true, data: rpcResult.data }, 200);
}

export async function handleAdminReservationDocumentsPost(
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

  const bodyResult = await parseAdminDocumentBody(request);
  if (!bodyResult.ok) {
    return jsonError(bodyResult.error, bodyResult.status);
  }

  const rpcResult = await guard.supabase.rpc(DOCUMENT_STATUS_RPC_MAP[bodyResult.body.status], {
    p_reservation_id: reservationId,
    p_note: bodyResult.body.note,
  });

  return buildWorkflowResponse(
    rpcResult,
    "Reservation not found",
    parseReservationDocumentWorkflowSuccess,
  );
}

export async function handleAdminReservationFinanceOpsGet(
  _request: Request,
  dependencies: AdminWorkflowRouteDependencies,
  params: { reservationId: string },
): Promise<Response> {
  const guard = await guardAdminWorkflowReadRequest(dependencies);
  if (!guard.ok) {
    return guard.response;
  }

  const reservationId = asUuid(params.reservationId);
  if (!reservationId) {
    return jsonError("Invalid reservation id", 400);
  }

  const rpcResult = await guard.supabase.rpc("get_admin_reservation_finance_ops", {
    p_reservation_id: reservationId,
  });
  if (rpcResult.error) {
    return jsonError(...mapAdminWorkflowRpcError(rpcResult.error, "Reservation not found"));
  }

  if (!isRecord(rpcResult.data)) {
    return jsonError("Invalid admin finance ops RPC response", 500);
  }

  return jsonResponse({ success: true, data: rpcResult.data }, 200);
}

export async function handleAdminReservationEventHistoryGet(
  _request: Request,
  dependencies: AdminWorkflowRouteDependencies,
  params: { reservationId: string },
): Promise<Response> {
  const guard = await guardAdminWorkflowReadRequest(dependencies);
  if (!guard.ok) {
    return guard.response;
  }

  const reservationId = asUuid(params.reservationId);
  if (!reservationId) {
    return jsonError("Invalid reservation id", 400);
  }

  const rpcResult = await guard.supabase.rpc("list_admin_reservation_event_history", {
    p_reservation_id: reservationId,
  });
  if (rpcResult.error) {
    return jsonError(...mapAdminWorkflowRpcError(rpcResult.error, "Reservation not found"));
  }

  if (!isRecord(rpcResult.data)) {
    return jsonError("Invalid admin event history RPC response", 500);
  }

  return jsonResponse({ success: true, data: rpcResult.data }, 200);
}

export async function handleAdminReservationFinanceOpsPost(
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

  const bodyResult = await parseAdminFinanceOpsBody(request);
  if (!bodyResult.ok) {
    return jsonError(bodyResult.error, bodyResult.status);
  }

  const rpcResult = await guard.supabase.rpc(FINANCE_STATUS_RPC_MAP[bodyResult.body.status], {
    p_reservation_id: reservationId,
    p_note: bodyResult.body.note,
  });
  const invariantAuditFailure = await auditAdminWorkflowInvariantRejection(guard.supabase, rpcResult.error, {
    workflowName: `${FINANCE_STATUS_RPC_MAP[bodyResult.body.status]}_rejected`,
    reservationId,
    listingId: null,
    reason: bodyResult.body.status,
    note: bodyResult.body.note,
  });
  if (invariantAuditFailure) {
    return invariantAuditFailure;
  }

  return buildWorkflowResponse(
    rpcResult,
    "Reservation not found",
    parseReservationFinanceOpsSuccess,
  );
}

async function guardAdminWorkflowRequest(
  request: Request,
  dependencies: AdminWorkflowRouteDependencies,
): Promise<
  | { ok: true; supabase: SupabaseClient }
  | { ok: false; response: Response }
> {
  const trustedRequestResult = validateAdminWorkflowRequestEnvelope(
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

  if (profileResult.error) {
    return {
      ok: false,
      response: jsonError("Admin profile lookup failed", 500),
    };
  }

  const role = asNonEmptyString((profileResult.data as Record<string, unknown> | null)?.role ?? null);
  if (role !== "admin") {
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

async function guardAdminWorkflowReadRequest(
  dependencies: AdminWorkflowRouteDependencies,
): Promise<
  | { ok: true; supabase: SupabaseClient }
  | { ok: false; response: Response }
> {
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

  if (profileResult.error) {
    return {
      ok: false,
      response: jsonError("Admin profile lookup failed", 500),
    };
  }

  const role = asNonEmptyString((profileResult.data as Record<string, unknown> | null)?.role ?? null);
  if (role !== "admin") {
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

function validateAdminWorkflowRequestEnvelope(
  request: Request,
  config: StateChangingJsonRouteConfig,
): { ok: true } | { ok: false; status: number; error: string } {
  return validateStateChangingJsonRequestEnvelope(request, config, {
    invalidConfigError: "Admin workflow trusted origin configuration is invalid",
    missingConfigError: "Admin workflow private SITE_URL must be configured outside development/test",
    strategy: "site-url-only",
  });
}

async function parseAdminCancelBody(
  request: Request,
): Promise<
  | { ok: true; body: { refundDecision: "manual_refund" | "no_refund"; note: string } }
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
      error: "Invalid admin workflow request body",
    };
  }

  const value = payloadResult.value as Record<string, unknown>;
  const refundDecision = asNonEmptyString(value.refundDecision);
  if (refundDecision !== "manual_refund" && refundDecision !== "no_refund") {
    return {
      ok: false,
      status: 400,
      error: "İade durumu seçilmelidir",
    };
  }

  if (value.note !== undefined && typeof value.note !== "string") {
    return {
      ok: false,
      status: 400,
      error: "Admin workflow note must be a string",
    };
  }

  const note = asNonEmptyString(value.note);
  if (!note) {
    return {
      ok: false,
      status: 400,
      error: "İptal notu zorunludur",
    };
  }

  return {
    ok: true,
    body: {
      refundDecision,
      note,
    },
  };
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
  const noteResult = parseOptionalAdminWorkflowNote(body.note);

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

  if (!noteResult.ok) {
    return {
      ok: false,
      status: 400,
      error: noteResult.error,
    };
  }

  return {
    ok: true,
    body: {
      reason,
      note: noteResult.value,
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
    { emptyBodyValue: {} },
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
  const noteResult = parseOptionalAdminWorkflowNote(body.note);
  if (!noteResult.ok) {
    return {
      ok: false,
      status: 400,
      error: noteResult.error,
    };
  }

  return {
    ok: true,
    body: { note: noteResult.value },
  };
}

const DOCUMENT_STATUS_RPC_MAP = {
  requested: "admin_request_documents",
  waiting: "admin_mark_documents_waiting",
  completed: "admin_mark_documents_completed",
  failed: "admin_mark_documents_failed",
} as const;

const FINANCE_STATUS_RPC_MAP = {
  refund_required: "admin_mark_refund_required",
  refund_requested: "admin_mark_refund_requested",
  refund_completed: "admin_mark_refund_completed",
  deposit_forfeited: "admin_mark_deposit_forfeited",
  manual_resolution_required: "admin_mark_manual_resolution_required",
  conflict_payment: "admin_mark_conflict_payment",
  issue_resolved: "admin_mark_payment_issue_resolved",
  payment_not_received: "admin_mark_payment_not_received",
} as const;

async function parseAdminDocumentBody(
  request: Request,
): Promise<
  | { ok: true; body: { status: keyof typeof DOCUMENT_STATUS_RPC_MAP; note: string | null } }
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
  const status = asNonEmptyString(body.status);
  if (!status || !(status in DOCUMENT_STATUS_RPC_MAP)) {
    return {
      ok: false,
      status: 400,
      error: "Invalid document workflow status",
    };
  }

  const noteResult = parseOptionalAdminWorkflowNote(body.note);
  if (!noteResult.ok) {
    return {
      ok: false,
      status: 400,
      error: noteResult.error,
    };
  }

  return {
    ok: true,
    body: {
      status: status as keyof typeof DOCUMENT_STATUS_RPC_MAP,
      note: noteResult.value,
    },
  };
}

async function parseAdminFinanceOpsBody(
  request: Request,
): Promise<
  | { ok: true; body: { status: keyof typeof FINANCE_STATUS_RPC_MAP; note: string | null } }
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
  const status = asNonEmptyString(body.status);
  if (!status || !(status in FINANCE_STATUS_RPC_MAP)) {
    return {
      ok: false,
      status: 400,
      error: "Invalid finance workflow status",
    };
  }

  const noteResult = parseOptionalAdminWorkflowNote(body.note);
  if (!noteResult.ok) {
    return {
      ok: false,
      status: 400,
      error: noteResult.error,
    };
  }

  return {
    ok: true,
    body: {
      status: status as keyof typeof FINANCE_STATUS_RPC_MAP,
      note: noteResult.value,
    },
  };
}

async function auditAdminWorkflowInvariantRejection(
  supabase: SupabaseClient,
  error: SupabaseError | null,
  input: {
    workflowName: string;
    reservationId: string | null;
    listingId: string | null;
    reason: string | null;
    note: string | null;
  },
): Promise<Response | null> {
  if (asNonEmptyString(error?.code) !== "P0004") {
    return null;
  }

  const auditResult = await supabase.rpc("log_admin_workflow_invariant_rejection", {
    p_workflow_name: input.workflowName,
    p_reservation_id: input.reservationId,
    p_listing_id: input.listingId,
    p_reason: input.reason,
    p_note: input.note,
    p_payload: {
      error_code: asNonEmptyString(error?.code),
      error_message: asNonEmptyString(error?.message),
    },
  });

  if (auditResult.error || !asUuid(auditResult.data)) {
    return jsonError("Failed to audit admin workflow invariant violation", 500);
  }

  return null;
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
    return ["Invalid admin workflow request", 400];
  }

  return ["Admin workflow RPC failed", 500];
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

function parseReservationDocumentWorkflowSuccess(value: unknown): {
  result: string;
  eventId: string;
  reservationId: string;
  orderId: string;
  paymentId: string | null;
  listingId: string;
  documentStatus: string;
  adminNote: string | null;
  updatedAt: string | null;
} | null {
  if (!isRecord(value)) {
    return null;
  }

  const result = asNonEmptyString(value.result);
  const eventId = asUuid(value.event_id);
  const reservationId = asUuid(value.reservation_id);
  const orderId = asUuid(value.order_id);
  const paymentIdRaw = value.payment_id;
  const paymentId = paymentIdRaw === null ? null : asUuid(paymentIdRaw);
  const listingId = asUuid(value.listing_id);
  const documentStatus = asNonEmptyString(value.document_status);

  if (!result || !eventId || !reservationId || !orderId || !paymentId || !listingId || !documentStatus) {
    return null;
  }

  return {
    result,
    eventId,
    reservationId,
    orderId,
    paymentId,
    listingId,
    documentStatus,
    adminNote: asNonEmptyString(value.admin_note),
    updatedAt: asNonEmptyString(value.updated_at),
  };
}

function parseReservationFinanceOpsSuccess(value: unknown): {
  result: string;
  eventId: string;
  reservationId: string;
  orderId: string;
  paymentId: string | null;
  listingId: string;
  financeStatus: string;
  adminNote: string | null;
  updatedAt: string | null;
} | null {
  if (!isRecord(value)) {
    return null;
  }

  const result = asNonEmptyString(value.result);
  const eventId = asUuid(value.event_id);
  const reservationId = asUuid(value.reservation_id);
  const orderId = asUuid(value.order_id);
  const paymentIdRaw = value.payment_id;
  const paymentId = paymentIdRaw === null ? null : asUuid(paymentIdRaw);
  const listingId = asUuid(value.listing_id);
  const financeStatus = asNonEmptyString(value.finance_status);

  if (
    !result
    || !eventId
    || !reservationId
    || !orderId
    || (paymentIdRaw !== null && !paymentId)
    || !listingId
    || !financeStatus
  ) {
    return null;
  }

  return {
    result,
    eventId,
    reservationId,
    orderId,
    paymentId,
    listingId,
    financeStatus,
    adminNote: asNonEmptyString(value.admin_note),
    updatedAt: asNonEmptyString(value.updated_at),
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

function parseOptionalAdminWorkflowNote(
  value: unknown,
):
  | { ok: true; value: string | null }
  | { ok: false; error: string } {
  if (value === undefined || value === null) {
    return {
      ok: true,
      value: null,
    };
  }

  if (typeof value !== "string") {
    return {
      ok: false,
      error: "Admin workflow note must be a string",
    };
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return {
      ok: true,
      value: null,
    };
  }

  if (normalized.length > 1000) {
    return {
      ok: false,
      error: "Admin workflow note is too long",
    };
  }

  return {
    ok: true,
    value: normalized,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
