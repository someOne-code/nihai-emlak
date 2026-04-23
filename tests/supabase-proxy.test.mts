import assert from "node:assert/strict";
import test from "node:test";

import { resolveSupabaseProxyEnvMode } from "../lib/utils.ts";

test("Supabase proxy env mode fails closed in production when auth env is missing", () => {
  const result = resolveSupabaseProxyEnvMode({
    nodeEnv: "production",
    supabaseUrl: undefined,
    supabasePublishableKey: undefined,
  });

  assert.deepEqual(result, {
    ok: false,
    error: "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be configured outside development/test",
  });
});

test("Supabase proxy env mode skips auth refresh only in development/test when env is missing", () => {
  const developmentResult = resolveSupabaseProxyEnvMode({
    nodeEnv: "development",
    supabaseUrl: undefined,
    supabasePublishableKey: undefined,
  });
  const testResult = resolveSupabaseProxyEnvMode({
    nodeEnv: "test",
    supabaseUrl: undefined,
    supabasePublishableKey: undefined,
  });

  assert.deepEqual(developmentResult, { ok: true, shouldBypassProxyAuth: true });
  assert.deepEqual(testResult, { ok: true, shouldBypassProxyAuth: true });
});

test("Supabase proxy env mode enables auth refresh when both env vars are configured", () => {
  const result = resolveSupabaseProxyEnvMode({
    nodeEnv: "production",
    supabaseUrl: "https://project.supabase.co",
    supabasePublishableKey: "pk-test",
  });

  assert.deepEqual(result, { ok: true, shouldBypassProxyAuth: false });
});
