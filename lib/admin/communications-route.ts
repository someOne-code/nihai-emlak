// Phase D: Admin Communications API route handler.
// GET -> list chatwoot_conversations with profiles+listings join.
// POST -> trigger admin retry RPC for failed mappings.

import {
  readStateChangingJsonRequestPayload,
  validateStateChangingJsonRequestEnvelope,
  type StateChangingJsonRouteConfig,
} from "../http/state-changing-json-route.ts";
import { inngest } from "../inngest/client.ts";

type SupabaseError = {
  code?: string | null;
  message?: string | null;
};

type SupabaseRpcResponse = {
  data: unknown;
  error: SupabaseError | null;
};

type SupabaseQueryResponse = {
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
    name: "admin_retry_chatwoot_conversation",
    args: Record<string, unknown>,
  ) => Promise<SupabaseRpcResponse>;
};

type SupabaseSelectQuery = {
  eq?: (column: string, value: string) => SupabaseSelectQuery;
  in?: (column: string, values: string[]) => SupabaseSelectQuery;
  or?: (filter: string) => SupabaseSelectQuery;
  order?: (column: string, options: { ascending: boolean }) => SupabaseSelectQuery;
  range?: (from: number, to: number) => Promise<SupabaseQueryResponse>;
  maybeSingle?: () => Promise<SupabaseQueryResponse>;
};

export type AdminCommunicationsRouteDependencies = {
  createServerSupabaseClient: () => Promise<unknown>;
  sendInngestEvent?: (event: AdminCommunicationsRetryEvent) => Promise<void>;
  env?: Record<string, string | undefined>;
};

type AdminCommunicationsRetryEvent = {
  name: "chatwoot/conversation.retry_requested";
  data: {
    conversation_id: string;
    listing_id: string;
    user_id: string;
  };
};

const POST_ROUTE_CONFIG: StateChangingJsonRouteConfig = {
  maxBodyBytes: 4 * 1024,
  routeLabel: "Admin communications",
};

const CONVERSATION_SELECT = `
  id,
  user_id,
  listing_id,
  status,
  chatwoot_source_id,
  chatwoot_conversation_id,
  failure_reason,
  created_at,
  updated_at,
  profiles:profiles(id, full_name, email),
  listings:listings(id, title, city, district)
`;

const COMMUNICATION_STATUSES = new Set(["ready", "provisioning", "failed"]);

export async function handleAdminCommunicationsGet(
  request: Request,
  dependencies: AdminCommunicationsRouteDependencies,
): Promise<Response> {
  const guard = await guardAdminRequest(dependencies);
  if (!guard.ok) {
    return guard.response;
  }

  const query = parseCommunicationsListQuery(request);
  if (!query.ok) {
    return jsonError(query.error, 400);
  }

  let select = guard.supabase.from("chatwoot_conversations").select(CONVERSATION_SELECT);
  const orderByUpdatedAt = select.order;
  if (!orderByUpdatedAt || !select.range) {
    return jsonError("İletişim sorgusu kullanılamıyor", 500);
  }

  if (query.value.status === "issues") {
    if (!select.in) return jsonError("İletişim sorgusu kullanılamıyor", 500);
    select = select.in("status", ["provisioning", "failed"]);
  } else if (query.value.status && query.value.status !== "all") {
    if (!select.eq) return jsonError("İletişim sorgusu kullanılamıyor", 500);
    select = select.eq("status", query.value.status);
  }

  if (query.value.search) {
    if (!select.or) return jsonError("İletişim sorgusu kullanılamıyor", 500);
    const pattern = `%${query.value.search}%`;
    select = select.or([
      `chatwoot_source_id.ilike.${pattern}`,
      `chatwoot_conversation_id.ilike.${pattern}`,
      `failure_reason.ilike.${pattern}`,
    ].join(","));
  }

  const ordered = orderByUpdatedAt("updated_at", { ascending: false });
  if (!ordered.range) {
    return jsonError("İletişim sorgusu kullanılamıyor", 500);
  }
  const result = await ordered.range(query.value.offset, query.value.offset + query.value.limit - 1);

  if (result.error) {
    return jsonError("İletişim listesi alınamadı", 500);
  }

  return jsonSuccess({
    conversations: Array.isArray(result.data) ? result.data : [],
    chatwoot: resolveChatwootOpenConfig(dependencies.env ?? process.env),
  });
}

export async function handleAdminCommunicationsPost(
  request: Request,
  dependencies: AdminCommunicationsRouteDependencies,
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

  const conversationId = parseConversationId(payloadResult.value);
  if (!conversationId) {
    return jsonError("conversation_id geçerli bir UUID olmalı", 400);
  }

  const guard = await guardAdminRequest(dependencies);
  if (!guard.ok) {
    return guard.response;
  }

  const rpcResult = await guard.supabase.rpc("admin_retry_chatwoot_conversation", {
    p_conversation_id: conversationId,
  });

  if (rpcResult.error) {
    const [error, status] = mapRetryRpcError(rpcResult.error);
    return jsonError(error, status);
  }

  const retryResult = parseRetryRpcResult(rpcResult.data, conversationId);
  if (!retryResult) {
    return jsonError("Geçersiz iletişim yeniden deneme yanıtı", 500);
  }

  await (dependencies.sendInngestEvent ?? sendInngestEvent)({
    name: "chatwoot/conversation.retry_requested",
    data: {
      conversation_id: retryResult.conversationId,
      listing_id: retryResult.listingId,
      user_id: retryResult.userId,
    },
  });

  return jsonSuccess({
    conversation_id: conversationId,
    result: "retry_started",
  });
}

