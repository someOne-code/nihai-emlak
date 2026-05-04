import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import test from "node:test";

import {
  handleConversationMessagesGet,
  handleConversationMessagesPost,
  handleListingConversationGet,
  type ConversationReadMessagesDependencies,
} from "../lib/communications/conversation-read-messages-route.ts";

const LISTING_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const MAPPING_ID = "33333333-3333-4333-8333-333333333333";
const CHATWOOT_SOURCE_ID = "source-123";
const CHATWOOT_CONVERSATION_ID = "98765";

type SupabaseError = {
  code?: string | null;
  message?: string | null;
};

type FromCall = {
  table: string;
  filter: Array<{ column: string; value: string }>;
};

type ChatwootCall = {
  method: string;
  input: Record<string, unknown>;
};

test("listing conversation GET rejects unauthenticated requests", async (t) => {
  setupCommunicationEnv(t);

  const response = await handleListingConversationGet(
    new Request(`http://localhost:3000/api/communications/listings/${LISTING_ID}/conversation`),
    createDependencies({
      userId: null,
      maybeSingle: () => {
        throw new Error("supabase from() should not run for unauthenticated requests");
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

test("listing conversation GET rejects invalid listing ids", async (t) => {
  setupCommunicationEnv(t);

  const response = await handleListingConversationGet(
    new Request("http://localhost:3000/api/communications/listings/not-a-uuid/conversation"),
    createDependencies({
      maybeSingle: () => {
        throw new Error("supabase from() should not run for invalid uuid");
      },
    }),
    { listingId: "not-a-uuid" },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Invalid listing id",
  });
});

test("listing conversation GET returns 404 when no ready mapping exists", async (t) => {
  setupCommunicationEnv(t);
  const fromCalls: FromCall[] = [];

  const response = await handleListingConversationGet(
    new Request(`http://localhost:3000/api/communications/listings/${LISTING_ID}/conversation`),
    createDependencies({
      maybeSingle: (call) => {
        fromCalls.push(call);
        return { data: null, error: null };
      },
    }),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Conversation not found",
  });
  assert.equal(fromCalls.length, 1);
  assert.equal(fromCalls[0].table, "chatwoot_conversations");
});

test("listing conversation GET returns sanitized ready mapping", async (t) => {
  setupCommunicationEnv(t);

  const response = await handleListingConversationGet(
    new Request(`http://localhost:3000/api/communications/listings/${LISTING_ID}/conversation`),
    createDependencies({
      maybeSingle: () => ({
        data: {
          id: MAPPING_ID,
          listing_id: LISTING_ID,
          chatwoot_conversation_id: CHATWOOT_CONVERSATION_ID,
          chatwoot_source_id: CHATWOOT_SOURCE_ID,
          status: "ready",
          user_id: USER_ID,
          failure_reason: null,
        },
        error: null,
      }),
    }),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 200);
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

test("listing conversation GET returns 404 when mapping is not ready", async (t) => {
  setupCommunicationEnv(t);

  const response = await handleListingConversationGet(
    new Request(`http://localhost:3000/api/communications/listings/${LISTING_ID}/conversation`),
    createDependencies({
      maybeSingle: () => ({
        data: {
          id: MAPPING_ID,
          listing_id: LISTING_ID,
          chatwoot_conversation_id: null,
          chatwoot_source_id: null,
          status: "provisioning",
          user_id: USER_ID,
          failure_reason: null,
        },
        error: null,
      }),
    }),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Conversation not found",
  });
});

test("messages GET rejects unauthenticated requests", async (t) => {
  setupCommunicationEnv(t);

  const response = await handleConversationMessagesGet(
    new Request(`http://localhost:3000/api/communications/conversations/${MAPPING_ID}/messages`),
    createDependencies({
      userId: null,
      maybeSingle: () => {
        throw new Error("supabase from() should not run for unauthenticated requests");
      },
      chatwootClient: createFailingChatwootClient(),
    }),
    { conversationId: MAPPING_ID },
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Authentication required",
  });
});

test("messages GET rejects invalid conversation ids", async (t) => {
  setupCommunicationEnv(t);

  const response = await handleConversationMessagesGet(
    new Request("http://localhost:3000/api/communications/conversations/not-a-uuid/messages"),
    createDependencies({
      maybeSingle: () => {
        throw new Error("supabase from() should not run for invalid uuid");
      },
      chatwootClient: createFailingChatwootClient(),
    }),
    { conversationId: "not-a-uuid" },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Invalid conversation id",
  });
});

test("messages GET returns 404 when caller does not own the mapping", async (t) => {
  setupCommunicationEnv(t);

  const response = await handleConversationMessagesGet(
    new Request(`http://localhost:3000/api/communications/conversations/${MAPPING_ID}/messages`),
    createDependencies({
      maybeSingle: () => ({ data: null, error: null }),
      chatwootClient: createFailingChatwootClient(),
    }),
    { conversationId: MAPPING_ID },
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Conversation not found",
  });
});

test("messages GET sanitizes Chatwoot provider failures", async (t) => {
  setupCommunicationEnv(t);

  const response = await handleConversationMessagesGet(
    new Request(`http://localhost:3000/api/communications/conversations/${MAPPING_ID}/messages`),
    createDependencies({
      maybeSingle: () => ({
        data: readyMappingRow(),
        error: null,
      }),
      chatwootClient: {
        listMessages: async () => ({
          ok: false,
          status: 502,
          error: "raw provider payload with CHATWOOT_HMAC_TOKEN=super-secret",
        }),
        createIncomingMessage: async () => {
          throw new Error("createIncomingMessage should not be called");
        },
      },
    }),
    { conversationId: MAPPING_ID },
  );

  assert.equal(response.status, 502);
  const payload = await response.json();
  assert.deepEqual(payload, {
    success: false,
    error: "Communication provider request failed",
  });
  assert.equal(JSON.stringify(payload).includes("super-secret"), false);
});

test("messages GET returns sanitized message summaries", async (t) => {
  setupCommunicationEnv(t);
  const chatwootCalls: ChatwootCall[] = [];

  const response = await handleConversationMessagesGet(
    new Request(`http://localhost:3000/api/communications/conversations/${MAPPING_ID}/messages`),
    createDependencies({
      maybeSingle: () => ({
        data: readyMappingRow(),
        error: null,
      }),
      chatwootClient: {
        listMessages: async (input: Record<string, unknown>) => {
          chatwootCalls.push({ method: "listMessages", input });
          return {
            ok: true,
            value: [
              {
                id: 101,
                content: "Merhaba",
                message_type: 0,
                created_at: 1714457200,
                private: false,
                sender: { name: "Ali", email: "ali@example.com" },
              },
              {
                id: 102,
                content: "Tabii ki!",
                message_type: 1,
                created_at: 1714457260,
                private: false,
              },
              {
                id: 103,
                content: "Internal note (private outgoing)",
                message_type: 1,
                created_at: 1714457320,
                private: true,
              },
              {
                id: 104,
                content: "Conversation activity",
                message_type: 2,
                created_at: 1714457380,
                private: false,
              },
              {
                id: 105,
                content: "Template auto reply",
                message_type: 3,
                created_at: 1714457440,
                private: false,
              },
              "garbage-entry",
            ],
          };
        },
        createIncomingMessage: async () => {
          throw new Error("createIncomingMessage should not be called");
        },
      },
    }),
    { conversationId: MAPPING_ID },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(chatwootCalls, [
    {
      method: "listMessages",
      input: {
        sourceId: CHATWOOT_SOURCE_ID,
        conversationId: CHATWOOT_CONVERSATION_ID,
      },
    },
  ]);
  assert.deepEqual(await response.json(), {
    success: true,
    data: {
      conversation_id: MAPPING_ID,
      messages: [
        {
          id: "101",
          content: "Merhaba",
          message_type: "incoming",
          created_at: 1714457200,
          private: false,
        },
        {
          id: "102",
          content: "Tabii ki!",
          message_type: "outgoing",
          created_at: 1714457260,
          private: false,
        },
      ],
    },
  });
});

test("messages POST rejects non-json state-changing requests before auth", async (t) => {
  setupCommunicationEnv(t);

  const response = await handleConversationMessagesPost(
    new Request(`http://localhost:3000/api/communications/conversations/${MAPPING_ID}/messages`, {
      method: "POST",
      headers: {
        "content-type": "text/plain",
        origin: "http://localhost:3000",
      },
      body: "not-json",
    }),
    createFailingDependencies(),
    { conversationId: MAPPING_ID },
  );

  assert.equal(response.status, 415);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Communication message requires application/json",
  });
});

test("messages POST rejects untrusted origins before auth", async (t) => {
  setupCommunicationEnv(t);

  const response = await handleConversationMessagesPost(
    createMessagesJsonRequest({ content: "Merhaba" }, "https://evil.example"),
    createFailingDependencies(),
    { conversationId: MAPPING_ID },
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Communication message Origin is not trusted",
  });
});

