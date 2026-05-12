import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import test from "node:test";

import {
  handleListingConversationPost,
  type ConversationOpenRouteDependencies,
} from "../lib/communications/conversation-open-route.ts";

const LISTING_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const MAPPING_ID = "33333333-3333-4333-8333-333333333333";
const CHATWOOT_SOURCE_ID = "source-123";
const CHATWOOT_CONVERSATION_ID = "98765";

type SupabaseError = {
  code?: string | null;
  message?: string | null;
};

type RpcCall = {
  args: Record<string, unknown>;
  functionName: string;
};

type ChatwootCall = {
  input: Record<string, unknown>;
  method: string;
};

test("conversation open rejects non-json state-changing requests before auth", async (t) => {
  setupCommunicationEnv(t);

  const response = await handleListingConversationPost(
    new Request(`http://localhost:3000/api/communications/listings/${LISTING_ID}/conversation`, {
      method: "POST",
      headers: {
        "content-type": "text/plain",
        origin: "http://localhost:3000",
      },
      body: "not-json",
    }),
    createFailingDependencies(),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 415);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Communication conversation requires application/json",
  });
});

test("conversation open rejects untrusted origins before auth", async (t) => {
  setupCommunicationEnv(t);

  const response = await handleListingConversationPost(
    createJsonRequest({}, "https://evil.example"),
    createFailingDependencies(),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Communication conversation Origin is not trusted",
  });
});

test("conversation open rejects oversized bodies before auth", async (t) => {
  setupCommunicationEnv(t);

  const response = await handleListingConversationPost(
    createJsonRequest({ initial_message: "a".repeat(8 * 1024) }),
    createFailingDependencies(),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Communication conversation payload is too large",
  });
});

test("conversation open rejects invalid listing ids before auth", async (t) => {
  setupCommunicationEnv(t);

  const response = await handleListingConversationPost(
    createJsonRequest({}),
    createFailingDependencies(),
    { listingId: "not-a-uuid" },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Invalid listing id",
  });
});

test("conversation open rejects unauthenticated requests", async (t) => {
  setupCommunicationEnv(t);

  const response = await handleListingConversationPost(
    createJsonRequest({}),
    createDependencies({
      userId: null,
      rpc: () => {
        throw new Error("rpc should not run for unauthenticated requests");
      },
    }),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Authentication required",
  });
});

test("conversation open rejects invalid initial messages", async (t) => {
  setupCommunicationEnv(t);

  const response = await handleListingConversationPost(
    createJsonRequest({ initial_message: "   " }),
    createDependencies({
      rpc: () => {
        throw new Error("rpc should not run for invalid message content");
      },
    }),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Initial message must be between 1 and 2000 characters",
  });
});

