import {
  readStateChangingJsonRequestPayload,
  validateStateChangingJsonRequestEnvelope,
  type StateChangingJsonRouteConfig,
} from "../http/state-changing-json-route.ts";

type SupabaseError = {
  code?: string | null;
  message?: string | null;
};

type SupabaseQueryResponse = {
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
  from: (table: string) => {
    select: (columns: string) => SupabaseSelectQuery;
  };
  rpc: (
    name: "admin_update_sale_lead_status",
    args: Record<string, unknown>,
  ) => Promise<SupabaseRpcResponse>;
};

type SupabaseSelectQuery = {
  eq?: (column: string, value: string) => SupabaseSelectQuery;
  in?: (column: string, values: string[]) => SupabaseSelectQuery;
  or?: (filter: string) => SupabaseSelectQuery;
  order?: (column: string, options: { ascending: boolean }) => SupabaseSelectQuery;
  range?: (from: number, to: number) => Promise<SupabaseQueryResponse>;
  limit?: (count: number) => Promise<SupabaseQueryResponse>;
  maybeSingle?: () => Promise<SupabaseQueryResponse>;
};

export type AdminSaleLeadsRouteDependencies = {
  createServerSupabaseClient: () => Promise<unknown>;
};

const POST_ROUTE_CONFIG: StateChangingJsonRouteConfig = {
  maxBodyBytes: 4 * 1024,
  routeLabel: "Admin sale leads",
};

const SALE_LEAD_SELECT = `
  id,
  listing_id,
  user_id,
  contact_name,
  contact_email,
  contact_phone,
  message,
  status,
  updated_at,
  created_at,
  chatwoot_conversation_id,
  listings:listings(id, title, city, district, type),
  profiles:profiles(id, full_name, email)
`;

const SALE_LEAD_STATUSES = new Set([
  "new",
  "called",
  "meeting_planned",
  "not_interested",
  "closed",
]);

export async function handleAdminSaleLeadsGet(
  request: Request,
  dependencies: AdminSaleLeadsRouteDependencies,
): Promise<Response> {
  const guard = await guardAdminRequest(dependencies);
  if (!guard.ok) {
    return guard.response;
  }

  const query = parseSaleLeadsListQuery(request);
  if (!query.ok) {
    return jsonError(query.error, 400);
  }

  let select = guard.supabase.from("sale_leads").select(SALE_LEAD_SELECT);
  const orderByUpdatedAt = select.order;
  if (!orderByUpdatedAt || !select.range) {
    return jsonError("Admin sale leads query is unavailable", 500);
  }

  if (query.value.status === "actionable") {
    if (!select.in) return jsonError("Admin sale leads query is unavailable", 500);
    select = select.in("status", ["new", "called"]);
  } else if (query.value.status && query.value.status !== "all") {
    if (!select.eq) return jsonError("Admin sale leads query is unavailable", 500);
    select = select.eq("status", query.value.status);
  }

  if (query.value.search) {
    if (!select.or) return jsonError("Admin sale leads query is unavailable", 500);
    const pattern = `%${query.value.search}%`;
    select = select.or([
      `contact_name.ilike.${pattern}`,
      `contact_email.ilike.${pattern}`,
      `contact_phone.ilike.${pattern}`,
      `message.ilike.${pattern}`,
    ].join(","));
  }

  const ordered = orderByUpdatedAt("updated_at", { ascending: false });
  if (!ordered.range) {
    return jsonError("Admin sale leads query is unavailable", 500);
  }
  const result = await ordered.range(query.value.offset, query.value.offset + query.value.limit - 1);
  if (result.error) {
    return jsonError("Admin sale leads list is unavailable", 500);
  }

  return jsonSuccess({
    leads: Array.isArray(result.data) ? result.data : [],
  });
}

function parseSaleLeadsListQuery(
  request: Request,
): { ok: true; value: { status: string | null; search: string | null; limit: number; offset: number } } | { ok: false; error: string } {
  const url = new URL(request.url);
  const status = normalizeOptionalText(url.searchParams.get("status"), 40);
  if (status && status !== "all" && status !== "actionable" && !SALE_LEAD_STATUSES.has(status)) {
    return { ok: false, error: "status is not valid" };
  }

  const search = normalizeSearch(url.searchParams.get("search"));
  if (search === false) {
    return { ok: false, error: "search is not valid" };
  }

  const limit = parseBoundedInteger(url.searchParams.get("limit"), 20, 1, 100);
  const offset = parseBoundedInteger(url.searchParams.get("offset"), 0, 0, 10_000);
  if (limit === null || offset === null) {
    return { ok: false, error: "pagination is not valid" };
  }

  return {
    ok: true,
    value: {
      status: status ?? null,
      search,
      limit,
      offset,
    },
  };
}

