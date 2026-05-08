import {
  createChatwootClient,
  resolveChatwootConfigFromEnv,
  type ChatwootClientResult,
  type ChatwootConfig,
  type ChatwootMessagePagination,
  type CreateChatwootMessageInput,
  type ListChatwootMessagesInput,
  type ResolveChatwootConfigResult,
} from "./chatwoot.ts";
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

type SupabaseFilterBuilder = {
  eq: (column: string, value: string) => SupabaseFilterBuilder;
  maybeSingle: () => Promise<SupabaseMaybeSingleResponse>;
};

type SupabaseSelectBuilder = {
  select: (columns: string) => SupabaseFilterBuilder;
};

type SupabaseUser = {
  id: string;
};

type SupabaseClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: SupabaseUser | null };
      error: SupabaseError | null;
    }>;
  };
  from: (table: "chatwoot_conversations") => SupabaseSelectBuilder;
};

export type ConversationMessagesClient = {
  listMessages: (
    input: ListChatwootMessagesInput,
  ) => Promise<ChatwootClientResult<unknown[]>>;
  createIncomingMessage: (
    input: CreateChatwootMessageInput,
  ) => Promise<ChatwootClientResult<unknown>>;
};

export type ConversationReadMessagesDependencies = {
  createChatwootClient?: (config: ChatwootConfig) => ConversationMessagesClient;
  createServerSupabaseClient: () => Promise<unknown>;
  resolveChatwootConfig?: () => ResolveChatwootConfigResult;
};

type MappingRow = {
  conversationId: string;
  listingId: string;
  chatwootConversationId: string;
  chatwootSourceId: string;
};

type SanitizedMessage = {
  id: string;
  content: string | null;
  message_type: "incoming" | "outgoing" | "activity" | "template";
  created_at: number | null;
  private: boolean;
};

const MESSAGES_ROUTE_CONFIG: StateChangingJsonRouteConfig = {
  maxBodyBytes: 4 * 1024,
  routeLabel: "Communication message",
};

const DEFAULT_MESSAGES_LIMIT = 20;
const MAX_MESSAGES_LIMIT = 100;
const PROVIDER_FAILURE_MESSAGE = "Communication provider request failed";
const CONVERSATION_NOT_FOUND_MESSAGE = "Conversation not found";

export async function handleListingConversationGet(
  _request: Request,
  dependencies: ConversationReadMessagesDependencies,
  params: { listingId: string },
): Promise<Response> {
  const listingId = asUuid(params.listingId);
  if (!listingId) {
    return jsonError("Invalid listing id", 400);
  }

  const supabase = (await dependencies.createServerSupabaseClient()) as SupabaseClient;
  const userResult = await supabase.auth.getUser();
  if (userResult.error || !userResult.data.user) {
    return jsonError("Authentication required", 401);
  }

  const lookup = await supabase
    .from("chatwoot_conversations")
    .select("id,listing_id,chatwoot_conversation_id,chatwoot_source_id,status,user_id")
    .eq("user_id", userResult.data.user.id)
    .eq("listing_id", listingId)
    .maybeSingle();
  if (lookup.error) {
    return jsonError("Conversation lookup failed", 500);
  }

  const mapping = parseReadyMappingRow(lookup.data);
  if (!mapping) {
    return jsonError(CONVERSATION_NOT_FOUND_MESSAGE, 404);
  }

  return jsonResponse(
    {
      success: true,
      data: {
        conversation_id: mapping.conversationId,
        listing_id: mapping.listingId,
        chatwoot_conversation_id: mapping.chatwootConversationId,
        status: "ready" as const,
      },
    },
    200,
  );
}

