import assert from "node:assert/strict";
import test from "node:test";

import { resolveContentAdminAccess } from "../lib/admin-ui/content-admin-access.ts";

type ProfileSelectStub = {
  data: { role?: unknown } | null;
  error: { message?: string } | null;
};

type AuthGetUserStub = {
  data: { user: { id: string } | null };
  error: { message?: string } | null;
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

test("content admin access redirects to login when no user session is present", async () => {
  const result = await resolveContentAdminAccess({
    redirectPath: "/admin/content/posts",
    createServerSupabaseClient: async () =>
      createSupabaseStub({
        getUser: { data: { user: null }, error: null },
        profile: { data: null, error: null },
      }),
  });

  assert.equal(result.ok, false);
  assert.ok(!result.ok);
  assert.equal(
    result.redirectTo,
    "/auth/login?redirect=" + encodeURIComponent("/admin/content/posts"),
  );
});

test("content admin access redirects to error when profile lookup fails", async () => {
  const result = await resolveContentAdminAccess({
    redirectPath: "/admin/content/categories",
    createServerSupabaseClient: async () =>
      createSupabaseStub({
        getUser: { data: { user: { id: "user-1" } }, error: null },
        profile: { data: null, error: { message: "boom" } },
      }),
  });

  assert.equal(result.ok, false);
  assert.ok(!result.ok);
  assert.equal(
    result.redirectTo,
    "/auth/error?error=" + encodeURIComponent("Admin profile lookup failed"),
  );
});

test("content admin access redirects to error when role is not admin", async () => {
  const result = await resolveContentAdminAccess({
    redirectPath: "/admin/content/consultants",
    createServerSupabaseClient: async () =>
      createSupabaseStub({
        getUser: { data: { user: { id: "user-1" } }, error: null },
        profile: { data: { role: "user" }, error: null },
      }),
  });

  assert.equal(result.ok, false);
  assert.ok(!result.ok);
  assert.equal(
    result.redirectTo,
    "/auth/error?error=" + encodeURIComponent("Admin role required"),
  );
});

test("content admin access succeeds when role is admin", async () => {
  const result = await resolveContentAdminAccess({
    redirectPath: "/admin/content/posts",
    createServerSupabaseClient: async () =>
      createSupabaseStub({
        getUser: { data: { user: { id: "user-1" } }, error: null },
        profile: { data: { role: "admin" }, error: null },
      }),
  });

  assert.equal(result.ok, true);
});

test("content admin access falls back to /admin/content when redirect path is invalid", async () => {
  const result = await resolveContentAdminAccess({
    redirectPath: "https://evil.example.com",
    createServerSupabaseClient: async () =>
      createSupabaseStub({
        getUser: { data: { user: null }, error: null },
        profile: { data: null, error: null },
      }),
  });

  assert.equal(result.ok, false);
  assert.ok(!result.ok);
  assert.equal(
    result.redirectTo,
    "/auth/login?redirect=" + encodeURIComponent("/admin/content"),
  );
});