export async function handleAdminSaleLeadsPost(
  request: Request,
  dependencies: AdminSaleLeadsRouteDependencies,
): Promise<Response> {
  const envelopeResult = validateStateChangingJsonRequestEnvelope(
    request,
    POST_ROUTE_CONFIG,
  );
  if (!envelopeResult.ok) {
    return jsonError(envelopeResult.error, envelopeResult.status);
  }

  const payloadResult = await readStateChangingJsonRequestPayload(
    request,
    POST_ROUTE_CONFIG,
  );
  if (!payloadResult.ok) {
    return jsonError(payloadResult.error, payloadResult.status);
  }

  const parsed = parseAdminStatusPayload(payloadResult.value);
  if (!parsed.ok) {
    return jsonError(parsed.error, 400);
  }

  const guard = await guardAdminRequest(dependencies);
  if (!guard.ok) {
    return guard.response;
  }

  const rpcResult = await guard.supabase.rpc(
    "admin_update_sale_lead_status",
    parsed.args,
  );
  if (rpcResult.error) {
    const mapped = mapAdminSaleLeadRpcError(rpcResult.error);
    return jsonError(mapped.error, mapped.status);
  }

  if (!isRecord(rpcResult.data)) {
    return jsonError("Invalid admin sale lead update response", 500);
  }

  return jsonSuccess({ lead: rpcResult.data });
}

async function guardAdminRequest(
  dependencies: AdminSaleLeadsRouteDependencies,
): Promise<
  | { ok: true; supabase: SupabaseClient }
  | { ok: false; response: Response }
> {
  const supabase = (await dependencies.createServerSupabaseClient()) as SupabaseClient;
  const userResult = await supabase.auth.getUser();
  if (userResult.error || !userResult.data.user) {
    return { ok: false, response: jsonError("Authentication required", 401) };
  }

  const profileSelect = supabase.from("profiles").select("role");
  if (!profileSelect.eq) {
    return { ok: false, response: jsonError("Admin profile lookup failed", 500) };
  }

  const profileQuery = profileSelect.eq("id", userResult.data.user.id);
  if (!profileQuery.maybeSingle) {
    return { ok: false, response: jsonError("Admin profile lookup failed", 500) };
  }
  const profileResult = await profileQuery.maybeSingle();
  if (profileResult.error) {
    return { ok: false, response: jsonError("Admin profile lookup failed", 500) };
  }

  const role = asNonEmptyString((profileResult.data as Record<string, unknown> | null)?.role);
  if (role !== "admin") {
    return { ok: false, response: jsonError("Admin role required", 403) };
  }

  return { ok: true, supabase };
}

function parseAdminStatusPayload(
  value: unknown,
): { ok: true; args: Record<string, unknown> } | { ok: false; error: string } {
  if (!isRecord(value)) {
    return { ok: false, error: "Admin sale lead payload must be an object" };
  }

  const leadId = asUuid(value.lead_id);
  if (!leadId) {
    return { ok: false, error: "lead_id must be a valid UUID" };
  }

  const status = asNonEmptyString(value.status);
  if (!status || !SALE_LEAD_STATUSES.has(status)) {
    return { ok: false, error: "status is not valid" };
  }

  return {
    ok: true,
    args: {
      p_lead_id: leadId,
      p_status: status,
      p_note: normalizeOptionalText(value.note, 500),
    },
  };
}

function mapAdminSaleLeadRpcError(error: SupabaseError): { status: number; error: string } {
  const code = asNonEmptyString(error.code);

  if (code === "28000") {
    return { status: 401, error: "Authentication required" };
  }
  if (code === "42501") {
    return { status: 403, error: "Admin role required" };
  }
  if (code === "P0002") {
    return { status: 404, error: "Sale lead not found" };
  }
  if (code === "22023") {
    return { status: 400, error: "Invalid sale lead status update" };
  }

  return { status: 500, error: "Admin sale lead update failed" };
}

function jsonSuccess(data: unknown, status = 200): Response {
  return jsonResponse({ success: true, data }, status);
}

function jsonError(error: string, status: number): Response {
  return jsonResponse({ success: false, error }, status);
}

function jsonResponse(payload: unknown, status: number): Response {
  return Response.json(payload, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function normalizeOptionalText(value: unknown, max: number): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= max ? normalized : null;
}

function normalizeSearch(value: unknown): string | null | false {
  const normalized = normalizeOptionalText(value, 80);
  if (!normalized) {
    return null;
  }
  if (/[(),]/.test(normalized)) {
    return false;
  }
  return normalized.replace(/[%_]/g, "\\$&");
}

function parseBoundedInteger(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
): number | null {
  if (value === null || value.trim().length === 0) {
    return fallback;
  }
  if (!/^\d+$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
