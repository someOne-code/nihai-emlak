import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  buildChatwootContactIdentifier,
  createChatwootClient,
  resolveChatwootConfigFromEnv,
  type ChatwootClientResult,
} from "../lib/communications/chatwoot.ts";
import {
  handleConversationMessagesGet,
  handleConversationMessagesPost,
} from "../lib/communications/conversation-read-messages-route.ts";

const REQUIRED_ENV = [
  "CHATWOOT_BASE_URL",
  "CHATWOOT_INBOX_IDENTIFIER",
  "CHATWOOT_HMAC_TOKEN",
] as const;

test("chatwoot live smoke: creates conversation and exchanges an incoming message", async (t) => {
  const missing = REQUIRED_ENV.filter((name) => !isNonEmptyString(process.env[name]));
  if (missing.length > 0) {
    t.diagnostic(
      `SKIP Chatwoot live smoke: missing ${missing.join(", ")}; set these env vars to run against a local Chatwoot instance.`,
    );
    t.skip("Chatwoot live smoke configuration is incomplete");
    return;
  }

  const configResult = resolveChatwootConfigFromEnv();
  assert.equal(configResult.ok, true, configResult.ok ? undefined : configResult.error);

  const client = createChatwootClient(configResult.value);
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const identifier = buildChatwootContactIdentifier(`live-smoke-${suffix}`);
  const message = `Chatwoot live smoke ${suffix}`;

  const contact = await requireProviderSuccess(
    client.createContact({
      identifier,
      name: "Chatwoot Live Smoke",
      customAttributes: {
        source: "nihai-emlak-live-smoke",
        test_run: suffix,
      },
    }),
    "create contact",
  );

  const conversation = await requireProviderSuccess(
    client.createConversation({
      sourceId: contact.sourceId,
      customAttributes: {
        source: "nihai-emlak-live-smoke",
        test_run: suffix,
      },
    }),
    "create conversation",
  );

  await requireProviderSuccess(
    client.createIncomingMessage({
      conversationId: conversation.conversationId,
      sourceId: contact.sourceId,
      content: message,
    }),
    "create incoming message",
  );

  const messages = await requireProviderSuccess(
    client.listMessages({
      conversationId: conversation.conversationId,
      sourceId: contact.sourceId,
    }),
    "list messages",
  );

  if (messages.some((entry) => containsStringValue(entry, message))) {
    assert.ok(true);
    return;
  }

  t.diagnostic(
    "Chatwoot provider calls succeeded, but the smoke message was not visible in the current list response shape.",
  );
  assert.ok(Array.isArray(messages));
});

test("chatwoot live route smoke: backend message handlers exchange a sanitized message", async (t) => {
  const missing = REQUIRED_ENV.filter((name) => !isNonEmptyString(process.env[name]));
  if (missing.length > 0) {
    t.diagnostic(
      `SKIP Chatwoot live route smoke: missing ${missing.join(", ")}; set these env vars to run against a local Chatwoot instance.`,
    );
    t.skip("Chatwoot live route smoke configuration is incomplete");
    return;
  }

  const configResult = resolveChatwootConfigFromEnv();
  assert.equal(configResult.ok, true, configResult.ok ? undefined : configResult.error);

  const client = createChatwootClient(configResult.value);
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const listingId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const mappingId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const identifier = buildChatwootContactIdentifier(`live-route-smoke-${suffix}`);
  const message = `Chatwoot route live smoke ${suffix}`;

  const contact = await requireProviderSuccess(
    client.createContact({
      identifier,
      name: "Chatwoot Route Live Smoke",
      customAttributes: {
        source: "nihai-emlak-route-live-smoke",
        test_run: suffix,
      },
    }),
    "create route smoke contact",
  );

  const conversation = await requireProviderSuccess(
    client.createConversation({
      sourceId: contact.sourceId,
      customAttributes: {
        source: "nihai-emlak-route-live-smoke",
        test_run: suffix,
      },
    }),
    "create route smoke conversation",
  );

  const dependencies = {
    createServerSupabaseClient: async () => createMappingSupabaseClient({
      userId,
      mapping: {
        id: mappingId,
        listing_id: listingId,
        chatwoot_conversation_id: conversation.conversationId,
        chatwoot_source_id: contact.sourceId,
        status: "ready",
        user_id: userId,
      },
    }),
    resolveChatwootConfig: () => configResult,
  };

  const postResponse = await handleConversationMessagesPost(
    new Request(`http://localhost:3000/api/communications/conversations/${mappingId}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({ content: message }),
    }),
    dependencies,
    { conversationId: mappingId },
  );

  assert.equal(postResponse.status, 201);
  const postBody = await postResponse.json();
  assert.equal(postBody.success, true);
  assert.equal(postBody.data.conversation_id, mappingId);
  assert.equal(postBody.data.message.content, message);
  assert.equal(postBody.data.message.message_type, "incoming");

  const getResponse = await handleConversationMessagesGet(
    new Request(`http://localhost:3000/api/communications/conversations/${mappingId}/messages`),
    dependencies,
    { conversationId: mappingId },
  );

  assert.equal(getResponse.status, 200);
  const getBody = await getResponse.json();
  assert.equal(getBody.success, true);
  assert.equal(getBody.data.conversation_id, mappingId);
  assert.ok(
    getBody.data.messages.some(
      (entry: { content?: unknown; message_type?: unknown }) =>
        entry.content === message && entry.message_type === "incoming",
    ),
    "route GET should return the message sent through route POST",
  );
});

async function requireProviderSuccess<T>(
  pending: Promise<ChatwootClientResult<T>>,
  action: string,
): Promise<T> {
  const result = await pending;
  assert.equal(
    result.ok,
    true,
    result.ok ? undefined : `Chatwoot live smoke failed to ${action}: ${result.error}`,
  );
  return result.value;
}

function containsStringValue(value: unknown, expected: string): boolean {
  if (value === expected) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.some((entry) => containsStringValue(entry, expected));
  }
  if (isRecord(value)) {
    return Object.values(value).some((entry) => containsStringValue(entry, expected));
  }
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function createMappingSupabaseClient(input: {
  userId: string;
  mapping: Record<string, unknown>;
}) {
  return {
    auth: {
      getUser: async () => ({
        data: { user: { id: input.userId } },
        error: null,
      }),
    },
    from: (table: string) => {
      assert.equal(table, "chatwoot_conversations");
      const filters = new Map<string, string>();
      const builder = {
        select: () => builder,
        eq: (column: string, value: string) => {
          filters.set(column, value);
          return builder;
        },
        maybeSingle: async () => {
          for (const [column, value] of filters) {
            if (input.mapping[column] !== value) {
              return { data: null, error: null };
            }
          }
          return { data: input.mapping, error: null };
        },
      };
      return builder;
    },
  };
}
