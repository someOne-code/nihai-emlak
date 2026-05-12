import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import test from "node:test";

import {
  handleAdminListingsMainItemPatch,
  handleAdminListingsServicePatch,
} from "../lib/admin/listings-pricing-route.ts";
import type {
  AdminListingsRouteDependencies,
  AdminListingsRpcName,
  AdminListingsRpcResponse,
  AdminListingsSupabaseError,
} from "../lib/admin/listings-shared.ts";

const LISTING_ID = "aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb801";
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

// ----------------------------------------------------------------------------
// 8.4 Main Item: PATCH /api/admin/listings/:listingId/main-items/:code
// ----------------------------------------------------------------------------

test("admin listings main item patch rejects non-json before auth", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsMainItemPatch(
    new Request(`http://localhost:3000/api/admin/listings/${LISTING_ID}/main-items/phase8_main`, {
      method: "PATCH",
      headers: {
        "content-type": "text/plain",
        origin: "http://localhost:3000",
      },
      body: "{}",
    }),
    createDependencies({
      rpc: () => failRpc("admin_configure_listing_main_item"),
    }),
    { listingId: LISTING_ID, code: "phase8_main" },
  );

  assert.equal(response.status, 415);
  assert.equal((await response.json()).error, "Admin listing pricing requires application/json");
});

test("admin listings main item patch rejects untrusted origin before auth", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsMainItemPatch(
    createJsonRequest({
      path: `/api/admin/listings/${LISTING_ID}/main-items/phase8_main`,
      body: validMainItemBody(),
      origin: "https://evil.example",
    }),
    createDependencies({
      rpc: () => failRpc("admin_configure_listing_main_item"),
    }),
    { listingId: LISTING_ID, code: "phase8_main" },
  );

  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "Admin listing pricing Origin is not trusted");
});

test("admin listings main item patch rejects invalid listing id before RPC", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsMainItemPatch(
    createJsonRequest({
      path: `/api/admin/listings/not-a-uuid/main-items/phase8_main`,
      body: validMainItemBody(),
    }),
    createDependencies({
      rpc: () => failRpc("admin_configure_listing_main_item"),
    }),
    { listingId: "not-a-uuid", code: "phase8_main" },
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Invalid listing id");
});

test("admin listings main item patch rejects empty code before RPC", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsMainItemPatch(
    createJsonRequest({
      path: `/api/admin/listings/${LISTING_ID}/main-items/`,
      body: validMainItemBody(),
    }),
    createDependencies({
      rpc: () => failRpc("admin_configure_listing_main_item"),
    }),
    { listingId: LISTING_ID, code: "  " },
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Invalid main item code");
});

test("admin listings main item patch rejects non-admin before RPC", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsMainItemPatch(
    createJsonRequest({
      path: `/api/admin/listings/${LISTING_ID}/main-items/phase8_main`,
      body: validMainItemBody(),
    }),
    createDependencies({
      profileRole: "viewer",
      rpc: () => failRpc("admin_configure_listing_main_item"),
    }),
    { listingId: LISTING_ID, code: "phase8_main" },
  );

  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "Admin role required");
});

test("admin listings main item patch calls admin_configure_listing_main_item and returns 200", async (t) => {
  setupAdminListingEnv(t);
  const calls: RpcCall[] = [];
  const body = validMainItemBody();
  const result = {
    id: "bbbbbbbb-cccc-4ccc-8ccc-ccccccccc801",
    listing_id: LISTING_ID,
    main_item_id: "bbbbbbbb-cccc-4ccc-8ccc-ccccccccc801",
    code: "phase8_main",
    label: "Phase 8 Main Item",
    is_enabled: true,
    sort_order: 1,
  };

  const response = await handleAdminListingsMainItemPatch(
    createJsonRequest({
      path: `/api/admin/listings/${LISTING_ID}/main-items/phase8_main`,
      body,
    }),
    createDependencies({
      rpc: (functionName, args) => {
        calls.push({ functionName, args });
        return { data: result, error: null };
      },
    }),
    { listingId: LISTING_ID, code: "phase8_main" },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(calls, [
    {
      functionName: "admin_configure_listing_main_item",
      args: {
        p_listing_id: LISTING_ID,
        p_code: "phase8_main",
        p_payload: body,
      },
    },
  ]);

  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.deepEqual(payload.data, result);
});

test("admin listings main item patch allows override-only payloads", async (t) => {
  setupAdminListingEnv(t);
  const calls: RpcCall[] = [];
  const body = { override_amount: 1500 };

  const response = await handleAdminListingsMainItemPatch(
    createJsonRequest({
      path: `/api/admin/listings/${LISTING_ID}/main-items/phase8_main`,
      body,
    }),
    createDependencies({
      rpc: (functionName, args) => {
        calls.push({ functionName, args });
        return {
          data: { code: "phase8_main", is_enabled: true, override_amount: 1500 },
          error: null,
        };
      },
    }),
    { listingId: LISTING_ID, code: "phase8_main" },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls[0].args.p_payload, body);
});

test("admin listings main item patch maps P0002 to 404", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsMainItemPatch(
    createJsonRequest({
      path: `/api/admin/listings/${LISTING_ID}/main-items/phase8_main`,
      body: validMainItemBody(),
    }),
    createDependencies({
      rpc: () => ({ data: null, error: { code: "P0002", message: "not found" } }),
    }),
    { listingId: LISTING_ID, code: "phase8_main" },
  );

  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "Main item catalog entry not found");
});

