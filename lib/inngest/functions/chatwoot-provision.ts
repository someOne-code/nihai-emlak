import {
  buildChatwootContactIdentifier,
  createChatwootClient,
  resolveChatwootConfigFromEnv,
  type ChatwootClientResult,
  type ChatwootConfig,
  type CreateChatwootContactInput,
  type CreateChatwootConversationInput,
} from "../../communications/chatwoot.ts";
import { inngest } from "../client.ts";
import { createAdminClient } from "../../supabase/admin.ts";

const PROVIDER_FAILURE_MESSAGE = "Communication provider request failed";

type SupabaseError = {
  code?: string | null;
  message?: string | null;
};

type SupabaseResponse<T> = {
  data: T | null;
  error: SupabaseError | null;
};

type ChatwootProvisionMappingRow = {
  id: string;
  listing_id: string;
  profiles?: {
    email?: string | null;
    full_name?: string | null;
  } | null;
  status: string;
  user_id: string;
};

type AdminClient = {
  from: (table: "chatwoot_conversations") => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<SupabaseResponse<unknown>>;
      };
    };
  };
  rpc: (
    name:
      | "system_complete_chatwoot_conversation_claim"
      | "system_mark_chatwoot_conversation_claim_failed",
    args: Record<string, unknown>,
  ) => Promise<SupabaseResponse<unknown>>;
};

type ChatwootProvisionClient = {
  createContact: (
    input: CreateChatwootContactInput,
  ) => Promise<ChatwootClientResult<{ sourceId: string }>>;
  createConversation: (
    input: CreateChatwootConversationInput,
  ) => Promise<ChatwootClientResult<{ conversationId: string }>>;
};

export type ChatwootProvisionWorkerDependencies = {
  createAdminClient?: () => AdminClient | null;
  createChatwootClient?: (config: ChatwootConfig) => ChatwootProvisionClient;
  resolveChatwootConfig?: () =>
    | { ok: true; value: ChatwootConfig }
    | { ok: false; error: string };
};

export const chatwootProvisionWorkflow = inngest.createFunction(
  {
    id: "chatwoot-provision-retry",
    triggers: [{ event: "chatwoot/conversation.retry_requested" }],
  },
  async ({ event, step }) => {
    return step.run("provision-chatwoot-conversation", async () => {
      return provisionRetriedChatwootConversation({
        conversationId: String(event.data.conversation_id ?? ""),
      });
    });
  },
);

export async function provisionRetriedChatwootConversation(
  input: { conversationId: string },
  dependencies: ChatwootProvisionWorkerDependencies = {},
): Promise<{ ok: boolean; conversationId: string }> {
  const conversationId = asUuid(input.conversationId);
  if (!conversationId) {
    return { ok: false, conversationId: input.conversationId };
  }

  const adminClient = (dependencies.createAdminClient ?? createAdminClient)() as AdminClient | null;
  if (!adminClient) {
    return { ok: false, conversationId };
  }

  const mappingResult = await loadProvisioningMapping(adminClient, conversationId);
  if (!mappingResult.ok) {
    return { ok: false, conversationId };
  }

  const configResult = (dependencies.resolveChatwootConfig ?? resolveChatwootConfigFromEnv)();
  if (!configResult.ok) {
    await markFailed(adminClient, conversationId);
    return { ok: false, conversationId };
  }

  const chatwoot = (dependencies.createChatwootClient ?? createChatwootClient)(
    configResult.value,
  );
  const providerResult = await createProviderConversation(chatwoot, mappingResult.mapping);
  if (!providerResult.ok) {
    await markFailed(adminClient, conversationId);
    return { ok: false, conversationId };
  }

  const completeResult = await adminClient.rpc("system_complete_chatwoot_conversation_claim", {
    p_mapping_id: conversationId,
    p_chatwoot_source_id: providerResult.sourceId,
    p_chatwoot_conversation_id: providerResult.conversationId,
  });

  return {
    ok: !completeResult.error,
    conversationId,
  };
}

async function loadProvisioningMapping(
  adminClient: AdminClient,
  conversationId: string,
): Promise<{ ok: true; mapping: ChatwootProvisionMappingRow } | { ok: false }> {
  const result = await adminClient
    .from("chatwoot_conversations")
    .select(`
      id,
      user_id,
      listing_id,
      status,
      profiles:profiles(email, full_name)
    `)
    .eq("id", conversationId)
    .maybeSingle();

  if (result.error || !isRecord(result.data)) {
    return { ok: false };
  }

  const mapping = parseMapping(result.data);
  if (!mapping || mapping.status !== "provisioning") {
    return { ok: false };
  }

  return { ok: true, mapping };
}

async function createProviderConversation(
  chatwoot: ChatwootProvisionClient,
  mapping: ChatwootProvisionMappingRow,
): Promise<{ ok: true; conversationId: string; sourceId: string } | { ok: false }> {
  const identifier = buildChatwootContactIdentifier(mapping.user_id);
  const contactResult = await chatwoot.createContact({
    identifier,
    email: asNonEmptyString(mapping.profiles?.email),
    name: asNonEmptyString(mapping.profiles?.full_name),
    customAttributes: {
      user_id: mapping.user_id,
    },
  });
  if (!contactResult.ok) {
    return { ok: false };
  }

  const conversationResult = await chatwoot.createConversation({
    sourceId: contactResult.value.sourceId,
    customAttributes: {
      listing_id: mapping.listing_id,
      user_id: mapping.user_id,
      conversation_mapping_id: mapping.id,
    },
  });
  if (!conversationResult.ok) {
    return { ok: false };
  }

  return {
    ok: true,
    conversationId: conversationResult.value.conversationId,
    sourceId: contactResult.value.sourceId,
  };
}

async function markFailed(adminClient: AdminClient, conversationId: string): Promise<void> {
  await adminClient.rpc("system_mark_chatwoot_conversation_claim_failed", {
    p_mapping_id: conversationId,
    p_failure_reason: PROVIDER_FAILURE_MESSAGE,
  });
}

function parseMapping(value: Record<string, unknown>): ChatwootProvisionMappingRow | null {
  const id = asUuid(value.id);
  const userId = asUuid(value.user_id);
  const listingId = asUuid(value.listing_id);
  const status = asNonEmptyString(value.status);
  if (!id || !userId || !listingId || !status) {
    return null;
  }

  const profile = isRecord(value.profiles)
    ? {
        email: asNonEmptyString(value.profiles.email),
        full_name: asNonEmptyString(value.profiles.full_name),
      }
    : null;

  return {
    id,
    listing_id: listingId,
    profiles: profile,
    status,
    user_id: userId,
  };
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
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
