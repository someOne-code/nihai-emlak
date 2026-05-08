import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import test from "node:test";

import {
  handleAdminCatalogMainItemGet,
  handleAdminCatalogMainItemPost,
  handleAdminCatalogMainItemPatch,
  handleAdminCatalogServiceGet,
  handleAdminCatalogServicePost,
  handleAdminCatalogServicePatch,
} from "../lib/admin/catalog-route.ts";
import type {
  AdminListingsRouteDependencies,
  AdminListingsRpcName,
  AdminListingsRpcResponse,
  AdminListingsSupabaseError,
} from "../lib/admin/listings-shared.ts";

const ADMIN_ID = "aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb800";

type RpcCall = {
  functionName: AdminListingsRpcName;
  args: Record<string, unknown>;
};

type DependencyOptions = {
  userId?: string | null;
  profileError?: AdminListingsSupabaseError | null;
  profileRole?: string | null;
  rpc?: (
    functionName: AdminListingsRpcName,
    args: Record<string, unknown>,
  ) => AdminListingsRpcResponse | Promise<AdminListingsRpcResponse>;
};

// ---------------------------------------------------------------------------
// GET /api/admin/catalog/main-items
// ---------------------------------------------------------------------------

test("catalog main items GET rejects non-admin", async (t) => {
  setupCatalogEnv(t);

  const response = await handleAdminCatalogMainItemGet(
    new Request("http://localhost:3000/api/admin/catalog/main-items", {
      method: "GET",
      headers: { origin: "http://localhost:3000" },
    }),
    createDependencies({ profileRole: "viewer", rpc: () => failRpc("admin_list_main_item_catalog") }),
  );

  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "Admin role required");
});

