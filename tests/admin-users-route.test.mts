import assert from "node:assert/strict";
import test from "node:test";
import type { TestContext } from "node:test";

import {
  handleAdminUsersGet,
  handleAdminUsersInvitePost,
  type AdminUsersRouteDependencies,
} from "../lib/admin/users-route.ts";

const ADMIN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const INVITED_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function setupAdminUsersEnv(t: TestContext): void {
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

process.env.NODE_ENV = "test";

test("admin users list rejects unauthenticated requests", async () => {
  const response = await handleAdminUsersGet(
    createRequest("/api/admin/users"),
    createDependencies({ userId: null }),
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Authentication required",
  });
});

test("admin users list rejects non-admin requests", async () => {
  const response = await handleAdminUsersGet(
    createRequest("/api/admin/users"),
    createDependencies({ profileRole: "user" }),
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Admin role required",
  });
});

test("admin users list returns sanitized admin profiles", async () => {
  const response = await handleAdminUsersGet(
    createRequest("/api/admin/users"),
    createDependencies({
      adminProfiles: [
        {
          id: ADMIN_ID,
          email: "owner@example.com",
          role: "admin",
          created_at: "2026-05-01T10:00:00.000Z",
          phone: "+90",
        },
      ],
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    success: true,
    data: {
      items: [
        {
          id: ADMIN_ID,
          email: "owner@example.com",
          role: "admin",
          createdAt: "2026-05-01T10:00:00.000Z",
        },
      ],
    },
  });
});

test("admin invite rejects invalid email before Supabase Admin API", async () => {
  let inviteCalls = 0;
  const response = await handleAdminUsersInvitePost(
    createRequest("/api/admin/users/invite", {
      method: "POST",
      body: JSON.stringify({ email: "bad-email" }),
    }),
    createDependencies({
      inviteUserByEmail: async () => {
        inviteCalls += 1;
        return { data: { user: { id: INVITED_ID, email: "bad-email" } }, error: null };
      },
    }),
  );

  assert.equal(response.status, 400);
  assert.equal(inviteCalls, 0);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Valid email is required",
  });
});

test("admin invite rejects untrusted origins before auth", async (t) => {
  setupAdminUsersEnv(t);
  const response = await handleAdminUsersInvitePost(
    createRequest("/api/admin/users/invite", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://evil.example",
      },
      body: JSON.stringify({ email: "new-admin@example.com" }),
    }),
    {
      createServerSupabaseClient: async () => {
        throw new Error("auth should not run for untrusted origins");
      },
      createAdminSupabaseClient: () => {
        throw new Error("admin service should not run for untrusted origins");
      },
    },
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Admin users Origin is not trusted",
  });
});

test("admin invite rejects non-admin before Supabase Admin API", async () => {
  let inviteCalls = 0;
  const response = await handleAdminUsersInvitePost(
    createRequest("/api/admin/users/invite", {
      method: "POST",
      body: JSON.stringify({ email: "new-admin@example.com" }),
    }),
    createDependencies({
      profileRole: "user",
      inviteUserByEmail: async () => {
        inviteCalls += 1;
        return { data: { user: { id: INVITED_ID, email: "new-admin@example.com" } }, error: null };
      },
    }),
  );

  assert.equal(response.status, 403);
  assert.equal(inviteCalls, 0);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Admin role required",
  });
});

test("admin invite fails closed when service role client is unavailable", async () => {
  const response = await handleAdminUsersInvitePost(
    createRequest("/api/admin/users/invite", {
      method: "POST",
      body: JSON.stringify({ email: "new-admin@example.com" }),
    }),
    createDependencies({
      createAdminSupabaseClient: () => null,
    }),
  );

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Admin invite service is unavailable",
  });
});

test("admin invite fails closed in production when site URL is missing", async () => {
  const response = await handleAdminUsersInvitePost(
    createRequest("/api/admin/users/invite", {
      method: "POST",
      body: JSON.stringify({ email: "new-admin@example.com" }),
    }),
    createDependencies({
      siteUrl: null,
      nodeEnv: "production",
    }),
  );

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Admin invite service is unavailable",
  });
});