test("conversation open returns existing ready mapping without Chatwoot calls", async (t) => {
  setupCommunicationEnv(t);
  const rpcCalls: RpcCall[] = [];

  const response = await handleListingConversationPost(
    createJsonRequest({ initial_message: "Bu mesaj tekrar gonderilmemeli" }),
    createDependencies({
      chatwootClient: createFailingChatwootClient(),
      rpc: (functionName, args) => {
        rpcCalls.push({ functionName, args });
        return {
          data: {
            result: "ready",
            conversation_id: MAPPING_ID,
            listing_id: LISTING_ID,
            status: "ready",
            chatwoot_source_id: CHATWOOT_SOURCE_ID,
            chatwoot_conversation_id: CHATWOOT_CONVERSATION_ID,
            failure_reason: null,
          },
          error: null,
        };
      },
    }),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(rpcCalls, [
    {
      functionName: "claim_chatwoot_conversation",
      args: { p_listing_id: LISTING_ID },
    },
  ]);
  assert.deepEqual(await response.json(), {
    success: true,
    data: {
      conversation_id: MAPPING_ID,
      listing_id: LISTING_ID,
      chatwoot_conversation_id: CHATWOOT_CONVERSATION_ID,
      status: "ready",
    },
  });
});

test("conversation open provisions a new Chatwoot conversation and optional initial message", async (t) => {
  setupCommunicationEnv(t);
  const rpcCalls: RpcCall[] = [];
  const adminRpcCalls: RpcCall[] = [];
  const chatwootCalls: ChatwootCall[] = [];

  const response = await handleListingConversationPost(
    createJsonRequest({ initial_message: "  Merhaba, ilan hakkinda bilgi alabilir miyim?  " }),
    createDependencies({
      chatwootClient: {
        createContact: async (input: Record<string, unknown>) => {
          chatwootCalls.push({ method: "createContact", input });
          return { ok: true, value: { sourceId: CHATWOOT_SOURCE_ID } };
        },
        createConversation: async (input: Record<string, unknown>) => {
          chatwootCalls.push({ method: "createConversation", input });
          return { ok: true, value: { conversationId: CHATWOOT_CONVERSATION_ID } };
        },
        createIncomingMessage: async (input: Record<string, unknown>) => {
          chatwootCalls.push({ method: "createIncomingMessage", input });
          return { ok: true, value: { id: "message-1" } };
        },
      },
      rpc: (functionName, args) => {
        rpcCalls.push({ functionName, args });
        if (functionName === "claim_chatwoot_conversation") {
          return {
            data: {
              result: "claimed",
              conversation_id: MAPPING_ID,
              listing_id: LISTING_ID,
              status: "provisioning",
              chatwoot_source_id: null,
              chatwoot_conversation_id: null,
              failure_reason: null,
            },
            error: null,
          };
        }

        return {
          data: {
            conversation_id: MAPPING_ID,
            listing_id: LISTING_ID,
            status: "ready",
            chatwoot_source_id: CHATWOOT_SOURCE_ID,
            chatwoot_conversation_id: CHATWOOT_CONVERSATION_ID,
            failure_reason: null,
          },
          error: null,
        };
      },
      adminRpc: (functionName, args) => {
        adminRpcCalls.push({ functionName, args });
        return {
          data: {
            conversation_id: MAPPING_ID,
            listing_id: LISTING_ID,
            status: "ready",
            chatwoot_source_id: CHATWOOT_SOURCE_ID,
            chatwoot_conversation_id: CHATWOOT_CONVERSATION_ID,
            failure_reason: null,
          },
          error: null,
        };
      },
    }),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 201);
  assert.deepEqual(rpcCalls, [
    {
      functionName: "claim_chatwoot_conversation",
      args: { p_listing_id: LISTING_ID },
    },
  ]);
  assert.deepEqual(adminRpcCalls, [
    {
      functionName: "system_complete_chatwoot_conversation_claim",
      args: {
        p_mapping_id: MAPPING_ID,
        p_chatwoot_source_id: CHATWOOT_SOURCE_ID,
        p_chatwoot_conversation_id: CHATWOOT_CONVERSATION_ID,
      },
    },
  ]);
  assert.deepEqual(chatwootCalls, [
    {
      method: "createContact",
      input: {
        identifier: `user:${USER_ID}`,
        email: "ali@example.com",
        name: "Ali Veli",
        phone: "+90 555 111 22 33",
        customAttributes: {
          user_id: USER_ID,
        },
      },
    },
    {
      method: "createConversation",
      input: {
        sourceId: CHATWOOT_SOURCE_ID,
        customAttributes: {
          listing_id: LISTING_ID,
          user_id: USER_ID,
          conversation_mapping_id: MAPPING_ID,
        },
      },
    },
    {
      method: "createIncomingMessage",
      input: {
        sourceId: CHATWOOT_SOURCE_ID,
        conversationId: CHATWOOT_CONVERSATION_ID,
        content: "Merhaba, ilan hakkinda bilgi alabilir miyim?",
      },
    },
  ]);
  assert.deepEqual(await response.json(), {
    success: true,
    data: {
      conversation_id: MAPPING_ID,
      listing_id: LISTING_ID,
      chatwoot_conversation_id: CHATWOOT_CONVERSATION_ID,
      status: "ready",
    },
  });
});

test("conversation open maps duplicate first-claim race to in-progress response", async (t) => {
  setupCommunicationEnv(t);

  const response = await handleListingConversationPost(
    createJsonRequest({ initial_message: "Merhaba" }),
    createDependencies({
      rpc: () => ({
        data: null,
        error: {
          code: "23505",
          message: "duplicate key value violates unique constraint chatwoot_conversations_user_listing_key",
        },
      }),
    }),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Conversation provisioning is already in progress",
  });
});

