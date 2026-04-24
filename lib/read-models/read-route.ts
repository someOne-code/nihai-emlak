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

type ReadModelRpcName =
  | "list_public_listings"
  | "get_public_listing_detail"
  | "list_public_listing_services"
  | "list_admin_reservations"
  | "list_admin_orders"
  | "list_admin_payments"
  | "list_admin_payment_events";

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
    functionName: ReadModelRpcName,
    args: Record<string, unknown>,
  ) => Promise<SupabaseRpcResponse>;
};

export type ReadModelRouteDependencies = {
  createServerSupabaseClient: () => Promise<unknown>;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function handlePublicListingsGet(
  request: Request,
  dependencies: ReadModelRouteDependencies,
): Promise<Response> {
  const query = parsePublicListingsQuery(request);
  if (!query.ok) {
    return jsonError(query.error, 400);
  }

  const supabase = (await dependencies.createServerSupabaseClient()) as SupabaseClient;
  const rpcResult = await supabase.rpc("list_public_listings", {
    p_type: query.value.type,
    p_city: query.value.city,
    p_limit: query.value.limit,
    p_offset: query.value.offset,
  });
  if (rpcResult.error) {
    return jsonError(...mapPublicReadRpcError(rpcResult.error));
  }

  return jsonSuccess(rpcResult.data);
}

export async function handlePublicListingDetailGet(
  _request: Request,
  dependencies: ReadModelRouteDependencies,
  params: { listingId: string },
): Promise<Response> {
  const listingId = asUuid(params.listingId);
  if (!listingId) {
    return jsonError("Invalid listing id", 400);
  }

  const supabase = (await dependencies.createServerSupabaseClient()) as SupabaseClient;
  const rpcResult = await supabase.rpc("get_public_listing_detail", {
    p_listing_id: listingId,
  });
  if (rpcResult.error) {
    return jsonError(...mapPublicReadRpcError(rpcResult.error, "Listing not found"));
  }

  return jsonSuccess(rpcResult.data);
}

export async function handlePublicListingServicesGet(
  _request: Request,
  dependencies: ReadModelRouteDependencies,
  params: { listingId: string },
): Promise<Response> {
  const listingId = asUuid(params.listingId);
  if (!listingId) {
    return jsonError("Invalid listing id", 400);
  }

  const supabase = (await dependencies.createServerSupabaseClient()) as SupabaseClient;
  const rpcResult = await supabase.rpc("list_public_listing_services", {
    p_listing_id: listingId,
  });
  if (rpcResult.error) {
    return jsonError(...mapPublicReadRpcError(rpcResult.error, "Listing not found"));
  }

  return jsonSuccess(rpcResult.data);
}

export async function handleAdminReservationsGet(
  request: Request,
  dependencies: ReadModelRouteDependencies,
): Promise<Response> {
  const guard = await guardAdminReadRequest(dependencies);
  if (!guard.ok) {
    return guard.response;
  }

  const query = parseAdminListQuery(request, {
    statusParam: "status",
    allowedStatuses: ["pending", "confirmed", "cancelled", "expired"],
  });
  if (!query.ok) {
    return jsonError(query.error, 400);
  }

  const rpcResult = await guard.supabase.rpc("list_admin_reservations", {
    p_status: query.value.status,
    p_limit: query.value.limit,
    p_offset: query.value.offset,
  });
  if (rpcResult.error) {
    return jsonError(...mapAdminReadRpcError(rpcResult.error));
  }

  return jsonSuccess(rpcResult.data);
}

export async function handleAdminOrdersGet(
  request: Request,
  dependencies: ReadModelRouteDependencies,
): Promise<Response> {
  const guard = await guardAdminReadRequest(dependencies);
  if (!guard.ok) {
    return guard.response;
  }

  const query = parseAdminListQuery(request, {
    statusParam: "status",
    allowedStatuses: ["pending", "completed", "cancelled", "failed", "conflict"],
  });
  if (!query.ok) {
    return jsonError(query.error, 400);
  }

  const rpcResult = await guard.supabase.rpc("list_admin_orders", {
    p_status: query.value.status,
    p_limit: query.value.limit,
    p_offset: query.value.offset,
  });
  if (rpcResult.error) {
    return jsonError(...mapAdminReadRpcError(rpcResult.error));
  }

  return jsonSuccess(rpcResult.data);
}

export async function handleAdminPaymentsGet(
  request: Request,
  dependencies: ReadModelRouteDependencies,
): Promise<Response> {
  const guard = await guardAdminReadRequest(dependencies);
  if (!guard.ok) {
    return guard.response;
  }

  const query = parseAdminListQuery(request, {
    statusParam: "status",
    allowedStatuses: ["pending", "succeeded", "failed", "cancelled", "refunded", "conflict"],
  });
  if (!query.ok) {
    return jsonError(query.error, 400);
  }

  const rpcResult = await guard.supabase.rpc("list_admin_payments", {
    p_status: query.value.status,
    p_limit: query.value.limit,
    p_offset: query.value.offset,
  });
  if (rpcResult.error) {
    return jsonError(...mapAdminReadRpcError(rpcResult.error));
  }

  return jsonSuccess(rpcResult.data);
}

export async function handleAdminPaymentEventsGet(
  request: Request,
  dependencies: ReadModelRouteDependencies,
): Promise<Response> {
  const guard = await guardAdminReadRequest(dependencies);
  if (!guard.ok) {
    return guard.response;
  }

  const query = parseAdminPaymentEventsQuery(request);
  if (!query.ok) {
    return jsonError(query.error, 400);
  }

  const rpcResult = await guard.supabase.rpc("list_admin_payment_events", {
    p_payment_id: query.value.paymentId,
    p_limit: query.value.limit,
    p_offset: query.value.offset,
  });
  if (rpcResult.error) {
    return jsonError(...mapAdminReadRpcError(rpcResult.error));
  }

  return jsonSuccess(rpcResult.data);
}

async function guardAdminReadRequest(
  dependencies: ReadModelRouteDependencies,
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

function parsePublicListingsQuery(
  request: Request,
): { ok: true; value: { type: "rent" | "sale" | null; city: string | null; limit: number; offset: number } } | {
  ok: false;
  error: string;
} {
  const url = new URL(request.url);
  const typeRaw = asNonEmptyString(url.searchParams.get("type"));
  const city = asNonEmptyString(url.searchParams.get("city"));

  let type: "rent" | "sale" | null = null;
  if (typeRaw) {
    const normalizedType = typeRaw.toLowerCase();
    if (normalizedType !== "rent" && normalizedType !== "sale") {
      return { ok: false, error: "Invalid query parameter: type" };
    }
    type = normalizedType;
  }

  const limitResult = parsePaginationParam(url.searchParams.get("limit"), "limit");
  if (!limitResult.ok) {
    return limitResult;
  }

  const offsetResult = parsePaginationParam(url.searchParams.get("offset"), "offset");
  if (!offsetResult.ok) {
    return offsetResult;
  }

  const limit = limitResult.value ?? DEFAULT_LIMIT;
  const offset = offsetResult.value ?? 0;

  if (limit < 1 || limit > MAX_LIMIT) {
    return { ok: false, error: "Invalid query parameter: limit" };
  }

  if (offset < 0) {
    return { ok: false, error: "Invalid query parameter: offset" };
  }

  return {
    ok: true,
    value: {
      type,
      city,
      limit,
      offset,
    },
  };
}

function parseAdminListQuery(
  request: Request,
  config: { statusParam: string; allowedStatuses: string[] },
): { ok: true; value: { status: string | null; limit: number; offset: number } } | { ok: false; error: string } {
  const url = new URL(request.url);
  const statusRaw = asNonEmptyString(url.searchParams.get(config.statusParam));

  let status: string | null = null;
  if (statusRaw) {
    const normalized = statusRaw.toLowerCase();
    if (!config.allowedStatuses.includes(normalized)) {
      return { ok: false, error: `Invalid query parameter: ${config.statusParam}` };
    }
    status = normalized;
  }

  const limitResult = parsePaginationParam(url.searchParams.get("limit"), "limit");
  if (!limitResult.ok) {
    return limitResult;
  }

  const offsetResult = parsePaginationParam(url.searchParams.get("offset"), "offset");
  if (!offsetResult.ok) {
    return offsetResult;
  }

  const limit = limitResult.value ?? DEFAULT_LIMIT;
  const offset = offsetResult.value ?? 0;

  if (limit < 1 || limit > MAX_LIMIT) {
    return { ok: false, error: "Invalid query parameter: limit" };
  }

  if (offset < 0) {
    return { ok: false, error: "Invalid query parameter: offset" };
  }

  return {
    ok: true,
    value: {
      status,
      limit,
      offset,
    },
  };
}

function parseAdminPaymentEventsQuery(
  request: Request,
): { ok: true; value: { paymentId: string | null; limit: number; offset: number } } | { ok: false; error: string } {
  const url = new URL(request.url);
  const paymentIdRaw = asNonEmptyString(url.searchParams.get("paymentId"));
  let paymentId: string | null = null;

  if (paymentIdRaw) {
    paymentId = asUuid(paymentIdRaw);
    if (!paymentId) {
      return { ok: false, error: "Invalid query parameter: paymentId" };
    }
  }

  const limitResult = parsePaginationParam(url.searchParams.get("limit"), "limit");
  if (!limitResult.ok) {
    return limitResult;
  }

  const offsetResult = parsePaginationParam(url.searchParams.get("offset"), "offset");
  if (!offsetResult.ok) {
    return offsetResult;
  }

  const limit = limitResult.value ?? DEFAULT_LIMIT;
  const offset = offsetResult.value ?? 0;

  if (limit < 1 || limit > MAX_LIMIT) {
    return { ok: false, error: "Invalid query parameter: limit" };
  }

  if (offset < 0) {
    return { ok: false, error: "Invalid query parameter: offset" };
  }

  return {
    ok: true,
    value: {
      paymentId,
      limit,
      offset,
    },
  };
}

function parsePaginationParam(
  rawValue: string | null,
  key: "limit" | "offset",
): { ok: true; value: number | null } | { ok: false; error: string } {
  const normalized = asNonEmptyString(rawValue);
  if (!normalized) {
    return { ok: true, value: null };
  }

  if (!/^-?\d+$/.test(normalized)) {
    return { ok: false, error: `Invalid query parameter: ${key}` };
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isSafeInteger(parsed)) {
    return { ok: false, error: `Invalid query parameter: ${key}` };
  }

  return { ok: true, value: parsed };
}

function mapPublicReadRpcError(
  error: SupabaseError,
  notFoundError = "Resource not found",
): [string, number] {
  const code = asNonEmptyString(error.code);

  if (code === "22023") {
    return ["Invalid query parameters", 400];
  }

  if (code === "P0002") {
    return [notFoundError, 404];
  }

  return ["Public read RPC failed", 500];
}

function mapAdminReadRpcError(error: SupabaseError): [string, number] {
  const code = asNonEmptyString(error.code);

  if (code === "28000") {
    return ["Authentication required", 401];
  }

  if (code === "42501") {
    return ["Admin role required", 403];
  }

  if (code === "22023") {
    return ["Invalid query parameters", 400];
  }

  return ["Admin read RPC failed", 500];
}

function jsonSuccess(data: unknown): Response {
  return jsonResponse(
    {
      success: true,
      data,
    },
    200,
  );
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