test("admin invite sends Supabase email invite and upgrades profile to admin", async () => {
  const calls: Array<unknown> = [];
  const response = await handleAdminUsersInvitePost(
    createRequest("/api/admin/users/invite", {
      method: "POST",
      body: JSON.stringify({ email: "New-Admin@Example.com" }),
    }),
    createDependencies({
      inviteUserByEmail: async (email, options) => {
        calls.push({ kind: "invite", email, options });
        return {
          data: { user: { id: INVITED_ID, email: "new-admin@example.com" } },
          error: null,
        };
      },
      upsertProfile: async (row) => {
        calls.push({ kind: "upsert", row });
        return { error: null };
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [
    {
      kind: "invite",
      email: "new-admin@example.com",
      options: {
        redirectTo: "http://localhost:3000/auth/update-password?redirect=%2Fadmin",
      },
    },
    {
      kind: "upsert",
      row: {
        id: INVITED_ID,
        email: "new-admin@example.com",
        role: "admin",
      },
    },
  ]);
  assert.deepEqual(await response.json(), {
    success: true,
    data: {
      email: "new-admin@example.com",
      role: "admin",
    },
  });
});

test("admin invite maps Supabase failures to safe generic errors", async () => {
  const response = await handleAdminUsersInvitePost(
    createRequest("/api/admin/users/invite", {
      method: "POST",
      body: JSON.stringify({ email: "new-admin@example.com" }),
    }),
    createDependencies({
      inviteUserByEmail: async () => ({
        data: { user: null },
        error: { message: "SMTP secret leaked" },
      }),
    }),
  );

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Admin invite failed",
  });
});

function createRequest(path: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  if (init.method === "POST") {
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    if (!headers.has("origin")) {
      headers.set("origin", "http://localhost:3000");
    }
  }

  return new Request(`http://localhost:3000${path}`, {
    ...init,
    headers,
  });
}

function createDependencies(options: {
  userId?: string | null;
  profileRole?: string | null;
  profileError?: { code?: string | null; message?: string | null } | null;
  adminProfiles?: Array<Record<string, unknown>>;
  siteUrl?: string | null;
  nodeEnv?: string;
  createAdminSupabaseClient?: () => unknown | null;
  inviteUserByEmail?: (
    email: string,
    options: { redirectTo: string },
  ) => Promise<{
    data: { user: { id: string; email?: string | null } | null };
    error: { message?: string | null } | null;
  }>;
  upsertProfile?: (
    row: { id: string; email: string; role: "admin" },
  ) => Promise<{ error: { message?: string | null } | null }>;
}): AdminUsersRouteDependencies {
  const adminClient = {
    auth: {
      admin: {
        inviteUserByEmail:
          options.inviteUserByEmail ??
          (async () => ({
            data: { user: { id: INVITED_ID, email: "new-admin@example.com" } },
            error: null,
          })),
      },
    },
    from: () => ({
      upsert: async (row: { id: string; email: string; role: "admin" }) =>
        options.upsertProfile
          ? options.upsertProfile(row)
          : { error: null },
    }),
  };

  return {
    siteUrl: options.siteUrl === undefined ? "http://localhost:3000" : options.siteUrl,
    nodeEnv: options.nodeEnv,
    createServerSupabaseClient: async () => ({
      auth: {
        getUser: async () => ({
          data: {
            user: options.userId === null ? null : { id: options.userId ?? ADMIN_ID },
          },
          error: null,
        }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: options.profileError
                ? null
                : { role: options.profileRole ?? "admin" },
              error: options.profileError ?? null,
            }),
            order: async () => ({
              data: options.adminProfiles ?? [],
              error: null,
            }),
          }),
        }),
      }),
    }),
    createAdminSupabaseClient:
      options.createAdminSupabaseClient ?? (() => adminClient),
  };
}
