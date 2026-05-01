import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import test from "node:test";

import {
  handleAdminListingsListGet,
  handleAdminListingsSnapshotGet,
} from "../lib/admin/listings-read-route.ts";
import {
  handleAdminListingsCreatePost,
  handleAdminListingsUpdatePatch,
} from "../lib/admin/listings-write-route.ts";
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
// 8.1 Read: list listings
// ----------------------------------------------------------------------------

test("admin listings list rejects unauthenticated requests before RPC", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsListGet(
    createGetRequest(),
    createDependencies({
      userId: null,
      rpc: () => failRpc("admin_list_listings"),
    }),
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Authentication required",
  });
});

test("admin listings list rejects non-admin users before RPC", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsListGet(
    createGetRequest(),
    createDependencies({
      profileRole: "editor",
      rpc: () => failRpc("admin_list_listings"),
    }),
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Admin role required",
  });
});

test("admin listings list fails closed when profile lookup fails", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsListGet(
    createGetRequest(),
    createDependencies({
      profileError: { code: "57014", message: "statement timeout" },
      rpc: () => failRpc("admin_list_listings"),
    }),
  );

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Admin profile lookup failed",
  });
});

test("admin listings list rejects invalid status filter before RPC", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsListGet(
    createGetRequest({ search: "?status=archived" }),
    createDependencies({
      rpc: () => failRpc("admin_list_listings"),
    }),
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Invalid admin listings status filter");
});

test("admin listings list rejects invalid limit before RPC", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsListGet(
    createGetRequest({ search: "?limit=999" }),
    createDependencies({
      rpc: () => failRpc("admin_list_listings"),
    }),
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Invalid admin listings limit");
});

test("admin listings list calls admin_list_listings RPC and returns no-store payload", async (t) => {
  setupAdminListingEnv(t);
  const calls: RpcCall[] = [];

  const response = await handleAdminListingsListGet(
    createGetRequest({ search: "?status=active&type=rent&limit=50&offset=10" }),
    createDependencies({
      rpc: (functionName, args) => {
        calls.push({ functionName, args });
        return {
          data: {
            items: [
              {
                id: LISTING_ID,
                type: "rent",
                status: "active",
                title: "Sample",
              },
            ],
            limit: 50,
            offset: 10,
          },
          error: null,
        };
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(calls, [
    {
      functionName: "admin_list_listings",
      args: {
        p_status: "active",
        p_type: "rent",
        p_limit: 50,
        p_offset: 10,
      },
    },
  ]);

  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.data.items[0].id, LISTING_ID);
  assert.equal(payload.data.limit, 50);
});

test("admin listings list defaults to limit=20 offset=0 with no filters", async (t) => {
  setupAdminListingEnv(t);
  const calls: RpcCall[] = [];

  await handleAdminListingsListGet(
    createGetRequest(),
    createDependencies({
      rpc: (functionName, args) => {
        calls.push({ functionName, args });
        return { data: { items: [], limit: 20, offset: 0 }, error: null };
      },
    }),
  );

  assert.deepEqual(calls, [
    {
      functionName: "admin_list_listings",
      args: {
        p_status: null,
        p_type: null,
        p_limit: 20,
        p_offset: 0,
      },
    },
  ]);
});

test("admin listings list maps RPC 22023 to 400", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsListGet(
    createGetRequest(),
    createDependencies({
      rpc: () => ({
        data: null,
        error: { code: "22023", message: "invalid pagination" },
      }),
    }),
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Invalid admin listing request");
});

// ----------------------------------------------------------------------------
// 8.1 Read: snapshot
// ----------------------------------------------------------------------------

test("admin listings snapshot rejects invalid uuid before RPC", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsSnapshotGet(
    createGetRequest(),
    createDependencies({
      rpc: () => failRpc("admin_get_listing"),
    }),
    { listingId: "not-a-uuid" },
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Invalid listing id");
});

test("admin listings snapshot rejects unauthenticated requests before RPC", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsSnapshotGet(
    createGetRequest(),
    createDependencies({
      userId: null,
      rpc: () => failRpc("admin_get_listing"),
    }),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 401);
});

test("admin listings snapshot maps P0002 to 404 with canonical error", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsSnapshotGet(
    createGetRequest(),
    createDependencies({
      rpc: () => ({ data: null, error: { code: "P0002", message: "not found" } }),
    }),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "Listing not found");
});

test("admin listings snapshot returns 404 when RPC data is null without error", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsSnapshotGet(
    createGetRequest(),
    createDependencies({
      rpc: () => ({ data: null, error: null }),
    }),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "Listing not found");
});

