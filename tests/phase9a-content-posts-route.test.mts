import assert from "node:assert/strict";
import test from "node:test";

import { guardContentAdminRequest } from "../lib/admin/content-shared.ts";

// ── Guard stubs ────────────────────────────────────────────────────────────

type ProfileSelectStub = {
  data: { role?: unknown } | null;
  error: { code?: string | null; message?: string | null } | null;
};

type AuthGetUserStub = {
  data: { user: { id: string } | null };
  error: { code?: string | null; message?: string | null } | null;
};

function createSupabaseStub(input: {
  getUser: AuthGetUserStub;
  profile: ProfileSelectStub;
}) {
  return {
    auth: {
      getUser: async () => input.getUser,
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => input.profile,
        }),
      }),
    }),
  } as const;
}

// ── Guard tests ────────────────────────────────────────────────────────────

test("content admin guard returns 401 when no user session", async () => {
  const result = await guardContentAdminRequest({
    createServerSupabaseClient: async () =>
      createSupabaseStub({
        getUser: { data: { user: null }, error: null },
        profile: { data: null, error: null },
      }),
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.response.status, 401);
    const body = await result.response.json();
    assert.equal(body.error, "Authentication required");
  }
});

test("content admin guard returns 403 when role is not admin", async () => {
  const result = await guardContentAdminRequest({
    createServerSupabaseClient: async () =>
      createSupabaseStub({
        getUser: { data: { user: { id: "user-1" } }, error: null },
        profile: { data: { role: "user" }, error: null },
      }),
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.response.status, 403);
    const body = await result.response.json();
    assert.equal(body.error, "Admin role required");
  }
});

test("content admin guard succeeds when role is admin", async () => {
  const result = await guardContentAdminRequest({
    createServerSupabaseClient: async () =>
      createSupabaseStub({
        getUser: { data: { user: { id: "user-1" } }, error: null },
        profile: { data: { role: "admin" }, error: null },
      }),
  });

  assert.equal(result.ok, true);
});

test("content admin guard returns 500 when profile lookup fails", async () => {
  const result = await guardContentAdminRequest({
    createServerSupabaseClient: async () =>
      createSupabaseStub({
        getUser: { data: { user: { id: "user-1" } }, error: null },
        profile: { data: null, error: { message: "boom" } },
      }),
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.response.status, 500);
    const body = await result.response.json();
    assert.equal(body.error, "Admin profile lookup failed");
  }
});

// ── Response helper tests ──────────────────────────────────────────────────

import { jsonError, jsonResponse } from "../lib/admin/content-shared.ts";

test("jsonError returns correct status and envelope", async () => {
  const response = jsonError("Something went wrong", 422);
  assert.equal(response.status, 422);
  const body = await response.json();
  assert.equal(body.success, false);
  assert.equal(body.error, "Something went wrong");
});

test("jsonResponse includes no-store cache header", () => {
  const response = jsonResponse({ success: true, data: { id: "1" } }, 200);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
});
