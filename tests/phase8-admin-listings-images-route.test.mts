import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import test from "node:test";

import {
  handleAdminListingsImagesAddPost,
  handleAdminListingsImagesReorderPatch,
  handleAdminListingsImagesDelete,
} from "../lib/admin/listings-images-route.ts";
import type {
  AdminListingsRouteDependencies,
  AdminListingsRpcName,
  AdminListingsRpcResponse,
  AdminListingsSupabaseError,
} from "../lib/admin/listings-shared.ts";

const LISTING_ID = "aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb801";
const IMAGE_ID = "eeeeeeee-ffff-4fff-8fff-fffffffff801";
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
// 8.3 Images: add
// ----------------------------------------------------------------------------

test("admin listings images add rejects non-json before auth", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsImagesAddPost(
    new Request(`http://localhost:3000/api/admin/listings/${LISTING_ID}/images`, {
      method: "POST",
      headers: {
        "content-type": "text/plain",
        origin: "http://localhost:3000",
      },
      body: "{}",
    }),
    createDependencies({
      rpc: () => failRpc("admin_add_listing_image"),
    }),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 415);
  assert.equal((await response.json()).error, "Admin listing image requires application/json");
});

test("admin listings images add rejects untrusted origin before auth", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsImagesAddPost(
    createJsonRequest({
      method: "POST",
      body: validImageBody(),
      origin: "https://evil.example",
    }),
    createDependencies({
      rpc: () => failRpc("admin_add_listing_image"),
    }),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "Admin listing image Origin is not trusted");
});

test("admin listings images add rejects invalid listing id before RPC", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsImagesAddPost(
    createJsonRequest({ method: "POST", body: validImageBody() }),
    createDependencies({
      rpc: () => failRpc("admin_add_listing_image"),
    }),
    { listingId: "not-a-uuid" },
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Invalid listing id");
});

test("admin listings images add rejects non-admin before RPC", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsImagesAddPost(
    createJsonRequest({ method: "POST", body: validImageBody() }),
    createDependencies({
      profileRole: "viewer",
      rpc: () => failRpc("admin_add_listing_image"),
    }),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "Admin role required");
});

test("admin listings images add rejects empty image_url", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsImagesAddPost(
    createJsonRequest({ method: "POST", body: { image_url: "" } }),
    createDependencies({
      rpc: () => failRpc("admin_add_listing_image"),
    }),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Invalid image url");
});

test("admin listings images add rejects unsupported image_url protocols", async (t) => {
  setupAdminListingEnv(t);

  for (const imageUrl of [
    "/relative/path.jpg",
    "javascript:alert(1)",
    "ftp://example.com/photo.jpg",
    "https://",
    "not a url",
  ]) {
    const response = await handleAdminListingsImagesAddPost(
      createJsonRequest({ method: "POST", body: { image_url: imageUrl } }),
      createDependencies({
        rpc: () => failRpc("admin_add_listing_image"),
      }),
      { listingId: LISTING_ID },
    );

    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "Invalid image url");
  }
});

test("admin listings images add calls admin_add_listing_image and returns 201", async (t) => {
  setupAdminListingEnv(t);
  const calls: RpcCall[] = [];
  const body = validImageBody();
  const imageRecord = {
    id: IMAGE_ID,
    image_url: body.image_url,
    alt_text: body.alt_text,
    sort_order: 0,
    is_primary: false,
    created_at: "2026-04-30T12:00:00Z",
  };

  const response = await handleAdminListingsImagesAddPost(
    createJsonRequest({ method: "POST", body }),
    createDependencies({
      rpc: (functionName, args) => {
        calls.push({ functionName, args });
        return { data: imageRecord, error: null };
      },
    }),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(calls, [
    {
      functionName: "admin_add_listing_image",
      args: {
        p_listing_id: LISTING_ID,
        p_image_url: body.image_url,
        p_alt_text: body.alt_text,
        p_is_primary: false,
      },
    },
  ]);

  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.deepEqual(payload.data, imageRecord);
});

test("admin listings images add with is_primary=true passes true to RPC", async (t) => {
  setupAdminListingEnv(t);
  const calls: RpcCall[] = [];

  await handleAdminListingsImagesAddPost(
    createJsonRequest({ method: "POST", body: { image_url: "https://x.com/p.jpg", is_primary: true } }),
    createDependencies({
      rpc: (functionName, args) => {
        calls.push({ functionName, args });
        return { data: { id: IMAGE_ID, is_primary: true }, error: null };
      },
    }),
    { listingId: LISTING_ID },
  );

  assert.equal(calls[0].args.p_is_primary, true);
});

test("admin listings images add maps P0002 to 404", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsImagesAddPost(
    createJsonRequest({ method: "POST", body: validImageBody() }),
    createDependencies({
      rpc: () => ({ data: null, error: { code: "P0002", message: "not found" } }),
    }),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "Listing not found");
});