test("messages POST rejects oversized bodies before auth", async (t) => {
  setupCommunicationEnv(t);

  const response = await handleConversationMessagesPost(
    createMessagesJsonRequest({ content: "a".repeat(8 * 1024) }),
    createFailingDependencies(),
    { conversationId: MAPPING_ID },
  );

  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Communication message payload is too large",
  });
});

test("messages POST rejects invalid conversation ids", async (t) => {
  setupCommunicationEnv(t);

  const response = await handleConversationMessagesPost(
    createMessagesJsonRequest({ content: "Merhaba" }),
    createDependencies({
      maybeSingle: () => {
        throw new Error("supabase from() should not run for invalid uuid");
      },
      chatwootClient: createFailingChatwootClient(),
    }),
    { conversationId: "not-a-uuid" },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Invalid conversation id",
  });
});

test("messages POST rejects unauthenticated requests", async (t) => {
  setupCommunicationEnv(t);

  const response = await handleConversationMessagesPost(
    createMessagesJsonRequest({ content: "Merhaba" }),
    createDependencies({
      userId: null,
      maybeSingle: () => {
        throw new Error("supabase from() should not run for unauthenticated requests");
      },
      chatwootClient: createFailingChatwootClient(),
    }),
    { conversationId: MAPPING_ID },
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Authentication required",
  });
});

