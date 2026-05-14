import assert from "node:assert/strict";
import test from "node:test";

import {
  createListingConversation,
  getConversationMessages,
  getListingConversation,
  sendConversationMessage,
} from "../lib/api/communications.ts";

const LISTING_ID = "11111111-1111-4111-8111-111111111111";
const CONVERSATION_ID = "22222222-2222-4222-8222-222222222222";

test("listing chat API helpers use the communications envelope endpoints", async () => {
  const requests: Array<{ body: string | null; method: string; pathname: string }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input), "http://localhost:3000");
    requests.push({
      body: typeof init?.body === "string" ? init.body : null,
      method: init?.method ?? "GET",
      pathname: url.pathname,
    });

    if (url.pathname.endsWith("/messages") && init?.method === "POST") {
      return Response.json({
        success: true,
        data: {
          conversation_id: CONVERSATION_ID,
          message: {
            id: "message-1",
            content: "Merhaba",
            message_type: "incoming",
            created_at: 1_775_000_000,
            private: false,
          },
        },
      });
    }

    if (url.pathname.endsWith("/messages")) {
      return Response.json({
        success: true,
        data: {
          conversation_id: CONVERSATION_ID,
          pagination: { limit: 20, offset: 0 },
          messages: [],
        },
      });
    }

    return Response.json({
      success: true,
      data: {
        conversation_id: CONVERSATION_ID,
        listing_id: LISTING_ID,
        chatwoot_conversation_id: "98765",
        status: "ready",
      },
    });
  };

  try {
    await getListingConversation(LISTING_ID);
    await createListingConversation(LISTING_ID);
    await getConversationMessages(CONVERSATION_ID);
    await sendConversationMessage(CONVERSATION_ID, "  Merhaba  ");

    assert.deepEqual(requests, [
      {
        body: null,
        method: "GET",
        pathname: `/api/communications/listings/${LISTING_ID}/conversation`,
      },
      {
        body: "{}",
        method: "POST",
        pathname: `/api/communications/listings/${LISTING_ID}/conversation`,
      },
      {
        body: null,
        method: "GET",
        pathname: `/api/communications/conversations/${CONVERSATION_ID}/messages`,
      },
      {
        body: JSON.stringify({ content: "Merhaba" }),
        method: "POST",
        pathname: `/api/communications/conversations/${CONVERSATION_ID}/messages`,
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
