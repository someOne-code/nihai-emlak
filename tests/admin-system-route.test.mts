import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import {
  handleAdminSystemGet,
  type AdminSystemRouteDependencies,
} from "../lib/admin/system-route.ts";

const ADMIN_USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

test("GET rejects unauthenticated requests", async () => {
  const response = await handleAdminSystemGet(
    new Request("http://localhost:3000/api/admin/system", { method: "GET" }),
    createDeps({ userId: null }),
  );

  assert.equal(response.status, 401);
});

test("GET rejects non-admin requests", async () => {
  const response = await handleAdminSystemGet(
    new Request("http://localhost:3000/api/admin/system", { method: "GET" }),
    createDeps({ profileRole: "support" }),
  );

  assert.equal(response.status, 403);
});

test("GET returns ready Chatwoot and Inngest statuses for admin", async (t) => {
  setupSystemEnv(t, {
    CHATWOOT_BASE_URL: "https://chat.example.com",
    CHATWOOT_INBOX_IDENTIFIER: "public-inbox-id",
    CHATWOOT_HMAC_TOKEN: "super-secret-chatwoot-token",
    CHATWOOT_ACCOUNT_ID: "42",
    INNGEST_EVENT_KEY: "event-key-secret",
    INNGEST_SIGNING_KEY: "signing-key-secret",
    DATABASE_URI: "postgres://payload-secret@example.com/payload",
    PAYLOAD_SECRET: "payload-secret",
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-secret",
    ISBANK_CLIENT_ID: "7000679",
    ISBANK_STORE_KEY: "isbank-store-secret",
  });

  const response = await handleAdminSystemGet(
    new Request("http://localhost:3000/api/admin/system", { method: "GET" }),
    createDeps({
      payloadPreflightResults: [
        { collection: "users", ok: true },
        { collection: "blog_posts", ok: true },
      ],
      paymentEventsResult: {
        items: [
          {
            id: "event-1",
            payment_id: "payment-1",
            event_type: "isbank_callback_failed",
            provider: "isbank",
            created_at: "2026-05-08T08:15:00.000Z",
          },
        ],
      },
    }),
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.data.chatwoot.status, "ready");
  assert.equal(body.data.inngest.status, "ready");
  assert.equal(body.data.supabaseDatabase.status, "ready");
  assert.equal(body.data.payload.status, "ready");
  assert.equal(body.data.storage.status, "ready");
  assert.equal(body.data.payment.status, "ready");
  assert.equal(body.data.payment.lastCallbackAt, "2026-05-08T08:15:00.000Z");
  assert.deepEqual(body.data.payment.lastEvent, {
    eventType: "isbank_callback_failed",
    provider: "isbank",
    createdAt: "2026-05-08T08:15:00.000Z",
  });
  assert.deepEqual(body.data.chatwoot.missing, []);
  assert.deepEqual(body.data.inngest.missing, []);
});

test("GET never leaks secret or identifier values", async (t) => {
  setupSystemEnv(t, {
    CHATWOOT_BASE_URL: "https://secret-chat.example.com",
    CHATWOOT_INBOX_IDENTIFIER: "secret-inbox-id",
    CHATWOOT_HMAC_TOKEN: "secret-hmac-token",
    CHATWOOT_ACCOUNT_ID: "secret-account-id",
    INNGEST_EVENT_KEY: "secret-event-key",
    INNGEST_SIGNING_KEY: "secret-signing-key",
    DATABASE_URI: "postgres://secret-db@example.com/payload",
    PAYLOAD_SECRET: "secret-payload-key",
    NEXT_PUBLIC_SUPABASE_URL: "https://secret-project.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "secret-publishable-key",
    SUPABASE_SERVICE_ROLE_KEY: "secret-service-role-key",
    ISBANK_CLIENT_ID: "secret-client-id",
    ISBANK_STORE_KEY: "secret-store-key",
  });

  const response = await handleAdminSystemGet(
    new Request("http://localhost:3000/api/admin/system", { method: "GET" }),
    createDeps({
      payloadPreflightResults: [{ collection: "users", ok: true }],
      paymentEventsResult: {
        items: [
          {
            id: "event-secret",
            payment_id: "payment-secret",
            event_type: "isbank_callback_failed",
            provider: "isbank",
            created_at: "2026-05-08T08:15:00.000Z",
          },
        ],
      },
    }),
  );

  assert.equal(response.status, 200);
  const serialized = JSON.stringify(await response.json());
  assert.doesNotMatch(serialized, /secret-chat\.example\.com/);
  assert.doesNotMatch(serialized, /secret-inbox-id/);
  assert.doesNotMatch(serialized, /secret-hmac-token/);
  assert.doesNotMatch(serialized, /secret-account-id/);
  assert.doesNotMatch(serialized, /secret-event-key/);
  assert.doesNotMatch(serialized, /secret-signing-key/);
  assert.doesNotMatch(serialized, /secret-db/);
  assert.doesNotMatch(serialized, /secret-payload-key/);
  assert.doesNotMatch(serialized, /secret-project/);
  assert.doesNotMatch(serialized, /secret-publishable-key/);
  assert.doesNotMatch(serialized, /secret-service-role-key/);
  assert.doesNotMatch(serialized, /secret-client-id/);
  assert.doesNotMatch(serialized, /secret-store-key/);
  assert.doesNotMatch(serialized, /event-secret/);
  assert.doesNotMatch(serialized, /payment-secret/);
});