// ----------------------------------------------------------------------------
// 8.3 Images: reorder
// ----------------------------------------------------------------------------

test("admin listings images reorder rejects non-json before auth", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsImagesReorderPatch(
    new Request(`http://localhost:3000/api/admin/listings/${LISTING_ID}/images/order`, {
      method: "PATCH",
      headers: {
        "content-type": "text/plain",
        origin: "http://localhost:3000",
      },
      body: "{}",
    }),
    createDependencies({
      rpc: () => failRpc("admin_reorder_listing_images"),
    }),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 415);
  assert.equal((await response.json()).error, "Admin listing image requires application/json");
});

test("admin listings images reorder rejects invalid listing id before RPC", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsImagesReorderPatch(
    createJsonRequest({ method: "PATCH", body: { order: [IMAGE_ID] } }),
    createDependencies({
      rpc: () => failRpc("admin_reorder_listing_images"),
    }),
    { listingId: "not-a-uuid" },
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Invalid listing id");
});

test("admin listings images reorder rejects non-admin before RPC", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsImagesReorderPatch(
    createJsonRequest({ method: "PATCH", body: { order: [IMAGE_ID] } }),
    createDependencies({
      profileRole: "viewer",
      rpc: () => failRpc("admin_reorder_listing_images"),
    }),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "Admin role required");
});

test("admin listings images reorder rejects empty order array", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsImagesReorderPatch(
    createJsonRequest({ method: "PATCH", body: { order: [] } }),
    createDependencies({
      rpc: () => failRpc("admin_reorder_listing_images"),
    }),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Invalid image order payload");
});

test("admin listings images reorder rejects non-array order", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsImagesReorderPatch(
    createJsonRequest({ method: "PATCH", body: { order: "not-an-array" } }),
    createDependencies({
      rpc: () => failRpc("admin_reorder_listing_images"),
    }),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Invalid image order payload");
});

test("admin listings images reorder rejects order with empty string elements", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsImagesReorderPatch(
    createJsonRequest({ method: "PATCH", body: { order: ["  "] } }),
    createDependencies({
      rpc: () => failRpc("admin_reorder_listing_images"),
    }),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Invalid image order payload");
});

test("admin listings images reorder calls admin_reorder_listing_images and returns 200", async (t) => {
  setupAdminListingEnv(t);
  const calls: RpcCall[] = [];
  const order = [IMAGE_ID, "eeeeeeee-ffff-4fff-8fff-fffffffff802"];
  const reorderedImages = [
    { id: IMAGE_ID, sort_order: 0 },
    { id: "eeeeeeee-ffff-4fff-8fff-fffffffff802", sort_order: 1 },
  ];

  const response = await handleAdminListingsImagesReorderPatch(
    createJsonRequest({ method: "PATCH", body: { order } }),
    createDependencies({
      rpc: (functionName, args) => {
        calls.push({ functionName, args });
        return { data: reorderedImages, error: null };
      },
    }),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(calls, [
    {
      functionName: "admin_reorder_listing_images",
      args: {
        p_listing_id: LISTING_ID,
        p_order: order,
      },
    },
  ]);

  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.deepEqual(payload.data, reorderedImages);
});

test("admin listings images reorder maps P0002 to 404", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsImagesReorderPatch(
    createJsonRequest({ method: "PATCH", body: { order: [IMAGE_ID] } }),
    createDependencies({
      rpc: () => ({ data: null, error: { code: "P0002", message: "not found" } }),
    }),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "Listing not found");
});

