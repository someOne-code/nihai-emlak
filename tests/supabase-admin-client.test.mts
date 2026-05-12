import assert from "node:assert/strict";
import test from "node:test";

import { resolveAdminServiceRoleKeyForTest } from "../lib/supabase/admin.ts";

const SERVICE_ROLE_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature";
const ANON_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.signature";

test("admin Supabase client ignores malformed inherited service-role env in local development", () => {
  const key = resolveAdminServiceRoleKeyForTest(
    {
      NODE_ENV: "development",
      SUPABASE_SERVICE_ROLE_KEY: "...",
    },
    () => `SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_JWT}`,
  );

  assert.equal(key, SERVICE_ROLE_JWT);
});

test("admin Supabase client fails closed for malformed service-role env in production", () => {
  const key = resolveAdminServiceRoleKeyForTest(
    {
      NODE_ENV: "production",
      SUPABASE_SERVICE_ROLE_KEY: "...",
    },
    () => `SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_JWT}`,
  );

  assert.equal(key, null);
});

test("admin Supabase client rejects anon JWTs for service-role use", () => {
  const key = resolveAdminServiceRoleKeyForTest(
    {
      NODE_ENV: "development",
      SUPABASE_SERVICE_ROLE_KEY: ANON_JWT,
    },
    () => "",
  );

  assert.equal(key, null);
});