test("admin listings snapshot calls admin_get_listing and returns no-store payload", async (t) => {
  setupAdminListingEnv(t);
  const calls: RpcCall[] = [];
  const snapshot = {
    listing: { id: LISTING_ID, type: "rent", status: "active" },
    images: [],
    main_item_options: [],
    service_options: [],
    checkout_eligibility: { is_checkout_ready: false, missing: ["enabled_main_item"] },
  };

  const response = await handleAdminListingsSnapshotGet(
    createGetRequest(),
    createDependencies({
      rpc: (functionName, args) => {
        calls.push({ functionName, args });
        return { data: snapshot, error: null };
      },
    }),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(calls, [
    {
      functionName: "admin_get_listing",
      args: { p_listing_id: LISTING_ID },
    },
  ]);

  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.deepEqual(payload.data, snapshot);
});

// ----------------------------------------------------------------------------
// 8.2 Write: create
// ----------------------------------------------------------------------------

test("admin listings create rejects non-json before auth", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsCreatePost(
    new Request("http://localhost:3000/api/admin/listings", {
      method: "POST",
      headers: {
        "content-type": "text/plain",
        origin: "http://localhost:3000",
      },
      body: "{}",
    }),
    createDependencies({
      rpc: () => failRpc("admin_create_listing"),
    }),
  );

  assert.equal(response.status, 415);
  assert.equal((await response.json()).error, "Admin listing requires application/json");
});

test("admin listings create rejects untrusted origin before auth", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsCreatePost(
    createJsonRequest({ method: "POST", body: validCreateBody(), origin: "https://evil.example" }),
    createDependencies({
      rpc: () => failRpc("admin_create_listing"),
    }),
  );

  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "Admin listing Origin is not trusted");
});

test("admin listings create rejects oversized bodies before auth", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsCreatePost(
    createJsonRequest({
      method: "POST",
      body: { ...validCreateBody(), summary: "x".repeat(8 * 1024) },
    }),
    createDependencies({
      rpc: () => failRpc("admin_create_listing"),
    }),
  );

  assert.equal(response.status, 413);
  assert.equal((await response.json()).error, "Admin listing payload is too large");
});

test("admin listings create rejects non-admin before RPC", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsCreatePost(
    createJsonRequest({ method: "POST", body: validCreateBody() }),
    createDependencies({
      profileRole: "viewer",
      rpc: () => failRpc("admin_create_listing"),
    }),
  );

  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "Admin role required");
});

test("admin listings create rejects empty body", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsCreatePost(
    new Request("http://localhost:3000/api/admin/listings", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: "[]",
    }),
    createDependencies({
      rpc: () => failRpc("admin_create_listing"),
    }),
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Invalid JSON request body");
});

test("admin listings create maps 23505 to 409 slug conflict", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsCreatePost(
    createJsonRequest({ method: "POST", body: validCreateBody() }),
    createDependencies({
      rpc: () => ({ data: null, error: { code: "23505", message: "duplicate slug" } }),
    }),
  );

  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "Listing slug is already used");
});

test("admin listings create maps P0004 to 422 rent invariant", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsCreatePost(
    createJsonRequest({ method: "POST", body: { ...validCreateBody(), type: "rent", status: "active" } }),
    createDependencies({
      rpc: () => ({ data: null, error: { code: "P0004", message: "rent invariant" } }),
    }),
  );

  assert.equal(response.status, 422);
  assert.equal((await response.json()).error, "Rent listing is not checkout-ready");
});

test("admin listings create returns 201 with snapshot payload on success", async (t) => {
  setupAdminListingEnv(t);
  const calls: RpcCall[] = [];
  const body = validCreateBody();
  const snapshot = {
    listing: { id: LISTING_ID, type: "sale", status: "passive" },
    images: [],
    main_item_options: [],
    service_options: [],
    checkout_eligibility: { is_checkout_ready: false, missing: ["enabled_main_item"] },
  };

  const response = await handleAdminListingsCreatePost(
    createJsonRequest({ method: "POST", body }),
    createDependencies({
      rpc: (functionName, args) => {
        calls.push({ functionName, args });
        return { data: snapshot, error: null };
      },
    }),
  );

  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(calls, [
    {
      functionName: "admin_create_listing",
      args: { p_payload: body },
    },
  ]);

  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.deepEqual(payload.data, snapshot);
});

// ----------------------------------------------------------------------------
// 8.2 Write: update / set status
// ----------------------------------------------------------------------------