test("admin listings main item patch maps 22023 to 400", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsMainItemPatch(
    createJsonRequest({
      path: `/api/admin/listings/${LISTING_ID}/main-items/phase8_main`,
      body: { is_enabled: true, override_amount: -1 },
    }),
    createDependencies({
      rpc: () => ({ data: null, error: { code: "22023", message: "negative override" } }),
    }),
    { listingId: LISTING_ID, code: "phase8_main" },
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Geçersiz ilan isteği");
});

// ----------------------------------------------------------------------------
// 8.4 Service: PATCH /api/admin/listings/:listingId/services/:code
// ----------------------------------------------------------------------------

test("admin listings service patch rejects non-json before auth", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsServicePatch(
    new Request(`http://localhost:3000/api/admin/listings/${LISTING_ID}/services/phase8_service`, {
      method: "PATCH",
      headers: {
        "content-type": "text/plain",
        origin: "http://localhost:3000",
      },
      body: "{}",
    }),
    createDependencies({
      rpc: () => failRpc("admin_configure_listing_service"),
    }),
    { listingId: LISTING_ID, code: "phase8_service" },
  );

  assert.equal(response.status, 415);
  assert.equal((await response.json()).error, "Admin listing pricing requires application/json");
});

test("admin listings service patch rejects invalid listing id before RPC", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsServicePatch(
    createJsonRequest({
      path: `/api/admin/listings/not-a-uuid/services/phase8_service`,
      body: validServiceBody(),
    }),
    createDependencies({
      rpc: () => failRpc("admin_configure_listing_service"),
    }),
    { listingId: "not-a-uuid", code: "phase8_service" },
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Invalid listing id");
});

test("admin listings service patch rejects empty code before RPC", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsServicePatch(
    createJsonRequest({
      path: `/api/admin/listings/${LISTING_ID}/services/`,
      body: validServiceBody(),
    }),
    createDependencies({
      rpc: () => failRpc("admin_configure_listing_service"),
    }),
    { listingId: LISTING_ID, code: "" },
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Invalid service code");
});

test("admin listings service patch rejects non-admin before RPC", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsServicePatch(
    createJsonRequest({
      path: `/api/admin/listings/${LISTING_ID}/services/phase8_service`,
      body: validServiceBody(),
    }),
    createDependencies({
      profileRole: "viewer",
      rpc: () => failRpc("admin_configure_listing_service"),
    }),
    { listingId: LISTING_ID, code: "phase8_service" },
  );

  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "Admin role required");
});

test("admin listings service patch calls admin_configure_listing_service and returns 200", async (t) => {
  setupAdminListingEnv(t);
  const calls: RpcCall[] = [];
  const body = validServiceBody();
  const result = {
    id: "dddddddd-eeee-4eee-8eee-eeeeeeeee801",
    listing_id: LISTING_ID,
    service_id: "dddddddd-eeee-4eee-8eee-eeeeeeeee801",
    code: "phase8_service",
    name: "Phase 8 Service",
    is_enabled: true,
  };

  const response = await handleAdminListingsServicePatch(
    createJsonRequest({
      path: `/api/admin/listings/${LISTING_ID}/services/phase8_service`,
      body,
    }),
    createDependencies({
      rpc: (functionName, args) => {
        calls.push({ functionName, args });
        return { data: result, error: null };
      },
    }),
    { listingId: LISTING_ID, code: "phase8_service" },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(calls, [
    {
      functionName: "admin_configure_listing_service",
      args: {
        p_listing_id: LISTING_ID,
        p_code: "phase8_service",
        p_payload: body,
      },
    },
  ]);

  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.deepEqual(payload.data, result);
});

test("admin listings service patch allows override-only payloads", async (t) => {
  setupAdminListingEnv(t);
  const calls: RpcCall[] = [];
  const body = { override_price: 200 };

  const response = await handleAdminListingsServicePatch(
    createJsonRequest({
      path: `/api/admin/listings/${LISTING_ID}/services/phase8_service`,
      body,
    }),
    createDependencies({
      rpc: (functionName, args) => {
        calls.push({ functionName, args });
        return {
          data: { code: "phase8_service", is_enabled: true, override_price: 200 },
          error: null,
        };
      },
    }),
    { listingId: LISTING_ID, code: "phase8_service" },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls[0].args.p_payload, body);
});

test("admin listings service patch maps P0002 to 404", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsServicePatch(
    createJsonRequest({
      path: `/api/admin/listings/${LISTING_ID}/services/phase8_service`,
      body: validServiceBody(),
    }),
    createDependencies({
      rpc: () => ({ data: null, error: { code: "P0002", message: "not found" } }),
    }),
    { listingId: LISTING_ID, code: "phase8_service" },
  );

  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "Service catalog entry not found");
});

test("admin listings service patch maps 22023 to 400", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsServicePatch(
    createJsonRequest({
      path: `/api/admin/listings/${LISTING_ID}/services/phase8_service`,
      body: { is_enabled: true, override_price: -1 },
    }),
    createDependencies({
      rpc: () => ({ data: null, error: { code: "22023", message: "negative override" } }),
    }),
    { listingId: LISTING_ID, code: "phase8_service" },
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Geçersiz ilan isteği");
});

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function createJsonRequest(options: {
  path: string;
  body: unknown;
  origin?: string;
}): Request {
  return new Request(`http://localhost:3000${options.path}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      origin: options.origin ?? "http://localhost:3000",
    },
    body: JSON.stringify(options.body),
  });
}

function validMainItemBody(): Record<string, unknown> {
  return {
    is_enabled: true,
    sort_order: 1,
  };
}

function validServiceBody(): Record<string, unknown> {
  return {
    is_enabled: true,
  };
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
            user: options.userId === null
              ? null
              : { id: options.userId ?? ADMIN_ID },
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

function setupAdminListingEnv(t: TestContext): void {
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
