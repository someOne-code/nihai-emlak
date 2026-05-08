import assert from "node:assert/strict";
import test from "node:test";

import {
  provisionRetriedChatwootConversation,
  type ChatwootProvisionWorkerDependencies,
} from "../lib/inngest/functions/chatwoot-provision.ts";

const CONVERSATION_ID = "11111111-1111-4111-8111-111111111111";
const LISTING_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";

test("provisionRetriedChatwootConversation creates provider conversation and completes mapping", async () => {
  const calls: string[] = [];
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

  const result = await provisionRetriedChatwootConversation(
    {
      conversationId: CONVERSATION_ID,
    },
    createDeps({
      chatwoot: {
        createContact: async (input) => {
          calls.push(`contact:${input.identifier}:${input.email}:${input.name}`);
          return { ok: true, value: { sourceId: "source-123" } };
        },
        createConversation: async (input) => {
          calls.push(`conversation:${input.sourceId}:${input.customAttributes?.conversation_mapping_id}`);
          return { ok: true, value: { conversationId: "cw-456" } };
        },
      },
      rpcCalls,
    }),
  );

  assert.deepEqual(result, { ok: true, conversationId: CONVERSATION_ID });
  assert.deepEqual(calls, [
    "contact:user:33333333-3333-4333-8333-333333333333:ali@example.com:Ali Veli",
    "conversation:source-123:11111111-1111-4111-8111-111111111111",
  ]);
  assert.deepEqual(rpcCalls, [
    {
      name: "system_complete_chatwoot_conversation_claim",
      args: {
        p_mapping_id: CONVERSATION_ID,
        p_chatwoot_source_id: "source-123",
        p_chatwoot_conversation_id: "cw-456",
      },
    },
  ]);
});

test("provisionRetriedChatwootConversation marks mapping failed when provider fails", async () => {
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

  const result = await provisionRetriedChatwootConversation(
    {
      conversationId: CONVERSATION_ID,
    },
    createDeps({
      chatwoot: {
        createContact: async () => ({ ok: false, status: 502, error: "provider down" }),
        createConversation: async () => {
          throw new Error("should not create conversation after contact failure");
        },
      },
      rpcCalls,
    }),
  );

  assert.deepEqual(result, { ok: false, conversationId: CONVERSATION_ID });
  assert.deepEqual(rpcCalls, [
    {
      name: "system_mark_chatwoot_conversation_claim_failed",
      args: {
        p_mapping_id: CONVERSATION_ID,
        p_failure_reason: "Communication provider request failed",
      },
    },
  ]);
});

function createDeps(options: {
  chatwoot: ChatwootProvisionWorkerDependencies["createChatwootClient"] extends () => infer T ? T : never;
  rpcCalls: Array<{ name: string; args: Record<string, unknown> }>;
}): ChatwootProvisionWorkerDependencies {
  return {
    createAdminClient: () => ({
      from: (table: string) => {
        assert.equal(table, "chatwoot_conversations");
        return {
          select: () => ({
            eq: (_column: string, value: string) => {
              assert.equal(value, CONVERSATION_ID);
              return {
                maybeSingle: async () => ({
                  data: {
                    id: CONVERSATION_ID,
                    user_id: USER_ID,
                    listing_id: LISTING_ID,
                    status: "provisioning",
                    profiles: {
                      email: "ali@example.com",
                      full_name: "Ali Veli",
                    },
                    listings: {
                      title: "Kadikoy 2+1",
                    },
                  },
                  error: null,
                }),
              };
            },
          }),
        };
      },
      rpc: async (name: string, args: Record<string, unknown>) => {
        options.rpcCalls.push({ name, args });
        return { data: null, error: null };
      },
    }),
    createChatwootClient: () => options.chatwoot,
    resolveChatwootConfig: () => ({
      ok: true,
      value: {
        baseUrl: "https://chat.example.com",
        hmacToken: "secret",
        inboxIdentifier: "inbox",
      },
    }),
  };
}