async function guardAdminRequest(
  dependencies: AdminCommunicationsRouteDependencies,
): Promise<
  | { ok: true; supabase: SupabaseClient }
  | { ok: false; response: Response }
> {
  const supabase = (await dependencies.createServerSupabaseClient()) as SupabaseClient;
  const userResult = await supabase.auth.getUser();
  if (userResult.error || !userResult.data.user) {
    return {
      ok: false,
      response: jsonError("Oturum gerekli", 401),
    };
  }

  const profileSelect = supabase.from("profiles").select("role");
  if (!profileSelect.eq) {
    return {
      ok: false,
      response: jsonError("Admin profili okunamadı", 500),
    };
  }
  const profileQuery = profileSelect.eq("id", userResult.data.user.id);
  if (!profileQuery.maybeSingle) {
    return {
      ok: false,
      response: jsonError("Admin profili okunamadı", 500),
    };
  }
  const profileResult = await profileQuery.maybeSingle();

  if (profileResult.error) {
    return {
      ok: false,
      response: jsonError("Admin profili okunamadı", 500),
    };
  }

  const role = asNonEmptyString((profileResult.data as Record<string, unknown> | null)?.role);
  if (role !== "admin") {
    return {
      ok: false,
      response: jsonError("Admin yetkisi gerekli", 403),
    };
  }

  return { ok: true, supabase };
}

function parseCommunicationsListQuery(
  request: Request,
): { ok: true; value: { status: string | null; search: string | null; limit: number; offset: number } } | { ok: false; error: string } {
  const url = new URL(request.url);
  const status = normalizeOptionalText(url.searchParams.get("status"), 40);
  if (
    status &&
    status !== "all" &&
    status !== "issues" &&
    !COMMUNICATION_STATUSES.has(status)
  ) {
    return { ok: false, error: "status geçerli değil" };
  }

  const search = normalizeSearch(url.searchParams.get("search"));
  if (search === false) {
    return { ok: false, error: "arama geçerli değil" };
  }

  const limit = parseBoundedInteger(url.searchParams.get("limit"), 20, 1, 100);
  const offset = parseBoundedInteger(url.searchParams.get("offset"), 0, 0, 10_000);
  if (limit === null || offset === null) {
    return { ok: false, error: "sayfalama geçerli değil" };
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

function parseConversationId(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }
  const raw = value.conversation_id;
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  return isUuid(trimmed) ? trimmed.toLowerCase() : null;
}

function resolveChatwootOpenConfig(
  env: Record<string, string | undefined>,
): { web_base_url: string | null; account_id: string | null } {
  return {
    web_base_url: normalizeHttpOrigin(env.CHATWOOT_BASE_URL),
    account_id: asNonEmptyString(env.CHATWOOT_ACCOUNT_ID),
  };
}

function normalizeHttpOrigin(value: unknown): string | null {
  const raw = asNonEmptyString(value);
  if (!raw) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  if (parsed.username || parsed.password) {
    return null;
  }

  return parsed.origin;
}

function mapRetryRpcError(error: SupabaseError): [string, number] {
  const code = asNonEmptyString(error.code);

  if (code === "28000") {
    return ["Oturum gerekli", 401];
  }
  if (code === "42501") {
    return ["Admin yetkisi gerekli", 403];
  }
  if (code === "P0002") {
    return ["Konuşma bulunamadı", 404];
  }
  if (code === "22023") {
    return ["Konuşma başarısız durumda değil", 409];
  }

  return ["Yeniden deneme başlatılamadı", 500];
}

function parseRetryRpcResult(
  value: unknown,
  fallbackConversationId: string,
): { conversationId: string; listingId: string; userId: string } | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!isRecord(row)) {
    return null;
  }

  const conversationId = asUuidValue(row.conversation_id) ?? fallbackConversationId;
  const listingId = asUuidValue(row.listing_id);
  const userId = asUuidValue(row.user_id);
  if (!listingId || !userId) {
    return null;
  }

  return {
    conversationId,
    listingId,
    userId,
  };
}

async function sendInngestEvent(event: AdminCommunicationsRetryEvent): Promise<void> {
  await inngest.send(event);
}

function normalizeOptionalText(value: unknown, max: number): string | null {
  if (value === null || value === undefined || typeof value !== "string") {
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

function asUuidValue(value: unknown): string | null {
  const normalized = asNonEmptyString(value);
  if (!normalized || !isUuid(normalized)) {
    return null;
  }
  return normalized.toLowerCase();
}

function jsonSuccess(data: unknown): Response {
  return jsonResponse({ success: true, data }, 200);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  return value.trim();
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