export async function handleConversationMessagesGet(
  _request: Request,
  dependencies: ConversationReadMessagesDependencies,
  params: { conversationId: string },
): Promise<Response> {
  const conversationId = asUuid(params.conversationId);
  if (!conversationId) {
    return jsonError("Invalid conversation id", 400);
  }

  const paginationResult = parseMessagesPagination(_request);
  if (!paginationResult.ok) {
    return jsonError(paginationResult.error, 400);
  }

  const supabase = (await dependencies.createServerSupabaseClient()) as SupabaseClient;
  const userResult = await supabase.auth.getUser();
  if (userResult.error || !userResult.data.user) {
    return jsonError("Authentication required", 401);
  }

  const mappingResult = await loadReadyMappingById(supabase, {
    conversationId,
    userId: userResult.data.user.id,
  });
  if (!mappingResult.ok) {
    return jsonError(mappingResult.error, mappingResult.status);
  }

  const chatwootResult = await resolveChatwootClient(dependencies);
  if (!chatwootResult.ok) {
    return jsonError(chatwootResult.error, chatwootResult.status);
  }

  const listResult = await chatwootResult.client.listMessages({
    sourceId: mappingResult.mapping.chatwootSourceId,
    conversationId: mappingResult.mapping.chatwootConversationId,
    pagination: paginationResult.value,
  });
  if (!listResult.ok) {
    return jsonError(PROVIDER_FAILURE_MESSAGE, 502);
  }

  const messages = sanitizeChatwootMessageList(listResult.value);

  return jsonResponse(
    {
      success: true,
      data: {
        conversation_id: mappingResult.mapping.conversationId,
        pagination: paginationResult.value,
        messages,
      },
    },
    200,
  );
}

export async function handleConversationMessagesPost(
  request: Request,
  dependencies: ConversationReadMessagesDependencies,
  params: { conversationId: string },
): Promise<Response> {
  const trustedRequestResult = validateStateChangingJsonRequestEnvelope(
    request,
    MESSAGES_ROUTE_CONFIG,
  );
  if (!trustedRequestResult.ok) {
    return jsonError(trustedRequestResult.error, trustedRequestResult.status);
  }

  const bodyResult = await readMessagePostBody(request);
  if (!bodyResult.ok) {
    return jsonError(bodyResult.error, bodyResult.status);
  }

  const conversationId = asUuid(params.conversationId);
  if (!conversationId) {
    return jsonError("Invalid conversation id", 400);
  }

  const supabase = (await dependencies.createServerSupabaseClient()) as SupabaseClient;
  const userResult = await supabase.auth.getUser();
  if (userResult.error || !userResult.data.user) {
    return jsonError("Authentication required", 401);
  }

  const mappingResult = await loadReadyMappingById(supabase, {
    conversationId,
    userId: userResult.data.user.id,
  });
  if (!mappingResult.ok) {
    return jsonError(mappingResult.error, mappingResult.status);
  }

  const chatwootResult = await resolveChatwootClient(dependencies);
  if (!chatwootResult.ok) {
    return jsonError(chatwootResult.error, chatwootResult.status);
  }

  const sendResult = await chatwootResult.client.createIncomingMessage({
    sourceId: mappingResult.mapping.chatwootSourceId,
    conversationId: mappingResult.mapping.chatwootConversationId,
    content: bodyResult.body.content,
  });
  if (!sendResult.ok) {
    return jsonError(PROVIDER_FAILURE_MESSAGE, 502);
  }

  const sanitized = sanitizeChatwootMessage(sendResult.value);
  if (!sanitized) {
    return jsonError(PROVIDER_FAILURE_MESSAGE, 502);
  }

  return jsonResponse(
    {
      success: true,
      data: {
        conversation_id: mappingResult.mapping.conversationId,
        message: sanitized,
      },
    },
    201,
  );
}

async function loadReadyMappingById(
  supabase: SupabaseClient,
  input: { conversationId: string; userId: string },
): Promise<
  | { ok: true; mapping: MappingRow }
  | { ok: false; status: number; error: string }
