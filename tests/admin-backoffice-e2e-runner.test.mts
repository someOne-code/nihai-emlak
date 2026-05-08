import assert from "node:assert/strict";
import test from "node:test";

import {
  checkAdminBackofficeE2EReadiness,
  resolveAdminBackofficeE2EConfig,
} from "../scripts/run-admin-backoffice-e2e.mts";

test("admin e2e runner resolves defaults and explicit environment", () => {
  assert.deepEqual(resolveAdminBackofficeE2EConfig({}), {
    baseUrl: "http://localhost:3000",
    adminEmail: "smoke-admin@example.test",
    adminPassword: "smoke-admin-2026",
  });

  assert.deepEqual(
    resolveAdminBackofficeE2EConfig({
      E2E_BASE_URL: " http://127.0.0.1:4000/ ",
      E2E_ADMIN_EMAIL: " admin@example.test ",
      E2E_ADMIN_PASSWORD: " secret ",
    }),
    {
      baseUrl: "http://127.0.0.1:4000",
      adminEmail: "admin@example.test",
      adminPassword: "secret",
    },
  );
});

test("admin e2e runner reports an unreachable base URL", async () => {
  const result = await checkAdminBackofficeE2EReadiness(
    { baseUrl: "http://localhost:3999", adminEmail: "admin@example.test", adminPassword: "secret" },
    async () => {
      throw new TypeError("connect ECONNREFUSED");
    },
  );

  assert.deepEqual(result, {
    ok: false,
    message: "Admin E2E base URL is not reachable: http://localhost:3999",
  });
});

test("admin e2e runner reports inaccessible login page", async () => {
  const result = await checkAdminBackofficeE2EReadiness(
    { baseUrl: "http://localhost:3000", adminEmail: "admin@example.test", adminPassword: "secret" },
    async () => new Response("not found", { status: 404 }),
  );

  assert.deepEqual(result, {
    ok: false,
    message: "Admin E2E login page is not reachable: http://localhost:3000/auth/login returned 404",
  });
});

test("admin e2e runner accepts a reachable login page", async () => {
  const result = await checkAdminBackofficeE2EReadiness(
    { baseUrl: "http://localhost:3000", adminEmail: "admin@example.test", adminPassword: "secret" },
    async () => new Response("ok", { status: 200 }),
  );

  assert.deepEqual(result, { ok: true, message: "Admin E2E readiness checks passed." });
});
