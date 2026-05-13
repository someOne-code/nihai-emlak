type SupabaseError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

type SupabaseMaybeSingleResponse = {
  data: unknown;
  error: SupabaseError | null;
};

type SupabaseRpcResponse = {
  data: unknown;
  error: SupabaseError | null;
};

type SupabaseQueryResponse = {
  data: unknown;
  error: SupabaseError | null;
};

type ReadModelRpcName =
  | "list_public_listings"
  | "get_public_listing_filters"
  | "get_public_listing_detail"
  | "list_public_listing_services"
  | "list_admin_reservations"
  | "list_admin_orders"
  | "list_admin_payments"
  | "list_admin_payment_events"
  | "list_admin_audit_events";

type SupabaseClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: SupabaseError | null;
    }>;
  };
  from: (table: string) => {
    select: (columns: string) => {
      in?: (column: string, values: string[]) => PublicReadQueryBuilder;
      order?: (column: string, options?: { ascending?: boolean; foreignTable?: string }) => PublicReadQueryBuilder;
      eq: (column: string, value: string) => {
        order?: (column: string, options?: { ascending?: boolean }) => PublicReadQueryBuilder;
        maybeSingle: () => Promise<SupabaseMaybeSingleResponse>;
      };
    };
  };
  rpc: (
    functionName: ReadModelRpcName,
    args: Record<string, unknown>,
  ) => Promise<SupabaseRpcResponse>;
};

type PublicReadQueryBuilder = {
  eq: (column: string, value: string | number | boolean) => PublicReadQueryBuilder;
  ilike: (column: string, pattern: string) => PublicReadQueryBuilder;
  gte: (column: string, value: number) => PublicReadQueryBuilder;
  lte: (column: string, value: number) => PublicReadQueryBuilder;
  in: (column: string, values: string[]) => PublicReadQueryBuilder;
  order: (column: string, options?: { ascending?: boolean; foreignTable?: string }) => PublicReadQueryBuilder;
  range: (from: number, to: number) => Promise<SupabaseQueryResponse>;
};