test("conversation open marks claims failed and sanitizes provider failures", async (t) => {
  setupCommunicationEnv(t);
  const rpcCalls: RpcCall[] = [];
  const adminRpcCalls: RpcCall[] = [];

  const response = await handleListingConversationPost(
    createJsonRequest({ initial_message: "Merhaba" }),
    createDependencies({
      chatwootClient: {
        createContact: async () => ({
          ok: false,
          status: 502,
          error: "raw provider payload with CHATWOOT_HMAC_TOKEN=super-secret",
        }),
        createConversation: async () => {
          throw new Error("conversation should not be created after contact failure");
        },
        createIncomingMessage: async () => {
          throw new Error("message should not be created after contact failure");
        },
      },
      rpc: (functionName, args) => {
        rpcCalls.push({ functionName, args });
        if (functionName === "claim_chatwoot_conversation") {
          return {
            data: {
              result: "claimed",
              conversation_id: MAPPING_ID,
              listing_id: LISTING_ID,
              status: "provisioning",
              chatwoot_source_id: null,
              chatwoot_conversation_id: null,
              failure_reason: null,
            },
            error: null,
          };
        }

        return {
          data: {
            conversation_id: MAPPING_ID,
            status: "failed",
          },
          error: null,
        };
      },
      adminRpc: (functionName, args) => {
        adminRpcCalls.push({ functionName, args });
        return {
          data: {
            conversation_id: MAPPING_ID,
            status: "failed",
          },
          error: null,
        };
      },
    }),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 502);
  const payload = await response.json();
  assert.deepEqual(payload, {
    success: false,
    error: "Communication provider request failed",
  });
  assert.equal(JSON.stringify(payload).includes("super-secret"), false);
  assert.deepEqual(rpcCalls, [
    {
      functionName: "claim_chatwoot_conversation",
      args: { p_listing_id: LISTING_ID },
    },
  ]);
  assert.deepEqual(adminRpcCalls, [
    {
      functionName: "system_mark_chatwoot_conversation_claim_failed",
      args: {
        p_mapping_id: MAPPING_ID,
        p_failure_reason: "Communication provider request failed",
      },
    },
  ]);
});

function createJsonRequest(payload: unknown, origin: string | null = "http://localhost:3000"): Request {
  const headers = new Headers({
    "content-type": "application/json",
  });
  if (origin !== null) {
    headers.set("origin", origin);
  }

  return new Request(`http://localhost:3000/api/communications/listings/${LISTING_ID}/conversation`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

function createFailingDependencies(): ConversationOpenRouteDependencies {
  return {
    createServerSupabaseClient: async () => {
      throw new Error("Supabase client should not be created");
    },
  };
}

function createDependencies(options: {
  adminRpc?: (
    functionName: string,
    args: Record<string, unknown>,
  ) => { data: unknown; error: SupabaseError | null };
  authError?: SupabaseError | null;
  chatwootClient?: Record<string, (input: Record<string, unknown>) => Promise<unknown>>;
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => { data: unknown; error: SupabaseError | null };
  userId?: string | null;
}): ConversationOpenRouteDependencies {
  return {
    createAdminSupabaseClient: () => ({
      rpc: async (functionName: string, args: Record<string, unknown>) => {
        if (!options.adminRpc) {
          throw new Error("admin rpc should not run for this test");
        }

        return options.adminRpc(functionName, args);
      },
    }),
    createChatwootClient: () => options.chatwootClient ?? createFailingChatwootClient(),
    createServerSupabaseClient: async () => ({
      auth: {
        getUser: async () => ({
          data: {
            user: options.userId === null
              ? null
              : {
                id: options.userId ?? USER_ID,
                email: "ali@example.com",
                phone: "+90 555 111 22 33",
                user_metadata: {
                  full_name: "Ali Veli",
                },
              },
          },
          error: options.authError ?? null,
        }),
      },
      rpc: async (functionName: string, args: Record<string, unknown>) =>
        options.rpc(functionName, args),
    }),
    resolveChatwootConfig: () => ({
      ok: true,
      value: {
        baseUrl: "https://chatwoot.example",
        inboxIdentifier: "inbox-id",
        hmacToken: "hmac-secret",
      },
    }),
  };
}

function createFailingChatwootClient(): Record<string, (input: Record<string, unknown>) => Promise<unknown>> {
  return {
    createContact: async () => {
      throw new Error("Chatwoot contact should not be called");
    },
    createConversation: async () => {
      throw new Error("Chatwoot conversation should not be called");
    },
    createIncomingMessage: async () => {
      throw new Error("Chatwoot message should not be called");
    },
  };
}

function setupCommunicationEnv(t: TestContext): void {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousSiteUrl = process.env.SITE_URL;
  const previousPublicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const previousVercelUrl = process.env.VERCEL_URL;

  process.env.NODE_ENV = "test";
  delete process.env.SITE_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.VERCEL_URL;

  t.after(() => {
    restoreEnv("NODE_ENV", previousNodeEnv);
    restoreEnv("SITE_URL", previousSiteUrl);
    restoreEnv("NEXT_PUBLIC_SITE_URL", previousPublicSiteUrl);
    restoreEnv("VERCEL_URL", previousVercelUrl);
  });
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