test("catalog main items GET calls admin_list_main_item_catalog and returns 200", async (t) => {
  setupCatalogEnv(t);
  const calls: RpcCall[] = [];
  const rows = [{ id: "1", code: "kira", label: "Kira", is_active: true }];

  const response = await handleAdminCatalogMainItemGet(
    new Request("http://localhost:3000/api/admin/catalog/main-items", {
      method: "GET",
      headers: { origin: "http://localhost:3000" },
    }),
    createDependencies({
      rpc: (fn, args) => {
        calls.push({ functionName: fn, args });
        return { data: rows, error: null };
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(calls[0].functionName, "admin_list_main_item_catalog");
  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.deepEqual(payload.data, rows);
});

// ---------------------------------------------------------------------------
// POST /api/admin/catalog/main-items
// ---------------------------------------------------------------------------

test("catalog main items POST rejects non-json before auth", async (t) => {
  setupCatalogEnv(t);

  const response = await handleAdminCatalogMainItemPost(
    new Request("http://localhost:3000/api/admin/catalog/main-items", {
      method: "POST",
      headers: { "content-type": "text/plain", origin: "http://localhost:3000" },
      body: "{}",
    }),
    createDependencies({ rpc: () => failRpc("admin_create_main_item_catalog") }),
  );

  assert.equal(response.status, 415);
  assert.ok((await response.json()).error.includes("application/json"));
});

test("catalog main items POST rejects untrusted origin before auth", async (t) => {
  setupCatalogEnv(t);

  const response = await handleAdminCatalogMainItemPost(
    createJsonRequest({
      path: "/api/admin/catalog/main-items",
      method: "POST",
      body: validMainItemCreateBody(),
      origin: "https://evil.example",
    }),
    createDependencies({ rpc: () => failRpc("admin_create_main_item_catalog") }),
  );

  assert.equal(response.status, 403);
  assert.ok((await response.json()).error.includes("not trusted"));
});

test("catalog main items POST rejects non-admin", async (t) => {
  setupCatalogEnv(t);

  const response = await handleAdminCatalogMainItemPost(
    createJsonRequest({
      path: "/api/admin/catalog/main-items",
      method: "POST",
      body: validMainItemCreateBody(),
    }),
    createDependencies({
      profileRole: "viewer",
      rpc: () => failRpc("admin_create_main_item_catalog"),
    }),
  );

  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "Admin role required");
});

test("catalog main items POST rejects negative default_amount", async (t) => {
  setupCatalogEnv(t);

  const response = await handleAdminCatalogMainItemPost(
    createJsonRequest({
      path: "/api/admin/catalog/main-items",
      method: "POST",
      body: { ...validMainItemCreateBody(), default_amount: -100 },
    }),
    createDependencies({ rpc: () => failRpc("admin_create_main_item_catalog") }),
  );

  assert.equal(response.status, 400);
  assert.ok((await response.json()).error.includes("negatif"));
});

test("catalog main items POST calls admin_create_main_item_catalog and returns 201", async (t) => {
  setupCatalogEnv(t);
  const calls: RpcCall[] = [];
  const body = validMainItemCreateBody();
  const result = { id: "1", code: "kira", label: "Kira", is_active: true };

  const response = await handleAdminCatalogMainItemPost(
    createJsonRequest({
      path: "/api/admin/catalog/main-items",
      method: "POST",
      body,
    }),
    createDependencies({
      rpc: (fn, args) => {
        calls.push({ functionName: fn, args });
        return { data: result, error: null };
      },
    }),
  );

  assert.equal(response.status, 201);
  assert.equal(calls[0].functionName, "admin_create_main_item_catalog");
  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.deepEqual(payload.data, result);
});

test("catalog main items POST maps duplicate visible labels to 409", async (t) => {
  setupCatalogEnv(t);

  const response = await handleAdminCatalogMainItemPost(
    createJsonRequest({
      path: "/api/admin/catalog/main-items",
      method: "POST",
      body: validMainItemCreateBody(),
    }),
    createDependencies({
      rpc: () => ({
        data: null,
        error: {
          code: "23505",
          message: "active main item label already exists",
        },
      }),
    }),
  );

  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "Ana ödeme kalemi etiketi zaten kullanılıyor");
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/catalog/main-items/:code
// ---------------------------------------------------------------------------

test("catalog main items PATCH rejects empty code", async (t) => {
  setupCatalogEnv(t);

  const response = await handleAdminCatalogMainItemPatch(
    createJsonRequest({ path: "/api/admin/catalog/main-items/", method: "PATCH", body: {} }),
    createDependencies({ rpc: () => failRpc("admin_update_main_item_catalog") }),
    { code: "  " },
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Invalid catalog item code");
});

test("catalog main items PATCH rejects negative default_amount", async (t) => {
  setupCatalogEnv(t);

  const response = await handleAdminCatalogMainItemPatch(
    createJsonRequest({
      path: "/api/admin/catalog/main-items/kira",
      method: "PATCH",
      body: { default_amount: -50 },
    }),
    createDependencies({ rpc: () => failRpc("admin_update_main_item_catalog") }),
    { code: "kira" },
  );

  assert.equal(response.status, 400);
  assert.ok((await response.json()).error.includes("negatif"));
});

test("catalog main items PATCH calls admin_update_main_item_catalog and returns 200", async (t) => {
  setupCatalogEnv(t);
  const calls: RpcCall[] = [];
  const body = { is_active: false };
  const result = { id: "1", code: "kira", label: "Kira", is_active: false };

  const response = await handleAdminCatalogMainItemPatch(
    createJsonRequest({ path: "/api/admin/catalog/main-items/kira", method: "PATCH", body }),
    createDependencies({
      rpc: (fn, args) => {
        calls.push({ functionName: fn, args });
        return { data: result, error: null };
      },
    }),
    { code: "kira" },
  );

  assert.equal(response.status, 200);
  assert.equal(calls[0].functionName, "admin_update_main_item_catalog");
  assert.equal((calls[0].args as Record<string, unknown>).p_code, "kira");
  const payload = await response.json();
  assert.equal(payload.success, true);
});

// ---------------------------------------------------------------------------
// GET /api/admin/catalog/services
// ---------------------------------------------------------------------------

test("catalog services GET rejects non-admin", async (t) => {
  setupCatalogEnv(t);

  const response = await handleAdminCatalogServiceGet(
    new Request("http://localhost:3000/api/admin/catalog/services", {
      method: "GET",
      headers: { origin: "http://localhost:3000" },
    }),
    createDependencies({ profileRole: "viewer", rpc: () => failRpc("admin_list_service_catalog") }),
  );

  assert.equal(response.status, 403);
});

test("catalog services GET calls admin_list_service_catalog and returns 200", async (t) => {
  setupCatalogEnv(t);
  const calls: RpcCall[] = [];
  const rows = [{ id: "1", code: "temizlik", name: "Temizlik", is_active: true }];

  const response = await handleAdminCatalogServiceGet(
    new Request("http://localhost:3000/api/admin/catalog/services", {
      method: "GET",
      headers: { origin: "http://localhost:3000" },
    }),
    createDependencies({
      rpc: (fn, args) => {
        calls.push({ functionName: fn, args });
        return { data: rows, error: null };
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(calls[0].functionName, "admin_list_service_catalog");
  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.deepEqual(payload.data, rows);
});

// ---------------------------------------------------------------------------
// POST /api/admin/catalog/services
// ---------------------------------------------------------------------------

test("catalog services POST rejects non-admin", async (t) => {
  setupCatalogEnv(t);

  const response = await handleAdminCatalogServicePost(
    createJsonRequest({
      path: "/api/admin/catalog/services",
      method: "POST",
      body: validServiceCreateBody(),
    }),
    createDependencies({
      profileRole: "viewer",
      rpc: () => failRpc("admin_create_service_catalog"),
    }),
  );

  assert.equal(response.status, 403);
});

test("catalog services POST rejects negative base_price", async (t) => {
  setupCatalogEnv(t);

  const response = await handleAdminCatalogServicePost(
    createJsonRequest({
      path: "/api/admin/catalog/services",
      method: "POST",
      body: { ...validServiceCreateBody(), base_price: -1 },
    }),
    createDependencies({ rpc: () => failRpc("admin_create_service_catalog") }),
  );

  assert.equal(response.status, 400);
  assert.ok((await response.json()).error.includes("negatif"));
});

test("catalog services POST calls admin_create_service_catalog and returns 201", async (t) => {
  setupCatalogEnv(t);
  const calls: RpcCall[] = [];
  const body = validServiceCreateBody();
  const result = { id: "2", code: "temizlik", name: "Temizlik", is_active: true };

  const response = await handleAdminCatalogServicePost(
    createJsonRequest({
      path: "/api/admin/catalog/services",
      method: "POST",
      body,
    }),
    createDependencies({
      rpc: (fn, args) => {
        calls.push({ functionName: fn, args });
        return { data: result, error: null };
      },
    }),
  );

  assert.equal(response.status, 201);
  assert.equal(calls[0].functionName, "admin_create_service_catalog");
  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.deepEqual(payload.data, result);
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/catalog/services/:code
// ---------------------------------------------------------------------------

test("catalog services PATCH rejects empty code", async (t) => {
  setupCatalogEnv(t);

  const response = await handleAdminCatalogServicePatch(
    createJsonRequest({ path: "/api/admin/catalog/services/", method: "PATCH", body: {} }),
    createDependencies({ rpc: () => failRpc("admin_update_service_catalog") }),
    { code: "" },
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Invalid catalog item code");
});

test("catalog services PATCH calls admin_update_service_catalog and returns 200", async (t) => {
  setupCatalogEnv(t);
  const calls: RpcCall[] = [];
  const body = { is_active: false };
  const result = { id: "1", code: "temizlik", name: "Temizlik", is_active: false };

  const response = await handleAdminCatalogServicePatch(
    createJsonRequest({ path: "/api/admin/catalog/services/temizlik", method: "PATCH", body }),
    createDependencies({
      rpc: (fn, args) => {
        calls.push({ functionName: fn, args });
        return { data: result, error: null };
      },
    }),
    { code: "temizlik" },
  );

  assert.equal(response.status, 200);
  assert.equal(calls[0].functionName, "admin_update_service_catalog");
  assert.equal((calls[0].args as Record<string, unknown>).p_code, "temizlik");
  const payload = await response.json();
  assert.equal(payload.success, true);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validMainItemCreateBody(): Record<string, unknown> {
  return {
    code: "kira",
    label: "Kira",
    pricing_strategy: "fixed",
    default_amount: 12000,
    is_active: true,
    sort_order: 0,
  };
}

function validServiceCreateBody(): Record<string, unknown> {
  return {
    code: "temizlik",
    name: "Temizlik",
    base_price: 500,
    is_active: true,
  };
}

function createJsonRequest(options: {
  path: string;
  method: "POST" | "PATCH" | "GET";
  body?: unknown;
  origin?: string;
}): Request {
  return new Request(`http://localhost:3000${options.path}`, {
    method: options.method,
    headers: {
      "content-type": "application/json",
      origin: options.origin ?? "http://localhost:3000",
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

function failRpc(functionName: AdminListingsRpcName): never {
  throw new Error(`rpc ${functionName} should not run for this test`);
}

function createDependencies(options: DependencyOptions): AdminListingsRouteDependencies {
  return {
    createServerSupabaseClient: async () => ({
      auth: {
        getUser: async () => ({
          data: {
            user: options.userId === null ? null : { id: options.userId ?? ADMIN_ID },
          },
          error: null,
        }),
      },
      from: (table: "profiles") => {
        if (table !== "profiles") {
          throw new Error(`unexpected from(${table})`);
        }
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
      },
      rpc: async (
        functionName: AdminListingsRpcName,
        args: Record<string, unknown>,
      ) => {
        if (!options.rpc) {
          throw new Error("rpc dependency was not configured for this test");
        }
        return await options.rpc(functionName, args);
      },
    }),
  };
}

function setupCatalogEnv(t: TestContext): void {
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
