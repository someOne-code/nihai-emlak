import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  AdminCommunicationsClientError,
  loadAdminCommunicationsOverview,
  retryAdminCommunicationsConversation,
} from "../lib/admin-ui/communications-client.ts";
import { loadCommunicationsModel } from "../lib/admin-ui/communications-controller.ts";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("loadAdminCommunicationsOverview returns conversations on success", async () => {
  const fetcher = async () =>
    jsonResponse({
      success: true,
      data: { conversations: [{ id: "a" }] },
    });

  const result = await loadAdminCommunicationsOverview({ fetcher });

  assert.equal(result.conversations.length, 1);
});

test("loadAdminCommunicationsOverview sends server-side filters as query params", async () => {
  let capturedUrl = "";
  const fetcher = async (input: RequestInfo | URL) => {
    capturedUrl = typeof input === "string" ? input : input.toString();
    return jsonResponse({
      success: true,
      data: { conversations: [] },
    });
  };

  await loadAdminCommunicationsOverview({
    filters: {
      status: "issues",
      search: "src",
      limit: 10,
      offset: 20,
    },
    fetcher,
  });

  assert.equal(
    capturedUrl,
    "/api/admin/communications?status=issues&search=src&limit=10&offset=20",
  );
});

test("loadCommunicationsModel passes Chatwoot open-link config into view model", async () => {
  const fetcher = async () =>
    jsonResponse({
      success: true,
      data: {
        conversations: [{
          id: "11111111-1111-1111-1111-111111111111",
          user_id: "22222222-2222-2222-2222-222222222222",
          listing_id: "33333333-3333-3333-3333-333333333333",
          status: "ready",
          chatwoot_source_id: "source-1",
          chatwoot_conversation_id: "9876",
          failure_reason: null,
          created_at: "2026-05-01T10:00:00Z",
          updated_at: "2026-05-01T10:30:00Z",
          profiles: null,
          listings: null,
        }],
        chatwoot: {
          web_base_url: "http://localhost:3001",
          account_id: "1",
        },
      },
    });

  const result = await loadCommunicationsModel({ fetcher });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(
    result.viewModel.rows[0]?.chatwootOpenHref,
    "http://localhost:3001/app/accounts/1/conversations/9876",
  );
});

test("loadAdminCommunicationsOverview throws typed error on failure envelope", async () => {
  const fetcher = async () =>
    jsonResponse({ success: false, error: "Yetkisiz" }, 403);

  await assert.rejects(
    () => loadAdminCommunicationsOverview({ fetcher }),
    (err: unknown) => {
      assert.ok(err instanceof AdminCommunicationsClientError);
      assert.equal((err as AdminCommunicationsClientError).status, 403);
      assert.match((err as Error).message, /Yetkisiz/);
      return true;
    },
  );
});

test("loadAdminCommunicationsOverview rejects malformed payload", async () => {
  const fetcher = async () =>
    new Response("not-json", { status: 200, headers: { "content-type": "application/json" } });

  await assert.rejects(() => loadAdminCommunicationsOverview({ fetcher }));
});

test("retryAdminCommunicationsConversation posts conversation_id and returns data", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;

  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = typeof input === "string" ? input : input.toString();
    capturedInit = init;
    return jsonResponse({ success: true, data: { conversation_id: "abc" } });
  };

  const result = await retryAdminCommunicationsConversation("abc", { fetcher });

  assert.equal(capturedUrl, "/api/admin/communications");
  assert.equal(capturedInit?.method, "POST");
  assert.equal(
    (capturedInit?.headers as Record<string, string>)["content-type"],
    "application/json",
  );
  assert.match(capturedInit?.body as string, /"conversation_id":"abc"/);
  assert.deepEqual(result, { conversation_id: "abc" });
});

test("CommunicationsView renders Chatwoot open links as safe external actions", () => {
  const source = readFileSync(
    new URL("../components/admin-communications/CommunicationsView.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /chatwootOpenHref/);
  assert.match(source, /Chatwoot'ta aç/);
  assert.match(source, /target="_blank"/);
  assert.match(source, /rel="noopener noreferrer"/);
  assert.match(source, /kurulum durumlarını yönet/);
});
