import {
  buildChatwootContactIdentifier,
  createChatwootClient,
  resolveChatwootConfigFromEnv,
  type ChatwootClientResult,
  type ChatwootConfig,
  type CreateChatwootContactInput,
  type CreateChatwootConversationInput,
  type CreateChatwootMessageInput,
} from "./chatwoot.ts";
import { createAdminClient } from "../supabase/admin.ts";
import {
  readStateChangingJsonRequestPayload,
  validateStateChangingJsonRequestEnvelope,
  type StateChangingJsonRouteConfig,
} from "../http/state-changing-json-route.ts";

type SupabaseError = {
  code?: string | null;
  message?: string | null;
};

type SupabaseRpcResponse = {
  data: unknown;
  error: SupabaseError | null;
};

type SupabaseUser = {
  email?: string | null;
  id: string;
  phone?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

type SupabaseClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: SupabaseUser | null };
      error: SupabaseError | null;
    }>;
  };
  rpc: (
    functionName: "claim_chatwoot_conversation",
    args: Record<string, unknown>,
  ) => Promise<SupabaseRpcResponse>;
};

type SystemSupabaseClient = {
  rpc: (
    functionName:
      | "system_complete_chatwoot_conversation_claim"
      | "system_mark_chatwoot_conversation_claim_failed",
    args: Record<string, unknown>,
  ) => Promise<SupabaseRpcResponse>;
};

export type ChatwootConversationOpenClient = {
  createContact: (
    input: CreateChatwootContactInput,
  ) => Promise<ChatwootClientResult<{ sourceId: string }>>;
  createConversation: (
    input: CreateChatwootConversationInput,
  ) => Promise<ChatwootClientResult<{ conversationId: string }>>;
  createIncomingMessage: (
    input: CreateChatwootMessageInput,
  ) => Promise<ChatwootClientResult<unknown>>;
};

export type ConversationOpenRouteDependencies = {
  createAdminSupabaseClient?: () => unknown | null;
  createChatwootClient?: (config: ChatwootConfig) => ChatwootConversationOpenClient;
  createServerSupabaseClient: () => Promise<unknown>;
  resolveChatwootConfig?: () =>
    | { ok: true; value: ChatwootConfig }
    | { ok: false; error: string };
};

type ConversationOpenBody = {
  initialMessage: string | null;
};

type ConversationClaimRow = {
  chatwootConversationId: string | null;
  chatwootSourceId: string | null;
  conversationId: string;
  listingId: string;
  result: "claimed" | "in_progress" | "ready";
  status: "failed" | "provisioning" | "ready";
};

const COMMUNICATION_CONVERSATION_ROUTE_CONFIG: StateChangingJsonRouteConfig = {
  maxBodyBytes: 4 * 1024,
  routeLabel: "Communication conversation",
};

const PROVIDER_FAILURE_MESSAGE = "Communication provider request failed";

