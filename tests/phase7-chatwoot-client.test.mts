import assert from "node:assert/strict";
import test from "node:test";

import {
  buildChatwootContactIdentifier,
  buildChatwootIdentifierHash,
  createChatwootClient,
  resolveChatwootConfigFromEnv,
} from "../lib/communications/chatwoot.ts";

test("chatwoot identity helper builds stable user identifier and HMAC", () => {
  const identifier = buildChatwootContactIdentifier("11111111-1111-4111-8111-111111111111");

  assert.equal(identifier, "user:11111111-1111-4111-8111-111111111111");
  assert.equal(
    buildChatwootIdentifierHash(identifier, "chatwoot-secret"),
    "94b5152a4fd909e4d1b7ee78a1f1cad28a047093f128298c6b72cfa866dd37ad",
  );
});

test("chatwoot config fails closed when required env is missing", () => {
  const result = resolveChatwootConfigFromEnv({
    CHATWOOT_BASE_URL: "https://chat.example.com",
    CHATWOOT_INBOX_IDENTIFIER: "inbox_123",
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, "Chatwoot configuration is incomplete");
});

test("chatwoot config rejects invalid base url and normalizes valid origin", () => {
  const invalidResult = resolveChatwootConfigFromEnv({
    CHATWOOT_BASE_URL: "ftp://chat.example.com",
    CHATWOOT_INBOX_IDENTIFIER: "inbox_123",
    CHATWOOT_HMAC_TOKEN: "chatwoot-secret",
  });
  assert.equal(invalidResult.ok, false);
  assert.equal(invalidResult.error, "CHATWOOT_BASE_URL must be an absolute http(s) URL");

  const validResult = resolveChatwootConfigFromEnv({
    CHATWOOT_BASE_URL: " https://chat.example.com/app ",
    CHATWOOT_INBOX_IDENTIFIER: " inbox_123 ",
    CHATWOOT_HMAC_TOKEN: " chatwoot-secret ",
  });

  assert.equal(validResult.ok, true);
  if (!validResult.ok) {
    throw new Error("Expected valid config");
  }
  assert.deepEqual(validResult.value, {
    baseUrl: "https://chat.example.com",
    inboxIdentifier: "inbox_123",
    hmacToken: "chatwoot-secret",
  });
});

test("chatwoot client builds contact, conversation, and message requests", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    calls.push({ url: String(input), init: init ?? {} });
    if (String(input).endsWith("/contacts")) {
      return Response.json({ source_id: "contact-source-123" });
    }
    if (String(input).endsWith("/conversations")) {
      return Response.json({ id: 9876 });
    }
    if (String(input).endsWith("/messages") && init?.method === "GET") {
      return Response.json([{ id: 1, content: "Merhaba" }]);
    }
    return Response.json({ id: 2, content: "Selam" });
  };

  const client = createChatwootClient(
    {
      baseUrl: "https://chat.example.com",
      inboxIdentifier: "inbox_123",
      hmacToken: "chatwoot-secret",
    },
    fetchImpl,
  );

  const contactResult = await client.createContact({
    identifier: "user:11111111-1111-4111-8111-111111111111",
    email: "ali@example.com",
    name: "Ali Veli",
    phone: "+905551112233",
    customAttributes: {
      user_id: "11111111-1111-4111-8111-111111111111",
    },
  });
  const conversationResult = await client.createConversation({
    sourceId: "contact-source-123",
    customAttributes: {
      listing_id: "22222222-2222-4222-8222-222222222222",
      listing_title: "Kadikoy 2+1",
    },
  });
  const messagesResult = await client.listMessages({
    sourceId: "contact-source-123",
    conversationId: "9876",
  });
  const messageResult = await client.createIncomingMessage({
    sourceId: "contact-source-123",
    conversationId: "9876",
    content: "Merhaba",
  });

  assert.deepEqual(contactResult, { ok: true, value: { sourceId: "contact-source-123" } });
  assert.deepEqual(conversationResult, { ok: true, value: { conversationId: "9876" } });
  assert.deepEqual(messagesResult, { ok: true, value: [{ id: 1, content: "Merhaba" }] });
  assert.deepEqual(messageResult, { ok: true, value: { id: 2, content: "Selam" } });

  assert.equal(
    calls[0]?.url,
    "https://chat.example.com/public/api/v1/inboxes/inbox_123/contacts",
  );
  assert.equal(calls[0]?.init.method, "POST");
  assert.equal(calls[0]?.init.headers instanceof Headers, true);
  const contactBody = JSON.parse(String(calls[0]?.init.body)) as Record<string, unknown>;
  assert.equal(contactBody.identifier, "user:11111111-1111-4111-8111-111111111111");
  assert.equal(contactBody.identifier_hash, buildChatwootIdentifierHash(
    "user:11111111-1111-4111-8111-111111111111",
    "chatwoot-secret",
  ));
  assert.equal(contactBody.email, "ali@example.com");
  assert.equal(contactBody.name, "Ali Veli");
  assert.equal(contactBody.phone_number, "+905551112233");
  assert.deepEqual(contactBody.custom_attributes, {
    user_id: "11111111-1111-4111-8111-111111111111",
  });

  assert.equal(
    calls[1]?.url,
    "https://chat.example.com/public/api/v1/inboxes/inbox_123/contacts/contact-source-123/conversations",
  );
  const conversationBody = JSON.parse(String(calls[1]?.init.body)) as Record<string, unknown>;
  assert.deepEqual(conversationBody.custom_attributes, {
    listing_id: "22222222-2222-4222-8222-222222222222",
    listing_title: "Kadikoy 2+1",
  });

  assert.equal(
    calls[2]?.url,
    "https://chat.example.com/public/api/v1/inboxes/inbox_123/contacts/contact-source-123/conversations/9876/messages",
  );
  assert.equal(calls[2]?.init.method, "GET");

  const messageBody = JSON.parse(String(calls[3]?.init.body)) as Record<string, unknown>;
  assert.deepEqual(messageBody, {
    content: "Merhaba",
    message_type: "incoming",
  });
});

test("chatwoot client sanitizes provider failures and never returns the hmac secret", async () => {
  const client = createChatwootClient(
    {
      baseUrl: "https://chat.example.com",
      inboxIdentifier: "inbox_123",
      hmacToken: "chatwoot-secret",
    },
    async () =>
      Response.json(
        {
          error: "provider leaked detail",
          token: "chatwoot-secret",
        },
        { status: 500 },
      ),
  );

  const result = await client.createContact({
    identifier: "user:11111111-1111-4111-8111-111111111111",
  });

  assert.deepEqual(result, {
    ok: false,
    status: 502,
    error: "Chatwoot contact request failed",
  });
  assert.doesNotMatch(JSON.stringify(result), /chatwoot-secret/);
  assert.doesNotMatch(JSON.stringify(result), /provider leaked detail/);
});