test("GET reports expanded readiness failures without failing the whole health response", async (t) => {
  setupSystemEnv(t, {
    CHATWOOT_BASE_URL: "not-a-url",
    CHATWOOT_INBOX_IDENTIFIER: "public-inbox-id",
    CHATWOOT_HMAC_TOKEN: "super-secret-chatwoot-token",
    CHATWOOT_ACCOUNT_ID: "42",
    INNGEST_EVENT_KEY: "event-key-secret",
    INNGEST_SIGNING_KEY: "signing-key-secret",
    DATABASE_URI: undefined,
    PAYLOAD_SECRET: "payload-secret",
    NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined,
    SUPABASE_SERVICE_ROLE_KEY: undefined,
    ISBANK_CLIENT_ID: "7000679",
    ISBANK_STORE_KEY: undefined,
  });

  const response = await handleAdminSystemGet(
    new Request("http://localhost:3000/api/admin/system", { method: "GET" }),
    createDeps({
      dbProbeError: { message: "relation missing" },
      storageBucketError: { message: "bucket not found" },
      payloadPreflightResults: [
        { collection: "users", ok: true },
        { collection: "blog_posts", ok: false, message: "relation missing" },
      ],
      paymentEventsError: { message: "rpc unavailable" },
    }),
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.data.chatwoot.status, "invalid");
  assert.deepEqual(body.data.chatwoot.invalid, ["CHATWOOT_BASE_URL"]);
  assert.equal(body.data.supabaseDatabase.status, "degraded");
  assert.equal(body.data.payload.status, "degraded");
  assert.equal(body.data.storage.status, "missing");
  assert.deepEqual(body.data.storage.missing, ["content-media"]);
  assert.equal(body.data.payment.status, "invalid");
  assert.deepEqual(body.data.payment.missing, [
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "ISBANK_STORE_KEY",
  ]);
  assert.deepEqual(body.data.payment.invalid, ["NEXT_PUBLIC_SUPABASE_URL"]);
  assert.equal(body.data.payment.lastCallbackAt, null);
  assert.equal(body.data.payment.lastEvent.status, "degraded");
});

test("GET fails closed in production when critical payment config is missing", async (t) => {
  setupSystemEnv(t, {
    NODE_ENV: "production",
    CHATWOOT_BASE_URL: "https://chat.example.com",
    CHATWOOT_INBOX_IDENTIFIER: "public-inbox-id",
    CHATWOOT_HMAC_TOKEN: "super-secret-chatwoot-token",
    CHATWOOT_ACCOUNT_ID: "42",
    INNGEST_EVENT_KEY: "event-key-secret",
    INNGEST_SIGNING_KEY: "signing-key-secret",
    DATABASE_URI: "postgres://payload-secret@example.com/payload",
    PAYLOAD_SECRET: "payload-secret",
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
    SUPABASE_SERVICE_ROLE_KEY: undefined,
    ISBANK_CLIENT_ID: "7000679",
    ISBANK_STORE_KEY: "isbank-store-secret",
  });

  const response = await handleAdminSystemGet(
    new Request("http://localhost:3000/api/admin/system", { method: "GET" }),
    createDeps({}),
  );

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "System health production configuration is incomplete",
  });
});

