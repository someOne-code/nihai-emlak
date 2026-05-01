import assert from "node:assert/strict";
import test from "node:test";

import { resolveListingsAdminAccess } from "../lib/admin-ui/listings-admin-access.ts";

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

test("listings admin access redirects to login when no user session is present", async () => {
  const result = await resolveListingsAdminAccess({
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
    "/auth/login?redirect=" + encodeURIComponent("/admin/listings"),
  );
});

test("listings admin access redirects to error when profile lookup fails", async () => {
  const result = await resolveListingsAdminAccess({
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

test("listings admin access redirects to error when role is not admin", async () => {
  const result = await resolveListingsAdminAccess({
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

test("listings admin access succeeds when role is admin", async () => {
  const result = await resolveListingsAdminAccess({
    createServerSupabaseClient: async () =>
      createSupabaseStub({
        getUser: { data: { user: { id: "user-1" } }, error: null },
        profile: { data: { role: "admin" }, error: null },
      }),
  });

  assert.equal(result.ok, true);
});
