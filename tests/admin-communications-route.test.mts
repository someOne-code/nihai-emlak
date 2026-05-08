import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import {
  handleAdminCommunicationsGet,
  handleAdminCommunicationsPost,
  type AdminCommunicationsRouteDependencies,
} from "../lib/admin/communications-route.ts";

const ADMIN_USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VALID_CONVERSATION_ID = "11111111-1111-4111-8111-111111111111";

function setupCommunicationsAdminEnv(t: TestContext): void {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousSiteUrl = process.env.SITE_URL;
  const previousPublicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const previousVercelUrl = process.env.VERCEL_URL;

  process.env.NODE_ENV = "test";
  delete process.env.SITE_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.VERCEL_URL;

  t.after(() => {
    process.env.NODE_ENV = previousNodeEnv;
    if (previousSiteUrl !== undefined) process.env.SITE_URL = previousSiteUrl;
    if (previousPublicSiteUrl !== undefined) process.env.NEXT_PUBLIC_SITE_URL = previousPublicSiteUrl;
    if (previousVercelUrl !== undefined) process.env.VERCEL_URL = previousVercelUrl;
  });
}

// ── GET tests ────────────────────────────────────────────────────────

test("GET rejects unauthenticated requests", async () => {
  const response = await handleAdminCommunicationsGet(
    new Request("http://localhost:3000/api/admin/communications", { method: "GET" }),
    createDeps({ userId: null }),
  );

  assert.equal(response.status, 401);
});

test("GET rejects non-admin requests", async () => {
  const response = await handleAdminCommunicationsGet(
    new Request("http://localhost:3000/api/admin/communications", { method: "GET" }),
    createDeps({ profileRole: "editor" }),
  );

  assert.equal(response.status, 403);
});

test("GET returns conversations list for admin", async () => {
  const fakeRow = {
    id: VALID_CONVERSATION_ID,
    user_id: ADMIN_USER_ID,
    listing_id: "33333333-3333-4333-8333-333333333333",
    status: "ready",
    chatwoot_source_id: "src",
    chatwoot_conversation_id: "cw",
    failure_reason: null,
    created_at: "2026-05-01T10:00:00Z",
    updated_at: "2026-05-01T10:30:00Z",
    profiles: { id: ADMIN_USER_ID, full_name: "Ali", email: "a@b.com" },
    listings: { id: "33333333-3333-4333-8333-333333333333", title: "Daire", city: "Istanbul", district: null },
  };

  const response = await handleAdminCommunicationsGet(
    new Request("http://localhost:3000/api/admin/communications", { method: "GET" }),
    createDeps({ selectData: [fakeRow] }),
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.data.conversations.length, 1);
  assert.equal(body.data.conversations[0].id, VALID_CONVERSATION_ID);
});

test("GET applies status search and pagination before reading conversations", async () => {
  const queryCalls: Array<{ method: string; column?: string; value?: unknown; from?: number; to?: number }> = [];

  const response = await handleAdminCommunicationsGet(
    new Request("http://localhost:3000/api/admin/communications?status=issues&search=src&limit=10&offset=20", { method: "GET" }),
    createDeps({ selectData: [], queryCalls }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(queryCalls, [
    { method: "in", column: "status", value: ["provisioning", "failed"] },
    {
      method: "or",
      value: "chatwoot_source_id.ilike.%src%,chatwoot_conversation_id.ilike.%src%,failure_reason.ilike.%src%",
    },
    { method: "order", column: "updated_at", value: { ascending: false } },
    { method: "range", from: 20, to: 29 },
  ]);
});

test("GET returns non-secret Chatwoot open-link config for admin", async (t) => {
  const previousBaseUrl = process.env.CHATWOOT_BASE_URL;
  const previousAccountId = process.env.CHATWOOT_ACCOUNT_ID;
  const previousHmacToken = process.env.CHATWOOT_HMAC_TOKEN;

  process.env.CHATWOOT_BASE_URL = "http://localhost:3001/app";
  process.env.CHATWOOT_ACCOUNT_ID = "1";
  process.env.CHATWOOT_HMAC_TOKEN = "must-not-leak";

  t.after(() => {
    if (previousBaseUrl === undefined) delete process.env.CHATWOOT_BASE_URL;
    else process.env.CHATWOOT_BASE_URL = previousBaseUrl;
    if (previousAccountId === undefined) delete process.env.CHATWOOT_ACCOUNT_ID;
    else process.env.CHATWOOT_ACCOUNT_ID = previousAccountId;
    if (previousHmacToken === undefined) delete process.env.CHATWOOT_HMAC_TOKEN;
    else process.env.CHATWOOT_HMAC_TOKEN = previousHmacToken;
  });

  const response = await handleAdminCommunicationsGet(
    new Request("http://localhost:3000/api/admin/communications", { method: "GET" }),
    createDeps({ selectData: [] }),
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.data.chatwoot, {
    web_base_url: "http://localhost:3001",
    account_id: "1",
  });
  assert.doesNotMatch(JSON.stringify(body), /must-not-leak/);
});

// ── POST tests ────────────────────────────────────────────────────────

test("POST rejects request without JSON content-type", async (t) => {
  setupCommunicationsAdminEnv(t);
  const response = await handleAdminCommunicationsPost(
    new Request("http://localhost:3000/api/admin/communications", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
      body: "not-json",
    }),
    createDeps({}),
  );

  assert.equal(response.status, 415);
});

test("POST rejects request with untrusted origin", async (t) => {
  setupCommunicationsAdminEnv(t);
  const response = await handleAdminCommunicationsPost(
    new Request("http://localhost:3000/api/admin/communications", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://evil.example.com",
      },
      body: JSON.stringify({ conversation_id: VALID_CONVERSATION_ID }),
    }),
    createDeps({}),
  );

  assert.equal(response.status, 403);
});