// ----------------------------------------------------------------------------
// 8.3 Images: delete
// ----------------------------------------------------------------------------

test("admin listings images delete rejects untrusted origin before auth", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsImagesDelete(
    createDeleteRequest("https://evil.example"),
    createDependencies({
      rpc: () => failRpc("admin_delete_listing_image"),
    }),
    { listingId: LISTING_ID, imageId: IMAGE_ID },
  );

  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "Admin listing image Origin is not trusted");
});

test("admin listings images delete rejects invalid listing id before RPC", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsImagesDelete(
    createDeleteRequest(),
    createDependencies({
      rpc: () => failRpc("admin_delete_listing_image"),
    }),
    { listingId: "not-a-uuid", imageId: IMAGE_ID },
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Invalid listing id");
});

test("admin listings images delete rejects invalid image id before RPC", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsImagesDelete(
    createDeleteRequest(),
    createDependencies({
      rpc: () => failRpc("admin_delete_listing_image"),
    }),
    { listingId: LISTING_ID, imageId: "not-a-uuid" },
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Invalid image id");
});

test("admin listings images delete rejects non-admin before RPC", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsImagesDelete(
    createDeleteRequest(),
    createDependencies({
      profileRole: "viewer",
      rpc: () => failRpc("admin_delete_listing_image"),
    }),
    { listingId: LISTING_ID, imageId: IMAGE_ID },
  );

  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "Admin role required");
});

test("admin listings images delete calls admin_delete_listing_image and returns 204", async (t) => {
  setupAdminListingEnv(t);
  const calls: RpcCall[] = [];

  const response = await handleAdminListingsImagesDelete(
    createDeleteRequest(),
    createDependencies({
      rpc: (functionName, args) => {
        calls.push({ functionName, args });
        return { data: { deleted: true, image_id: IMAGE_ID }, error: null };
      },
    }),
    { listingId: LISTING_ID, imageId: IMAGE_ID },
  );

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(calls, [
    {
      functionName: "admin_delete_listing_image",
      args: { p_listing_id: LISTING_ID, p_image_id: IMAGE_ID },
    },
  ]);

  // 204 should have no body.
  const bodyText = await response.text();
  assert.equal(bodyText, "");
});

test("admin listings images delete maps P0002 to 404", async (t) => {
  setupAdminListingEnv(t);

  const response = await handleAdminListingsImagesDelete(
    createDeleteRequest(),
    createDependencies({
      rpc: () => ({ data: null, error: { code: "P0002", message: "not found" } }),
    }),
    { listingId: LISTING_ID, imageId: IMAGE_ID },
  );

  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "Image not found");
});

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function createDeleteRequest(origin = "http://localhost:3000"): Request {
  return new Request(`http://localhost:3000/api/admin/listings/${LISTING_ID}/images/${IMAGE_ID}`, {
    method: "DELETE",
    headers: {
      origin,
    },
  });
}

function createJsonRequest(options: {
  method: "POST" | "PATCH";
  body: unknown;
  origin?: string;
}): Request {
  const path = options.method === "PATCH"
    ? `/api/admin/listings/${LISTING_ID}/images/order`
    : `/api/admin/listings/${LISTING_ID}/images`;

  return new Request(`http://localhost:3000${path}`, {
    method: options.method,
    headers: {
      "content-type": "application/json",
      origin: options.origin ?? "http://localhost:3000",
    },
    body: JSON.stringify(options.body),
  });
}

function validImageBody(): Record<string, unknown> {
  return {
    image_url: "https://example.com/photo.jpg",
    alt_text: "A beautiful photo",
    is_primary: false,
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