export type ReadModelRouteDependencies = {
  createServerSupabaseClient: () => Promise<unknown>;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

type PublicListingsQuery = {
  type: "rent" | "sale" | null;
  city: string | null;
  district: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  minRooms: number | null;
  minBathrooms: number | null;
  minArea: number | null;
  maxArea: number | null;
  isFurnished: boolean | null;
  limit: number;
  offset: number;
};

export async function handlePublicListingsGet(
  request: Request,
  dependencies: ReadModelRouteDependencies,
): Promise<Response> {
  const query = parsePublicListingsQuery(request);
  if (!query.ok) {
    return jsonError(query.error, 400);
  }

  const supabase = (await dependencies.createServerSupabaseClient()) as SupabaseClient;
  const rpcResult = await supabase.rpc("list_public_listings", buildPublicListingsRpcArgs(query.value));
  if (rpcResult.error) {
    const mappedError = mapPublicReadRpcError(rpcResult.error);
    if (mappedError[1] === 500) {
      const fallbackResult = await listPublicListingsFromTables(supabase, query.value);
      if (!fallbackResult.error) {
        return jsonSuccess(fallbackResult.data);
      }
    }

    return jsonError(...mapPublicReadRpcError(rpcResult.error));
  }

  return jsonSuccess(rpcResult.data);
}

export async function handlePublicListingFiltersGet(
  _request: Request,
  dependencies: ReadModelRouteDependencies,
): Promise<Response> {
  const supabase = (await dependencies.createServerSupabaseClient()) as SupabaseClient;
  const rpcResult = await supabase.rpc("get_public_listing_filters", {});
  if (rpcResult.error) {
    return jsonError(...mapPublicReadRpcError(rpcResult.error));
  }

  return jsonSuccess(rpcResult.data);
}

async function listPublicListingsFromTables(
  supabase: SupabaseClient,
  query: PublicListingsQuery,
): Promise<{ data: unknown; error: SupabaseError | null }> {
  let listingsQuery = supabase
    .from("listings")
    .select(
      "id,type,status,title,slug,summary,city,district,price,currency,room_count,bathroom_count,gross_area_m2,is_furnished,created_at",
    ) as unknown as PublicReadQueryBuilder;

  listingsQuery = listingsQuery.eq("status", "active");
  if (query.type) {
    listingsQuery = listingsQuery.eq("type", query.type);
  }
  if (query.city) {
    listingsQuery = listingsQuery.ilike("city", `%${query.city}%`);
  }
  if (query.district) {
    listingsQuery = listingsQuery.ilike("district", `%${query.district}%`);
  }
  if (query.minPrice !== null) {
    listingsQuery = listingsQuery.gte("price", query.minPrice);
  }
  if (query.maxPrice !== null) {
    listingsQuery = listingsQuery.lte("price", query.maxPrice);
  }
  if (query.minRooms !== null) {
    listingsQuery = listingsQuery.gte("room_count", query.minRooms);
  }
  if (query.minBathrooms !== null) {
    listingsQuery = listingsQuery.gte("bathroom_count", query.minBathrooms);
  }
  if (query.minArea !== null) {
    listingsQuery = listingsQuery.gte("gross_area_m2", query.minArea);
  }
  if (query.maxArea !== null) {
    listingsQuery = listingsQuery.lte("gross_area_m2", query.maxArea);
  }
  if (query.isFurnished !== null) {
    listingsQuery = listingsQuery.eq("is_furnished", query.isFurnished);
  }

  const listingsResult = await listingsQuery
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(query.offset, query.offset + query.limit - 1);

  if (listingsResult.error) {
    if (isDevelopmentSupabaseUnavailable(listingsResult.error)) {
      return {
        data: {
          items: [],
          limit: query.limit,
          offset: query.offset,
        },
        error: null,
      };
    }

    return {
      data: null,
      error: listingsResult.error,
    };
  }

  const listingRows = Array.isArray(listingsResult.data) ? listingsResult.data : [];
  if (listingRows.length === 0) {
    return {
      data: {
        items: [],
        limit: query.limit,
        offset: query.offset,
      },
      error: null,
    };
  }

  const listingIds = listingRows
    .map((row) => readStringField(row, "id"))
    .filter((id): id is string => id !== null);

  let imagesByListingId = new Map<string, string>();
  if (listingIds.length > 0) {
    const imagesResult = await (supabase
      .from("listing_images")
      .select("id,listing_id,image_url,is_primary,sort_order,created_at") as unknown as PublicReadQueryBuilder)
      .in("listing_id", listingIds)
      .order("is_primary", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(0, listingIds.length * 10);

    if (imagesResult.error) {
      return {
        data: null,
        error: imagesResult.error,
      };
    }

    imagesByListingId = selectPrimaryImages(imagesResult.data);
  }

  return {
    data: {
      items: listingRows.map((row) => ({
        id: readField(row, "id"),
        type: readField(row, "type"),
        status: readField(row, "status"),
        title: readField(row, "title"),
        slug: readField(row, "slug"),
        summary: readField(row, "summary"),
        city: readField(row, "city"),
        district: readField(row, "district"),
        price: readField(row, "price"),
        currency: readField(row, "currency"),
        room_count: readField(row, "room_count"),
        bathroom_count: readField(row, "bathroom_count"),
        gross_area_m2: readField(row, "gross_area_m2"),
        is_furnished: readField(row, "is_furnished"),
        primary_image_url: imagesByListingId.get(String(readField(row, "id"))) ?? null,
        created_at: readField(row, "created_at"),
      })),
      limit: query.limit,
      offset: query.offset,
    },
    error: null,
  };
}

function isDevelopmentSupabaseUnavailable(error: SupabaseError): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  const text = `${error.message ?? ""}\n${error.details ?? ""}\n${error.hint ?? ""}`;
  return /fetch failed|ECONNREFUSED|ENOTFOUND|ECONNRESET/i.test(text);
}

function selectPrimaryImages(data: unknown): Map<string, string> {
  const byListingId = new Map<string, string>();
  if (!Array.isArray(data)) {
    return byListingId;
  }

  for (const row of data) {
    const listingId = readStringField(row, "listing_id");
    const imageUrl = readStringField(row, "image_url");
    if (!listingId || !imageUrl || byListingId.has(listingId)) {
      continue;
    }
    byListingId.set(listingId, imageUrl);
  }

  return byListingId;
}

function readField(row: unknown, key: string): unknown {
  return typeof row === "object" && row !== null && key in row
    ? (row as Record<string, unknown>)[key]
    : null;
}

function readStringField(row: unknown, key: string): string | null {
  const value = readField(row, key);
  return typeof value === "string" && value.trim().length > 0 ? value : null;
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
    queueParam: "queue",
    allowedQueues: ["all", "payment_waiting", "document_waiting", "refund_requests", "manual_refunds", "payment_issues", "completed"],
  });
  if (!query.ok) {
    return jsonError(query.error, 400);
  }

  const rpcResult = await guard.supabase.rpc("list_admin_reservations", {
    p_status: query.value.status,
    p_queue: query.value.queue,
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

export async function handleAdminAuditEventsGet(
  request: Request,
  dependencies: ReadModelRouteDependencies,
): Promise<Response> {
  const guard = await guardAdminReadRequest(dependencies);
  if (!guard.ok) {
    return guard.response;
  }

  const query = parseAdminAuditEventsQuery(request);
  if (!query.ok) {
    return jsonError(query.error, 400);
  }

  const rpcResult = await guard.supabase.rpc("list_admin_audit_events", {
    p_entity_type: query.value.entityType,
    p_entity_id: query.value.entityId,
    p_actor_id: query.value.actorId,
    p_action: query.value.action,
    p_from: query.value.from,
    p_to: query.value.to,
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
): { ok: true; value: PublicListingsQuery } | {
  ok: false;
  error: string;
} {
  const url = new URL(request.url);
  const typeRaw = asNonEmptyString(url.searchParams.get("type"));
  const city = asNonEmptyString(url.searchParams.get("city"));
  const district = asNonEmptyString(url.searchParams.get("district"));

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

  const minPriceResult = parseNonNegativeNumberParam(url.searchParams.get("min_price"), "min_price");
  if (!minPriceResult.ok) {
    return minPriceResult;
  }

  const maxPriceResult = parseNonNegativeNumberParam(url.searchParams.get("max_price"), "max_price");
  if (!maxPriceResult.ok) {
    return maxPriceResult;
  }

  const minRoomsResult = parseNonNegativeIntegerParam(url.searchParams.get("min_rooms"), "min_rooms");
  if (!minRoomsResult.ok) {
    return minRoomsResult;
  }

  const minBathroomsResult = parseNonNegativeIntegerParam(url.searchParams.get("min_bathrooms"), "min_bathrooms");
  if (!minBathroomsResult.ok) {
    return minBathroomsResult;
  }

  const minAreaResult = parseNonNegativeNumberParam(url.searchParams.get("min_area"), "min_area");
  if (!minAreaResult.ok) {
    return minAreaResult;
  }

  const maxAreaResult = parseNonNegativeNumberParam(url.searchParams.get("max_area"), "max_area");
  if (!maxAreaResult.ok) {
    return maxAreaResult;
  }

  const isFurnishedResult = parseBooleanParam(url.searchParams.get("is_furnished"), "is_furnished");
  if (!isFurnishedResult.ok) {
    return isFurnishedResult;
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
      district,
      minPrice: minPriceResult.value,
      maxPrice: maxPriceResult.value,
      minRooms: minRoomsResult.value,
      minBathrooms: minBathroomsResult.value,
      minArea: minAreaResult.value,
      maxArea: maxAreaResult.value,
      isFurnished: isFurnishedResult.value,
      limit,
      offset,
    },
  };
}

function buildPublicListingsRpcArgs(query: PublicListingsQuery): Record<string, unknown> {
  return {
    p_type: query.type,
    p_city: query.city,
    p_district: query.district,
    p_min_price: query.minPrice,
    p_max_price: query.maxPrice,
    p_min_rooms: query.minRooms,
    p_min_bathrooms: query.minBathrooms,
    p_min_area: query.minArea,
    p_max_area: query.maxArea,
    p_is_furnished: query.isFurnished,
    p_limit: query.limit,
    p_offset: query.offset,
  };
}

function parseAdminListQuery(
  request: Request,
  config: { statusParam: string; allowedStatuses: string[]; queueParam?: string; allowedQueues?: string[] },
): { ok: true; value: { status: string | null; queue: string | null; limit: number; offset: number } } | { ok: false; error: string } {
  const url = new URL(request.url);
  const statusRaw = asNonEmptyString(url.searchParams.get(config.statusParam));
  const queueRaw = config.queueParam ? asNonEmptyString(url.searchParams.get(config.queueParam)) : null;

  let status: string | null = null;
  if (statusRaw) {
    const normalized = statusRaw.toLowerCase();
    if (!config.allowedStatuses.includes(normalized)) {
      return { ok: false, error: `Invalid query parameter: ${config.statusParam}` };
    }
    status = normalized;
  }

  let queue: string | null = null;
  if (queueRaw && config.queueParam && config.allowedQueues) {
    const normalized = queueRaw.toLowerCase();
    if (!config.allowedQueues.includes(normalized)) {
      return { ok: false, error: `Invalid query parameter: ${config.queueParam}` };
    }
    queue = normalized;
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
      queue,
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

function parseAdminAuditEventsQuery(
  request: Request,
): {
  ok: true;
  value: {
    entityType: string | null;
    entityId: string | null;
    actorId: string | null;
    action: string | null;
    from: string | null;
    to: string | null;
    limit: number;
    offset: number;
  };
} | { ok: false; error: string } {
  const url = new URL(request.url);
  const entityTypeRaw = asNonEmptyString(url.searchParams.get("entityType"));
  const entityIdRaw = asNonEmptyString(url.searchParams.get("entityId"));
  const actorIdRaw = asNonEmptyString(url.searchParams.get("actorId"));
  const action = asNonEmptyString(url.searchParams.get("action"));
  const fromRaw = url.searchParams.get("from");
  const toRaw = url.searchParams.get("to");
  const from = asIsoDateTime(fromRaw);
  const to = asIsoDateTime(toRaw);

  let entityType: string | null = null;
  if (entityTypeRaw) {
    const normalized = entityTypeRaw.toLowerCase();
    if (!["reservation", "order", "payment", "listing", "sale_lead"].includes(normalized)) {
      return { ok: false, error: "Invalid query parameter: entityType" };
    }
    entityType = normalized;
  }

  let entityId: string | null = null;
  if (entityIdRaw) {
    entityId = asUuid(entityIdRaw);
    if (!entityId) {
      return { ok: false, error: "Invalid query parameter: entityId" };
    }
  }

  let actorId: string | null = null;
  if (actorIdRaw) {
    actorId = asUuid(actorIdRaw);
    if (!actorId) {
      return { ok: false, error: "Invalid query parameter: actorId" };
    }
  }

  if (fromRaw && !from) {
    return { ok: false, error: "Invalid query parameter: from" };
  }
  if (toRaw && !to) {
    return { ok: false, error: "Invalid query parameter: to" };
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
      entityType,
      entityId,
      actorId,
      action,
      from,
      to,
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

function parseNonNegativeNumberParam(
  rawValue: string | null,
  key: string,
): { ok: true; value: number | null } | { ok: false; error: string } {
  const normalized = asNonEmptyString(rawValue);
  if (!normalized) {
    return { ok: true, value: null };
  }

  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    return { ok: false, error: `Invalid query parameter: ${key}` };
  }

  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) {
    return { ok: false, error: `Invalid query parameter: ${key}` };
  }

  return { ok: true, value: parsed };
}

function parseNonNegativeIntegerParam(
  rawValue: string | null,
  key: string,
): { ok: true; value: number | null } | { ok: false; error: string } {
  const normalized = asNonEmptyString(rawValue);
  if (!normalized) {
    return { ok: true, value: null };
  }

  if (!/^\d+$/.test(normalized)) {
    return { ok: false, error: `Invalid query parameter: ${key}` };
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isSafeInteger(parsed)) {
    return { ok: false, error: `Invalid query parameter: ${key}` };
  }

  return { ok: true, value: parsed };
}

function parseBooleanParam(
  rawValue: string | null,
  key: string,
): { ok: true; value: boolean | null } | { ok: false; error: string } {
  const normalized = asNonEmptyString(rawValue);
  if (!normalized) {
    return { ok: true, value: null };
  }

  if (normalized === "true") {
    return { ok: true, value: true };
  }

  if (normalized === "false") {
    return { ok: true, value: false };
  }

  return { ok: false, error: `Invalid query parameter: ${key}` };
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

function asIsoDateTime(value: unknown): string | null {
  const normalized = asNonEmptyString(value);
  if (!normalized) {
    return null;
  }

  const timestamp = Date.parse(normalized);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp).toISOString();
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