export async function handleListingConversationPost(
  request: Request,
  dependencies: ConversationOpenRouteDependencies,
  params: { listingId: string },
): Promise<Response> {
  const trustedRequestResult = validateStateChangingJsonRequestEnvelope(
    request,
    COMMUNICATION_CONVERSATION_ROUTE_CONFIG,
  );
  if (!trustedRequestResult.ok) {
    return jsonError(trustedRequestResult.error, trustedRequestResult.status);
  }

  const bodyResult = await readConversationOpenBody(request);
  if (!bodyResult.ok) {
    return jsonError(bodyResult.error, bodyResult.status);
  }

  const listingId = asUuid(params.listingId);
  if (!listingId) {
    return jsonError("Invalid listing id", 400);
  }

  const supabase = (await dependencies.createServerSupabaseClient()) as SupabaseClient;
  const userResult = await supabase.auth.getUser();
  if (userResult.error || !userResult.data.user) {
    return jsonError("Authentication required", 401);
  }

  const claimResult = await supabase.rpc("claim_chatwoot_conversation", {
    p_listing_id: listingId,
  });
  if (claimResult.error) {
    const mappedError = mapClaimRpcError(claimResult.error);
    return jsonError(mappedError.error, mappedError.status);
  }

  const claim = parseConversationClaimRow(claimResult.data);
  if (!claim) {
    return jsonError("Invalid conversation claim response", 500);
  }

  if (claim.result === "ready") {
    if (!claim.chatwootConversationId) {
      return jsonError("Invalid ready conversation claim response", 500);
    }

    return jsonConversationSuccess(claim, 200);
  }

  if (claim.result === "in_progress") {
    return jsonError("Conversation provisioning is already in progress", 409);
  }

  const systemClient = (
    dependencies.createAdminSupabaseClient
      ? dependencies.createAdminSupabaseClient()
      : createAdminClient()
  ) as SystemSupabaseClient | null;
  if (!systemClient) {
    return jsonError("Communication provisioning service is unavailable", 500);
  }

  const configResult = (dependencies.resolveChatwootConfig ?? resolveChatwootConfigFromEnv)();
  if (!configResult.ok) {
    await markClaimFailed(systemClient, claim.conversationId);
    return jsonError("Chatwoot configuration is incomplete", 500);
  }

  const chatwoot = (dependencies.createChatwootClient ?? createChatwootClient)(
    configResult.value,
  );
  const providerResult = await provisionChatwootConversation({
    body: bodyResult.body,
    chatwoot,
    claim,
    user: userResult.data.user,
  });
  if (!providerResult.ok) {
    const markFailedResult = await markClaimFailed(systemClient, claim.conversationId);
    if (!markFailedResult.ok) {
      return jsonError(markFailedResult.error, markFailedResult.status);
    }

    return jsonError(PROVIDER_FAILURE_MESSAGE, 502);
  }

  const completeResult = await systemClient.rpc("system_complete_chatwoot_conversation_claim", {
    p_mapping_id: claim.conversationId,
    p_chatwoot_source_id: providerResult.sourceId,
    p_chatwoot_conversation_id: providerResult.conversationId,
  });
  if (completeResult.error) {
    return jsonError("Failed to complete conversation claim", 500);
  }

  const completedClaim = parseCompletedConversationRow(completeResult.data, {
    conversationId: claim.conversationId,
    listingId,
    providerConversationId: providerResult.conversationId,
    providerSourceId: providerResult.sourceId,
  });
  if (!completedClaim) {
    return jsonError("Invalid completed conversation claim response", 500);
  }

  return jsonConversationSuccess(completedClaim, 201);
}

async function provisionChatwootConversation(input: {
  body: ConversationOpenBody;
  chatwoot: ChatwootConversationOpenClient;
  claim: ConversationClaimRow;
  user: SupabaseUser;
}): Promise<
  | { ok: true; conversationId: string; sourceId: string }
  | { ok: false }
> {
  const identifier = buildChatwootContactIdentifier(input.user.id);
  const contactResult = await input.chatwoot.createContact({
    identifier,
    email: asNonEmptyString(input.user.email),
    name: resolveUserDisplayName(input.user),
    phone: asNonEmptyString(input.user.phone),
    customAttributes: {
      user_id: input.user.id,
    },
  });
  if (!contactResult.ok) {
    return { ok: false };
  }

  const conversationResult = await input.chatwoot.createConversation({
    sourceId: contactResult.value.sourceId,
    customAttributes: {
      listing_id: input.claim.listingId,
      user_id: input.user.id,
      conversation_mapping_id: input.claim.conversationId,
    },
  });
  if (!conversationResult.ok) {
    return { ok: false };
  }

  if (input.body.initialMessage) {
    const messageResult = await input.chatwoot.createIncomingMessage({
      sourceId: contactResult.value.sourceId,
      conversationId: conversationResult.value.conversationId,
      content: input.body.initialMessage,
    });
    if (!messageResult.ok) {
      return { ok: false };
    }
  }

  return {
    ok: true,
    conversationId: conversationResult.value.conversationId,
    sourceId: contactResult.value.sourceId,
  };
}

async function readConversationOpenBody(
  request: Request,
): Promise<
  | { ok: true; body: ConversationOpenBody }
  | { ok: false; status: number; error: string }
> {
  const payloadResult = await readStateChangingJsonRequestPayload(
    request,
    COMMUNICATION_CONVERSATION_ROUTE_CONFIG,
  );
  if (!payloadResult.ok) {
    return payloadResult;
  }

  return parseConversationOpenBody(payloadResult.value);
}

function parseConversationOpenBody(
  value: unknown,
): { ok: true; body: ConversationOpenBody } | { ok: false; status: number; error: string } {
  if (!isRecord(value)) {
    return {
      ok: false,
      status: 400,
      error: "Invalid conversation request body",
    };
  }

  if (!Object.hasOwn(value, "initial_message") || value.initial_message === undefined) {
    return {
      ok: true,
      body: {
        initialMessage: null,
      },
    };
  }

  if (typeof value.initial_message !== "string") {
    return {
      ok: false,
      status: 400,
      error: "Initial message must be between 1 and 2000 characters",
    };
  }

  const initialMessage = value.initial_message.trim();
  if (initialMessage.length < 1 || initialMessage.length > 2000) {
    return {
      ok: false,
      status: 400,
      error: "Initial message must be between 1 and 2000 characters",
    };
  }

  return {
    ok: true,
    body: {
      initialMessage,
    },
  };
}