test("GET reports missing Chatwoot account id without crashing", async (t) => {
  setupSystemEnv(t, {
    CHATWOOT_BASE_URL: "https://chat.example.com",
    CHATWOOT_INBOX_IDENTIFIER: "public-inbox-id",
    CHATWOOT_HMAC_TOKEN: "super-secret-chatwoot-token",
    CHATWOOT_ACCOUNT_ID: undefined,
    INNGEST_EVENT_KEY: "event-key-secret",
    INNGEST_SIGNING_KEY: "signing-key-secret",
  });

  const response = await handleAdminSystemGet(
    new Request("http://localhost:3000/api/admin/system", { method: "GET" }),
    createDeps({}),
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.data.chatwoot.status, "missing");
  assert.deepEqual(body.data.chatwoot.missing, ["CHATWOOT_ACCOUNT_ID"]);
  assert.equal(body.data.inngest.status, "ready");
});

test("GET reports missing Inngest keys", async (t) => {
  setupSystemEnv(t, {
    CHATWOOT_BASE_URL: "https://chat.example.com",
    CHATWOOT_INBOX_IDENTIFIER: "public-inbox-id",
    CHATWOOT_HMAC_TOKEN: "super-secret-chatwoot-token",
    CHATWOOT_ACCOUNT_ID: "42",
    INNGEST_EVENT_KEY: undefined,
    INNGEST_SIGNING_KEY: undefined,
  });

  const response = await handleAdminSystemGet(
    new Request("http://localhost:3000/api/admin/system", { method: "GET" }),
    createDeps({}),
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.data.chatwoot.status, "ready");
  assert.equal(body.data.inngest.status, "missing");
  assert.deepEqual(body.data.inngest.missing, [
    "INNGEST_EVENT_KEY",
    "INNGEST_SIGNING_KEY",
  ]);
});

type EnvPatch = {
  NODE_ENV?: string;
  CHATWOOT_BASE_URL?: string;
  CHATWOOT_INBOX_IDENTIFIER?: string;
  CHATWOOT_HMAC_TOKEN?: string;
  CHATWOOT_ACCOUNT_ID?: string;
  INNGEST_EVENT_KEY?: string;
  INNGEST_SIGNING_KEY?: string;
  DATABASE_URI?: string;
  PAYLOAD_SECRET?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  ISBANK_CLIENT_ID?: string;
  ISBANK_STORE_KEY?: string;
};

function setupSystemEnv(t: TestContext, patch: EnvPatch): void {
  const keys = Object.keys(patch) as Array<keyof EnvPatch>;
  const previous = new Map<string, string | undefined>();

  for (const key of keys) {
    previous.set(key, process.env[key]);
    const value = patch[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  t.after(() => {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });
}

type DepsOptions = {
  userId?: string | null;
  profileRole?: string | null;
  profileError?: { code?: string | null; message?: string | null } | null;
  dbProbeError?: { code?: string | null; message?: string | null } | null;
  storageBucketError?: { code?: string | null; message?: string | null } | null;
  payloadPreflightResults?: Array<{ collection: string; ok: boolean; message?: string }>;
  paymentEventsResult?: unknown;
  paymentEventsError?: { code?: string | null; message?: string | null } | null;
};

function createDeps(options: DepsOptions): AdminSystemRouteDependencies {
  return {
    runPayloadPreflight: async () => options.payloadPreflightResults ?? [],
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
            select: (columns: string) => {
              if (columns === "role") {
                return {
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: options.profileError
                        ? null
                        : { role: options.profileRole ?? "admin" },
                      error: options.profileError ?? null,
                    }),
                  }),
                };
              }

              return {
                limit: async () => ({
                  data: options.dbProbeError ? null : [],
                  error: options.dbProbeError ?? null,
                }),
              };
            },
          };
        }

        if (table !== "profiles") {
          throw new Error(`unexpected table: ${table}`);
        }
      },
      storage: {
        getBucket: async (bucket: string) => {
          assert.equal(bucket, "content-media");
          return {
            data: options.storageBucketError ? null : { id: bucket, name: bucket },
            error: options.storageBucketError ?? null,
          };
        },
      },
      rpc: async (name: string) => {
        assert.equal(name, "list_admin_payment_events");
        return {
          data: options.paymentEventsResult ?? { items: [] },
          error: options.paymentEventsError ?? null,
        };
      },
    }),
  };
}