test("admin listings update rejects non-json before auth", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsUpdatePatch(
    new Request(`http://localhost:3000/api/admin/listings/${LISTING_ID}`, {
      method: "PATCH",
      headers: {
        "content-type": "text/plain",
        origin: "http://localhost:3000",
      },
      body: "{}",
    }),
    createDependencies({ rpc: () => failRpc("admin_update_listing") }),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 415);
  assert.equal((await response.json()).error, "Admin listing requires application/json");
});

test("admin listings update rejects invalid uuid before RPC", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsUpdatePatch(
    createJsonRequest({ method: "PATCH", body: { title: "x" } }),
    createDependencies({ rpc: () => failRpc("admin_update_listing") }),
    { listingId: "not-a-uuid" },
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Invalid listing id");
});

test("admin listings update rejects empty patch body", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsUpdatePatch(
    createJsonRequest({ method: "PATCH", body: {} }),
    createDependencies({ rpc: () => failRpc("admin_update_listing") }),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Empty admin listing patch payload");
});

test("admin listings update rejects status mixed with other fields", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsUpdatePatch(
    createJsonRequest({ method: "PATCH", body: { status: "active", title: "new" } }),
    createDependencies({ rpc: () => failRpc("admin_update_listing") }),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Admin listing status must be patched on its own");
});

test("admin listings update rejects unknown status value", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsUpdatePatch(
    createJsonRequest({ method: "PATCH", body: { status: "archived" } }),
    createDependencies({ rpc: () => failRpc("admin_set_listing_status") }),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Invalid admin listing status");
});

test("admin listings update with status only dispatches to admin_set_listing_status", async (t) => {
  setupAdminListingEnv(t);
  const calls: RpcCall[] = [];

  const response = await handleAdminListingsUpdatePatch(
    createJsonRequest({ method: "PATCH", body: { status: "active" } }),
    createDependencies({
      rpc: (functionName, args) => {
        calls.push({ functionName, args });
        return {
          data: { listing: { id: LISTING_ID, status: "active" } },
          error: null,
        };
      },
    }),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [
    {
      functionName: "admin_set_listing_status",
      args: { p_listing_id: LISTING_ID, p_status: "active" },
    },
  ]);
});

test("admin listings update with non-status fields dispatches to admin_update_listing", async (t) => {
  setupAdminListingEnv(t);
  const calls: RpcCall[] = [];

  const body = { title: "Yeni baslik", price: 1500 };
  const response = await handleAdminListingsUpdatePatch(
    createJsonRequest({ method: "PATCH", body }),
    createDependencies({
      rpc: (functionName, args) => {
        calls.push({ functionName, args });
        return {
          data: { listing: { id: LISTING_ID, title: body.title } },
          error: null,
        };
      },
    }),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [
    {
      functionName: "admin_update_listing",
      args: { p_listing_id: LISTING_ID, p_payload: body },
    },
  ]);
});

test("admin listings update maps P0002 to 404", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsUpdatePatch(
    createJsonRequest({ method: "PATCH", body: { title: "x" } }),
    createDependencies({
      rpc: () => ({ data: null, error: { code: "P0002", message: "not found" } }),
    }),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "Listing not found");
});

test("admin listings update maps 23505 to 409", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsUpdatePatch(
    createJsonRequest({ method: "PATCH", body: { slug: "duplicate-slug" } }),
    createDependencies({
      rpc: () => ({ data: null, error: { code: "23505", message: "duplicate slug" } }),
    }),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "Listing slug is already used");
});

test("admin listings status transition maps P0004 to 422 rent invariant", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsUpdatePatch(
    createJsonRequest({ method: "PATCH", body: { status: "active" } }),
    createDependencies({
      rpc: () => ({ data: null, error: { code: "P0004", message: "rent invariant" } }),
    }),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 422);
  assert.equal((await response.json()).error, "Rent listing is not checkout-ready");
});

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function createGetRequest(options: { search?: string } = {}): Request {
  const search = options.search ?? "";
  return new Request(`http://localhost:3000/api/admin/listings${search}`, {
    method: "GET",
  });
}

function createJsonRequest(options: {
  method: "POST" | "PATCH";
  body: unknown;
  origin?: string;
}): Request {
  return new Request(
    options.method === "PATCH"
      ? `http://localhost:3000/api/admin/listings/${LISTING_ID}`
      : "http://localhost:3000/api/admin/listings",
    {
      method: options.method,
      headers: {
        "content-type": "application/json",
        origin: options.origin ?? "http://localhost:3000",
      },
      body: JSON.stringify(options.body),
    },
  );
}

function validCreateBody(): Record<string, unknown> {
  return {
    type: "sale",
    title: "Yeni satilik daire",
    slug: "yeni-satilik-daire",
    city: "Istanbul",
    district: "Kadikoy",
    price: 4500000,
    currency: "TRY",
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