test("messages POST rejects invalid content", async (t) => {
  setupCommunicationEnv(t);

  const response = await handleConversationMessagesPost(
    createMessagesJsonRequest({ content: "   " }),
    createDependencies({
      maybeSingle: () => {
        throw new Error("supabase from() should not run for invalid content");
      },
      chatwootClient: createFailingChatwootClient(),
    }),
    { conversationId: MAPPING_ID },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Message content must be between 1 and 2000 characters",
  });
});

test("messages POST returns 404 when caller does not own the mapping", async (t) => {
  setupCommunicationEnv(t);

  const response = await handleConversationMessagesPost(
    createMessagesJsonRequest({ content: "Merhaba" }),
    createDependencies({
      maybeSingle: () => ({ data: null, error: null }),
      chatwootClient: createFailingChatwootClient(),
    }),
    { conversationId: MAPPING_ID },
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Conversation not found",
  });
});

test("messages POST sanitizes Chatwoot provider failures", async (t) => {
  setupCommunicationEnv(t);

  const response = await handleConversationMessagesPost(
    createMessagesJsonRequest({ content: "Merhaba" }),
    createDependencies({
      maybeSingle: () => ({
        data: readyMappingRow(),
        error: null,
      }),
      chatwootClient: {
        listMessages: async () => {
          throw new Error("listMessages should not be called");
        },
        createIncomingMessage: async () => ({
          ok: false,
          status: 502,
          error: "raw provider payload with CHATWOOT_HMAC_TOKEN=super-secret",
        }),
      },
    }),
    { conversationId: MAPPING_ID },
  );

  assert.equal(response.status, 502);
  const payload = await response.json();
  assert.deepEqual(payload, {
    success: false,
    error: "Communication provider request failed",
  });
  assert.equal(JSON.stringify(payload).includes("super-secret"), false);
});