test("POST rejects unauthenticated requests", async (t) => {
  setupCommunicationsAdminEnv(t);
  const response = await handleAdminCommunicationsPost(
    createPostRequest({ conversation_id: VALID_CONVERSATION_ID }),
    createDeps({ userId: null }),
  );

  assert.equal(response.status, 401);
});

test("POST rejects non-admin requests", async (t) => {
  setupCommunicationsAdminEnv(t);
  const response = await handleAdminCommunicationsPost(
    createPostRequest({ conversation_id: VALID_CONVERSATION_ID }),
    createDeps({ profileRole: "editor" }),
  );

  assert.equal(response.status, 403);
});

test("POST returns 400 when conversation_id is missing", async (t) => {
  setupCommunicationsAdminEnv(t);
  const response = await handleAdminCommunicationsPost(
    createPostRequest({}),
    createDeps({}),
  );

  assert.equal(response.status, 400);
});

test("POST returns 400 when conversation_id is not a UUID", async (t) => {
  setupCommunicationsAdminEnv(t);
  const response = await handleAdminCommunicationsPost(
    createPostRequest({ conversation_id: "not-a-uuid" }),
    createDeps({}),
  );

  assert.equal(response.status, 400);
});

test("POST returns 409 when mapping is not in failed state", async (t) => {
  setupCommunicationsAdminEnv(t);
  const response = await handleAdminCommunicationsPost(
    createPostRequest({ conversation_id: VALID_CONVERSATION_ID }),
    createDeps({
      rpc: () => ({
        data: null,
        error: { code: "22023", message: "conversation is not in failed state" },
      }),
    }),
  );

  assert.equal(response.status, 409);
});

test("POST calls admin_retry_chatwoot_conversation RPC and returns success", async (t) => {
  setupCommunicationsAdminEnv(t);
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const events: Array<{ name: string; data: Record<string, unknown> }> = [];

  const response = await handleAdminCommunicationsPost(
    createPostRequest({ conversation_id: VALID_CONVERSATION_ID }),
    createDeps({
      rpc: (name, args) => {
        calls.push({ name, args });
        return {
          data: {
            result: "retry_started",
            conversation_id: VALID_CONVERSATION_ID,
            listing_id: "33333333-3333-4333-8333-333333333333",
            user_id: ADMIN_USER_ID,
          },
          error: null,
        };
      },
      sendInngestEvent: (event) => {
        events.push(event);
        return Promise.resolve();
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [
    {
      name: "admin_retry_chatwoot_conversation",
      args: { p_conversation_id: VALID_CONVERSATION_ID },
    },
  ]);
  assert.deepEqual(events, [
    {
      name: "chatwoot/conversation.retry_requested",
      data: {
        conversation_id: VALID_CONVERSATION_ID,
        listing_id: "33333333-3333-4333-8333-333333333333",
        user_id: ADMIN_USER_ID,
      },
    },
  ]);
});

// ── helpers ──────────────────────────────────────────────────────────

function createPostRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/admin/communications", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify(body),
  });
}

type DepsOptions = {
  userId?: string | null;
  profileRole?: string | null;
  profileError?: { code?: string | null; message?: string | null } | null;
  selectData?: unknown[];
  selectError?: { code?: string | null; message?: string | null } | null;
  queryCalls?: Array<{ method: string; column?: string; value?: unknown; from?: number; to?: number }>;
  rpc?: (
    name: "admin_retry_chatwoot_conversation",
    args: Record<string, unknown>,
  ) => {
    data: unknown;
    error: { code?: string | null; message?: string | null } | null;
  };
  sendInngestEvent?: (event: { name: string; data: Record<string, unknown> }) => Promise<void>;
};

function createDeps(options: DepsOptions): AdminCommunicationsRouteDependencies {
  return {
    createServerSupabaseClient: async () => ({
      auth: {
        getUser: async () => ({
          data: {
            user: options.userId === null
              ? null
              : { id: options.userId ?? ADMIN_USER_ID },
          },
          error: null,
        }),
      },
      from: (table: string) => {
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: options.profileError
                    ? null
                    : { role: options.profileRole ?? "admin" },
                  error: options.profileError ?? null,
                }),
              }),
            }),
          };
        }
        if (table === "chatwoot_conversations") {
          return {
            select: () => {
              const query = {
                eq: (column: string, value: string) => {
                  options.queryCalls?.push({ method: "eq", column, value });
                  return query;
                },
                in: (column: string, value: string[]) => {
                  options.queryCalls?.push({ method: "in", column, value });
                  return query;
                },
                or: (value: string) => {
                  options.queryCalls?.push({ method: "or", value });
                  return query;
                },
                order: (column: string, value: { ascending: boolean }) => {
                  options.queryCalls?.push({ method: "order", column, value });
                  return query;
                },
                range: async (from: number, to: number) => {
                  options.queryCalls?.push({ method: "range", from, to });
                  return {
                    data: options.selectData ?? [],
                    error: options.selectError ?? null,
                  };
                },
                limit: async (value: number) => {
                  options.queryCalls?.push({ method: "limit", value });
                  return {
                  data: options.selectData ?? [],
                  error: options.selectError ?? null,
                  };
                },
              };
              return query;
            },
          };
        }
        throw new Error(`unexpected table: ${table}`);
      },
      rpc: async (name: string, args: Record<string, unknown>) => {
        if (!options.rpc) {
          return { data: null, error: null };
        }
        return options.rpc(
          name as "admin_retry_chatwoot_conversation",
          args,
        );
      },
    }),
    sendInngestEvent: options.sendInngestEvent,
  };
}
