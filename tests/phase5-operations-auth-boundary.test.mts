import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveOperationsAdminAccess,
  type OperationsAdminAccessDependencies,
} from "../lib/admin-ui/operations-admin-access.ts";

test("operations admin access redirects anonymous users to Supabase login with return target", async () => {
  const access = await resolveOperationsAdminAccess({
    createServerSupabaseClient: async () => createSupabaseStub({ userId: null }),
  });

  assert.deepEqual(access, {
    ok: false,
    redirectTo: "/auth/login?redirect=%2Fadmin%2Foperations",
  });
});

test("operations admin access rejects authenticated non-admin Supabase profiles", async () => {
  const access = await resolveOperationsAdminAccess({
    createServerSupabaseClient: async () =>
      createSupabaseStub({
        profileRole: "customer",
        userId: "user-1",
      }),
  });

  assert.deepEqual(access, {
    ok: false,
    redirectTo: "/auth/error?error=Admin%20role%20required",
  });
});

test("operations admin access allows only Supabase profiles with admin role", async () => {
  const access = await resolveOperationsAdminAccess({
    createServerSupabaseClient: async () =>
      createSupabaseStub({
        profileRole: "admin",
        userId: "admin-1",
      }),
  });

  assert.deepEqual(access, { ok: true });
});

test("operations admin access fails closed when profile lookup errors", async () => {
  const access = await resolveOperationsAdminAccess({
    createServerSupabaseClient: async () =>
      createSupabaseStub({
        profileError: { message: "db unavailable" },
        userId: "admin-1",
      }),
  });

  assert.deepEqual(access, {
    ok: false,
    redirectTo: "/auth/error?error=Admin%20profile%20lookup%20failed",
  });
});

function createSupabaseStub(input: {
  userId: string | null;
  profileRole?: string | null;
  profileError?: { message: string } | null;
}): Awaited<ReturnType<OperationsAdminAccessDependencies["createServerSupabaseClient"]>> {
  return {
    auth: {
      getUser: async () => ({
        data: { user: input.userId ? { id: input.userId } : null },
        error: null,
      }),
    },
    from: (table: "profiles") => {
      assert.equal(table, "profiles");

      return {
        select: (columns: string) => {
          assert.equal(columns, "role");

          return {
            eq: (column: string, value: string) => {
              assert.equal(column, "id");
              assert.equal(value, input.userId);

              return {
                maybeSingle: async () => ({
                  data:
                    input.profileRole === undefined
                      ? null
                      : { role: input.profileRole },
                  error: input.profileError ?? null,
                }),
              };
            },
          };
        },
      };
    },
  };
}