test("messages POST returns 502 when provider response cannot be sanitized", async (t) => {
  setupCommunicationEnv(t);

  const response = await handleConversationMessagesPost(
    createMessagesJsonRequest({ content: "Merhaba" }),
    createDependencies({
      maybeSingle: () => ({
        data: readyMappingRow(),
        error: null,
      }),
      chatwootClient: {
        listMessages: async () => {
          throw new Error("listMessages should not be called");
        },
        createIncomingMessage: async () => ({
          ok: true,
          value: { unexpected: "shape" },
        }),
      },
    }),
    { conversationId: MAPPING_ID },
  );

  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Communication provider request failed",
  });
});

test("messages POST creates incoming message and returns sanitized summary", async (t) => {
  setupCommunicationEnv(t);
  const chatwootCalls: ChatwootCall[] = [];

  const response = await handleConversationMessagesPost(
    createMessagesJsonRequest({ content: "  Tesekkurler  " }),
    createDependencies({
      maybeSingle: () => ({
        data: readyMappingRow(),
        error: null,
      }),
      chatwootClient: {
        listMessages: async () => {
          throw new Error("listMessages should not be called");
        },
        createIncomingMessage: async (input: Record<string, unknown>) => {
          chatwootCalls.push({ method: "createIncomingMessage", input });
          return {
            ok: true,
            value: {
              id: 555,
              content: "Tesekkurler",
              message_type: 0,
              created_at: 1714457400,
              private: false,
              account_id: 7,
            },
          };
        },
      },
    }),
    { conversationId: MAPPING_ID },
  );

  assert.equal(response.status, 201);
  assert.deepEqual(chatwootCalls, [
    {
      method: "createIncomingMessage",
      input: {
        sourceId: CHATWOOT_SOURCE_ID,
        conversationId: CHATWOOT_CONVERSATION_ID,
        content: "Tesekkurler",
      },
    },
  ]);
  assert.deepEqual(await response.json(), {
    success: true,
    data: {
      conversation_id: MAPPING_ID,
      message: {
        id: "555",
        content: "Tesekkurler",
        message_type: "incoming",
        created_at: 1714457400,
        private: false,
      },
    },
  });
});

function createMessagesJsonRequest(
  payload: unknown,
  origin: string | null = "http://localhost:3000",
): Request {
  const headers = new Headers({
    "content-type": "application/json",
  });
  if (origin !== null) {
    headers.set("origin", origin);
  }

  return new Request(`http://localhost:3000/api/communications/conversations/${MAPPING_ID}/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

function createFailingDependencies(): ConversationReadMessagesDependencies {
  return {
    createServerSupabaseClient: async () => {
      throw new Error("Supabase client should not be created");
    },
  };
}

function createDependencies(options: {
  authError?: SupabaseError | null;
  chatwootClient?: Record<string, (input: Record<string, unknown>) => Promise<unknown>>;
  maybeSingle: (
    call: FromCall,
  ) => { data: unknown; error: SupabaseError | null };
  userId?: string | null;
}): ConversationReadMessagesDependencies {
  return {
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
              },
          },
          error: options.authError ?? null,
        }),
      },
      from(table: string) {
        const filter: FromCall["filter"] = [];
        const builder = {
          select() {
            return builder;
          },
          eq(column: string, value: string) {
            filter.push({ column, value });
            return builder;
          },
          maybeSingle: async () => options.maybeSingle({ table, filter }),
        };
        return builder;
      },
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
    listMessages: async () => {
      throw new Error("Chatwoot listMessages should not be called");
    },
    createIncomingMessage: async () => {
      throw new Error("Chatwoot createIncomingMessage should not be called");
    },
  };
}

function readyMappingRow(): Record<string, unknown> {
  return {
    id: MAPPING_ID,
    listing_id: LISTING_ID,
    chatwoot_conversation_id: CHATWOOT_CONVERSATION_ID,
    chatwoot_source_id: CHATWOOT_SOURCE_ID,
    status: "ready",
    user_id: USER_ID,
    failure_reason: null,
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
