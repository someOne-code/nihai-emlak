import assert from "node:assert/strict";
import test from "node:test";

import {
  buildChatwootOpenHref,
  buildCommunicationsViewModel,
  type RawChatwootConversation,
} from "../lib/admin-ui/communications-view-model.ts";

function makeRaw(overrides: Partial<RawChatwootConversation> = {}): RawChatwootConversation {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    user_id: "22222222-2222-2222-2222-222222222222",
    listing_id: "33333333-3333-3333-3333-333333333333",
    status: "ready",
    chatwoot_source_id: "src-1",
    chatwoot_conversation_id: "cw-1",
    failure_reason: null,
    created_at: "2026-05-01T10:00:00Z",
    updated_at: "2026-05-01T10:30:00Z",
    profiles: {
      id: "22222222-2222-2222-2222-222222222222",
      full_name: "Ali Veli",
      email: "ali@test.com",
    },
    listings: {
      id: "33333333-3333-3333-3333-333333333333",
      title: "Deniz Daire",
      city: "Istanbul",
      district: "Kadikoy",
    },
    ...overrides,
  };
}

test("buildCommunicationsViewModel maps raw conversation with full context", () => {
  const result = buildCommunicationsViewModel({
    conversations: [makeRaw()],
    chatwootWebBaseUrl: " https://chat.example.com/app/login ",
    chatwootAccountId: "42",
  });

  assert.equal(result.rows.length, 1);
  const row = result.rows[0];
  assert.equal(row.conversationId, "11111111-1111-1111-1111-111111111111");
  assert.equal(row.userId, "22222222-2222-2222-2222-222222222222");
  assert.equal(row.listingId, "33333333-3333-3333-3333-333333333333");
  assert.equal(row.status, "ready");
  assert.equal(row.userName, "Ali Veli");
  assert.equal(row.userEmail, "ali@test.com");
  assert.equal(row.listingTitle, "Deniz Daire");
  assert.equal(row.locationLabel, "Istanbul / Kadikoy");
  assert.equal(row.chatwootConversationId, "cw-1");
  assert.equal(
    row.chatwootOpenHref,
    "https://chat.example.com/app/accounts/42/conversations/cw-1",
  );
  assert.equal(row.failureReason, null);
});

test("buildCommunicationsViewModel handles missing profiles/listings", () => {
  const result = buildCommunicationsViewModel({
    conversations: [makeRaw({ profiles: null, listings: null })],
  });

  const row = result.rows[0];
  assert.equal(row.userName, null);
  assert.equal(row.userEmail, null);
  assert.equal(row.listingTitle, "Bilinmeyen İlan");
  assert.equal(row.locationLabel, null);
});

test("buildCommunicationsViewModel preserves failure_reason for failed mappings", () => {
  const result = buildCommunicationsViewModel({
    conversations: [
      makeRaw({
        status: "failed",
        chatwoot_source_id: null,
        chatwoot_conversation_id: null,
        failure_reason: "Chatwoot provisioning failed",
      }),
    ],
  });

  const row = result.rows[0];
  assert.equal(row.status, "failed");
  assert.equal(row.failureReason, "Chatwoot provisioning failed");
  assert.equal(row.chatwootConversationId, null);
  assert.equal(row.chatwootOpenHref, null);
});

test("buildCommunicationsViewModel does not leak unknown raw fields into row", () => {
  const raw = makeRaw() as RawChatwootConversation & Record<string, unknown>;
  raw.secret_token = "should-not-leak";
  raw.internal_payload = { foo: "bar" };

  const result = buildCommunicationsViewModel({ conversations: [raw] });
  const row = result.rows[0] as Record<string, unknown>;

  assert.equal(row.secret_token, undefined);
  assert.equal(row.internal_payload, undefined);
});

test("buildChatwootOpenHref returns null unless ready row and safe config are present", () => {
  const config = {
    chatwootWebBaseUrl: "https://chat.example.com/app",
    chatwootAccountId: "42",
  };

  assert.equal(
    buildChatwootOpenHref({
      ...config,
      status: "ready",
      providerConversationId: "cw-1",
    }),
    "https://chat.example.com/app/accounts/42/conversations/cw-1",
  );
  assert.equal(
    buildChatwootOpenHref({
      ...config,
      status: "provisioning",
      providerConversationId: "cw-1",
    }),
    null,
  );
  assert.equal(
    buildChatwootOpenHref({
      ...config,
      status: "ready",
      providerConversationId: null,
    }),
    null,
  );
  assert.equal(
    buildChatwootOpenHref({
      ...config,
      status: "ready",
      providerConversationId: "cw-1",
      chatwootWebBaseUrl: "ftp://chat.example.com",
    }),
    null,
  );
  assert.equal(
    buildChatwootOpenHref({
      ...config,
      status: "ready",
      providerConversationId: "cw-1",
      chatwootAccountId: "",
    }),
    null,
  );
});