function parseConversationClaimRow(value: unknown): ConversationClaimRow | null {
  const row = unwrapSingleRpcRow(value);
  if (!isRecord(row)) {
    return null;
  }

  const result = asClaimResult(row.result);
  const conversationId = asUuid(row.conversation_id);
  const listingId = asUuid(row.listing_id);
  const status = asConversationStatus(row.status);
  if (!result || !conversationId || !listingId || !status) {
    return null;
  }

  return {
    chatwootConversationId: asNonEmptyString(row.chatwoot_conversation_id),
    chatwootSourceId: asNonEmptyString(row.chatwoot_source_id),
    conversationId,
    listingId,
    result,
    status,
  };
}

function unwrapSingleRpcRow(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.length === 1 ? value[0] : null;
  }

  return value;
}

function parseCompletedConversationRow(
  value: unknown,
  fallback: {
    conversationId: string;
    listingId: string;
    providerConversationId: string;
    providerSourceId: string;
  },
): ConversationClaimRow | null {
  const row = unwrapSingleRpcRow(value);
  if (!isRecord(row)) {
    if (Array.isArray(value)) {
      return null;
    }

    return {
      chatwootConversationId: fallback.providerConversationId,
      chatwootSourceId: fallback.providerSourceId,
      conversationId: fallback.conversationId,
      listingId: fallback.listingId,
      result: "ready",
      status: "ready",
    };
  }

  const conversationId = asUuid(row.conversation_id) ?? fallback.conversationId;
  const listingId = asUuid(row.listing_id) ?? fallback.listingId;
  const chatwootSourceId = asNonEmptyString(row.chatwoot_source_id) ?? fallback.providerSourceId;
  const chatwootConversationId = asNonEmptyString(row.chatwoot_conversation_id)
    ?? fallback.providerConversationId;
  const status = asConversationStatus(row.status) ?? "ready";

  if (status !== "ready") {
    return null;
  }

  return {
    chatwootConversationId,
    chatwootSourceId,
    conversationId,
    listingId,
    result: "ready",
    status,
  };
}

async function markClaimFailed(
  supabase: SystemSupabaseClient,
  conversationId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const result = await supabase.rpc("system_mark_chatwoot_conversation_claim_failed", {
    p_mapping_id: conversationId,
    p_failure_reason: PROVIDER_FAILURE_MESSAGE,
  });

  if (result.error) {
    return {
      ok: false,
      status: 500,
      error: "Failed to mark conversation claim failed",
    };
  }

  return { ok: true };
}

function mapClaimRpcError(error: SupabaseError): { status: number; error: string } {
  if (error.code === "28000") {
    return {
      status: 401,
      error: "Authentication required",
    };
  }

  if (error.code === "22023" || error.code === "P0002") {
    return {
      status: 400,
      error: "Invalid conversation request",
    };
  }

  if (error.code === "23505") {
    return {
      status: 409,
      error: "Conversation provisioning is already in progress",
    };
  }

  return {
    status: 500,
    error: "Conversation claim failed",
  };
}

function jsonConversationSuccess(claim: ConversationClaimRow, status: number): Response {
  return jsonResponse(
    {
      success: true,
      data: {
        conversation_id: claim.conversationId,
        listing_id: claim.listingId,
        chatwoot_conversation_id: claim.chatwootConversationId,
        status: claim.status,
      },
    },
    status,
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

function resolveUserDisplayName(user: SupabaseUser): string | null {
  const metadata = user.user_metadata;
  if (!metadata) {
    return null;
  }

  return asNonEmptyString(metadata.full_name)
    ?? asNonEmptyString(metadata.name)
    ?? asNonEmptyString(metadata.display_name);
}

function asClaimResult(value: unknown): ConversationClaimRow["result"] | null {
  if (value === "claimed" || value === "in_progress" || value === "ready") {
    return value;
  }

  return null;
}

function asConversationStatus(value: unknown): ConversationClaimRow["status"] | null {
  if (value === "failed" || value === "provisioning" || value === "ready") {
    return value;
  }

  return null;
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