> {
  const lookup = await supabase
    .from("chatwoot_conversations")
    .select("id,listing_id,chatwoot_conversation_id,chatwoot_source_id,status,user_id")
    .eq("id", input.conversationId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (lookup.error) {
    return {
      ok: false,
      status: 500,
      error: "Conversation lookup failed",
    };
  }

  const mapping = parseReadyMappingRow(lookup.data);
  if (!mapping) {
    return {
      ok: false,
      status: 404,
      error: CONVERSATION_NOT_FOUND_MESSAGE,
    };
  }

  return { ok: true, mapping };
}

async function resolveChatwootClient(
  dependencies: ConversationReadMessagesDependencies,
): Promise<
  | { ok: true; client: ConversationMessagesClient }
  | { ok: false; status: number; error: string }
> {
  const configResult = (dependencies.resolveChatwootConfig ?? resolveChatwootConfigFromEnv)();
  if (!configResult.ok) {
    return {
      ok: false,
      status: 500,
      error: "Chatwoot configuration is incomplete",
    };
  }

  const factory = dependencies.createChatwootClient ?? ((config) => {
    const client = createChatwootClient(config);
    return {
      listMessages: (input) => client.listMessages(input),
      createIncomingMessage: (input) => client.createIncomingMessage(input),
    } satisfies ConversationMessagesClient;
  });

  return {
    ok: true,
    client: factory(configResult.value),
  };
}

async function readMessagePostBody(
  request: Request,
): Promise<
  | { ok: true; body: { content: string } }
  | { ok: false; status: number; error: string }
> {
  const payloadResult = await readStateChangingJsonRequestPayload(
    request,
    MESSAGES_ROUTE_CONFIG,
  );
  if (!payloadResult.ok) {
    return payloadResult;
  }

  if (!isRecord(payloadResult.value)) {
    return {
      ok: false,
      status: 400,
      error: "Invalid message request body",
    };
  }

  if (typeof payloadResult.value.content !== "string") {
    return {
      ok: false,
      status: 400,
      error: "Message content must be between 1 and 2000 characters",
    };
  }

  const content = payloadResult.value.content.trim();
  if (content.length < 1 || content.length > 2000) {
    return {
      ok: false,
      status: 400,
      error: "Message content must be between 1 and 2000 characters",
    };
  }

  return {
    ok: true,
    body: { content },
  };
}

function parseReadyMappingRow(value: unknown): MappingRow | null {
  if (!isRecord(value)) {
    return null;
  }
  if (value.status !== "ready") {
    return null;
  }

  const conversationId = asUuid(value.id);
  const listingId = asUuid(value.listing_id);
  const chatwootConversationId = asNonEmptyString(value.chatwoot_conversation_id);
  const chatwootSourceId = asNonEmptyString(value.chatwoot_source_id);
  if (!conversationId || !listingId || !chatwootConversationId || !chatwootSourceId) {
    return null;
  }

  return {
    conversationId,
    listingId,
    chatwootConversationId,
    chatwootSourceId,
  };
}

function parseMessagesPagination(
  request: Request,
): { ok: true; value: ChatwootMessagePagination } | { ok: false; error: string } {
  const url = new URL(request.url);

  const limitResult = parsePaginationParam(url.searchParams.get("limit"), "limit");
  if (!limitResult.ok) {
    return limitResult;
  }

  const offsetResult = parsePaginationParam(url.searchParams.get("offset"), "offset");
  if (!offsetResult.ok) {
    return offsetResult;
  }

  const limit = limitResult.value ?? DEFAULT_MESSAGES_LIMIT;
  const offset = offsetResult.value ?? 0;

  if (limit < 1 || limit > MAX_MESSAGES_LIMIT) {
    return { ok: false, error: "Invalid query parameter: limit" };
  }

  if (offset < 0) {
    return { ok: false, error: "Invalid query parameter: offset" };
  }

  return {
    ok: true,
    value: {
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

function sanitizeChatwootMessageList(value: unknown[]): SanitizedMessage[] {
  const result: SanitizedMessage[] = [];
  for (const entry of value) {
    const sanitized = sanitizeChatwootMessage(entry);
    if (!sanitized) {
      continue;
    }
    if (!isCustomerFacingMessage(sanitized)) {
      continue;
    }
    result.push(sanitized);
  }
  return result;
}

function isCustomerFacingMessage(message: SanitizedMessage): boolean {
  if (message.private) {
    return false;
  }

  return message.message_type === "incoming" || message.message_type === "outgoing";
}

function sanitizeChatwootMessage(value: unknown): SanitizedMessage | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readStringOrNumberId(value.id);
  if (!id) {
    return null;
  }

  return {
    id,
    content: asNonEmptyString(value.content),
    message_type: mapMessageType(value.message_type),
    created_at: typeof value.created_at === "number" && Number.isFinite(value.created_at)
      ? value.created_at
      : null,
    private: value.private === true,
  };
}

function mapMessageType(value: unknown): SanitizedMessage["message_type"] {
  if (value === 0 || value === "incoming") {
    return "incoming";
  }
  if (value === 1 || value === "outgoing") {
    return "outgoing";
  }
  if (value === 2 || value === "activity") {
    return "activity";
  }
  if (value === 3 || value === "template") {
    return "template";
  }

  return "outgoing";
}

function readStringOrNumberId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return asNonEmptyString(value);
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
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
