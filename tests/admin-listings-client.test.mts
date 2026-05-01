import assert from "node:assert/strict";
import test from "node:test";

import {
  AdminListingsClientError,
  addAdminListingImage,
  configureAdminListingMainItem,
  configureAdminListingService,
  createAdminListing,
  deleteAdminListingImage,
  fetchAdminListingSnapshot,
  fetchAdminListingsList,
  reorderAdminListingImages,
  setAdminListingStatus,
  updateAdminListing,
} from "../lib/admin-ui/listings-client.ts";

const LISTING_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const IMAGE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

type Capture = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  credentials: RequestCredentials | undefined;
  cache: RequestCache | undefined;
};

function recordingFetcher(responder: (input: Capture) => Response): {
  fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  calls: Capture[];
} {
  const calls: Capture[] = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const capture: Capture = {
      url: String(input),
      method: init?.method ?? "GET",
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: init?.body ? safeJsonParse(String(init.body)) : null,
      credentials: init?.credentials,
      cache: init?.cache,
    };
    calls.push(capture);
    return responder(capture);
  };

  return { fetcher, calls };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return Response.json(payload, {
    status,
    headers: { "content-type": "application/json" },
  });
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

test("fetchAdminListingsList builds query string and unwraps envelope", async () => {
  const { fetcher, calls } = recordingFetcher(() =>
    jsonResponse({
      success: true,
      data: { items: [{ id: LISTING_ID }], limit: 50, offset: 0 },
    }),
  );

  const list = await fetchAdminListingsList(
    { status: "active", type: "rent", limit: 50, offset: 0 },
    { fetcher },
  );

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "/api/admin/listings?status=active&type=rent&limit=50&offset=0",
  );
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].credentials, "same-origin");
  assert.equal(calls[0].cache, "no-store");
  assert.deepEqual(list.items, [{ id: LISTING_ID }]);
  assert.equal(list.limit, 50);
});

test("fetchAdminListingsList omits unset filters", async () => {
  const { fetcher, calls } = recordingFetcher(() =>
    jsonResponse({ success: true, data: { items: [], limit: 20, offset: 0 } }),
  );

  await fetchAdminListingsList({}, { fetcher });

  assert.equal(calls[0].url, "/api/admin/listings");
});

test("fetchAdminListingSnapshot encodes the listing id", async () => {
  const { fetcher, calls } = recordingFetcher(() =>
    jsonResponse({ success: true, data: { listing: { id: LISTING_ID } } }),
  );

  const snapshot = await fetchAdminListingSnapshot(LISTING_ID, { fetcher });

  assert.equal(calls[0].url, `/api/admin/listings/${LISTING_ID}`);
  assert.equal(calls[0].method, "GET");
  assert.deepEqual(snapshot, { listing: { id: LISTING_ID } });
});

test("createAdminListing posts JSON envelope with content-type header", async () => {
  const { fetcher, calls } = recordingFetcher(() =>
    jsonResponse({ success: true, data: { id: LISTING_ID } }, 201),
  );

  await createAdminListing(
    { type: "rent", title: "Test", slug: "test", price: 1000, currency: "TRY" },
    { fetcher },
  );

  assert.equal(calls[0].url, "/api/admin/listings");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].headers["content-type"], "application/json");
  assert.deepEqual(calls[0].body, {
    type: "rent",
    title: "Test",
    slug: "test",
    price: 1000,
    currency: "TRY",
  });
});

test("updateAdminListing sends PATCH with payload", async () => {
  const { fetcher, calls } = recordingFetcher(() =>
    jsonResponse({ success: true, data: { id: LISTING_ID } }),
  );

  await updateAdminListing(LISTING_ID, { title: "Yeni" }, { fetcher });

  assert.equal(calls[0].url, `/api/admin/listings/${LISTING_ID}`);
  assert.equal(calls[0].method, "PATCH");
  assert.deepEqual(calls[0].body, { title: "Yeni" });
});

test("setAdminListingStatus PATCHes only the status field", async () => {
  const { fetcher, calls } = recordingFetcher(() =>
    jsonResponse({ success: true, data: { id: LISTING_ID, status: "active" } }),
  );

  await setAdminListingStatus(LISTING_ID, "active", { fetcher });

  assert.equal(calls[0].url, `/api/admin/listings/${LISTING_ID}`);
  assert.equal(calls[0].method, "PATCH");
  assert.deepEqual(calls[0].body, { status: "active" });
});

test("addAdminListingImage POSTs to the images sub-resource", async () => {
  const { fetcher, calls } = recordingFetcher(() =>
    jsonResponse({ success: true, data: { id: IMAGE_ID } }, 201),
  );

  await addAdminListingImage(
    LISTING_ID,
    { image_url: "https://example.com/a.jpg", alt_text: "alt", is_primary: true },
    { fetcher },
  );

  assert.equal(calls[0].url, `/api/admin/listings/${LISTING_ID}/images`);
  assert.equal(calls[0].method, "POST");
  assert.deepEqual(calls[0].body, {
    image_url: "https://example.com/a.jpg",
    alt_text: "alt",
    is_primary: true,
  });
});

test("reorderAdminListingImages PATCHes the order endpoint with id list", async () => {
  const { fetcher, calls } = recordingFetcher(() =>
    jsonResponse({ success: true, data: [IMAGE_ID] }),
  );

  await reorderAdminListingImages(LISTING_ID, [IMAGE_ID], { fetcher });

  assert.equal(calls[0].url, `/api/admin/listings/${LISTING_ID}/images/order`);
  assert.equal(calls[0].method, "PATCH");
  assert.deepEqual(calls[0].body, { order: [IMAGE_ID] });
});

test("deleteAdminListingImage DELETEs the nested image resource and returns null", async () => {
  const { fetcher, calls } = recordingFetcher(
    () => new Response(null, { status: 204 }),
  );

  const result = await deleteAdminListingImage(LISTING_ID, IMAGE_ID, { fetcher });

  assert.equal(calls[0].url, `/api/admin/listings/${LISTING_ID}/images/${IMAGE_ID}`);
  assert.equal(calls[0].method, "DELETE");
  assert.equal(result, null);
});

test("configureAdminListingMainItem PATCHes /main-items/:code with payload", async () => {
  const { fetcher, calls } = recordingFetcher(() =>
    jsonResponse({ success: true, data: { code: "phase8_main", is_enabled: true } }),
  );

  await configureAdminListingMainItem(
    LISTING_ID,
    "phase8_main",
    { is_enabled: true, override_amount: 1500 },
    { fetcher },
  );

  assert.equal(
    calls[0].url,
    `/api/admin/listings/${LISTING_ID}/main-items/phase8_main`,
  );
  assert.equal(calls[0].method, "PATCH");
  assert.deepEqual(calls[0].body, { is_enabled: true, override_amount: 1500 });
});

test("configureAdminListingService PATCHes /services/:code with payload", async () => {
  const { fetcher, calls } = recordingFetcher(() =>
    jsonResponse({ success: true, data: { code: "phase8_service", is_enabled: true } }),
  );

  await configureAdminListingService(
    LISTING_ID,
    "phase8_service",
    { is_enabled: true, override_price: 200 },
    { fetcher },
  );

  assert.equal(
    calls[0].url,
    `/api/admin/listings/${LISTING_ID}/services/phase8_service`,
  );
  assert.equal(calls[0].method, "PATCH");
  assert.deepEqual(calls[0].body, { is_enabled: true, override_price: 200 });
});

test("admin listings client throws typed error from failed envelope", async () => {
  const { fetcher } = recordingFetcher(() =>
    jsonResponse({ success: false, error: "Admin role required" }, 403),
  );

  await assert.rejects(
    () => fetchAdminListingSnapshot(LISTING_ID, { fetcher }),
    (err: unknown) => {
      assert.ok(err instanceof AdminListingsClientError);
      assert.equal(err.message, "Admin role required");
      assert.equal(err.status, 403);
      return true;
    },
  );
});

test("admin listings client throws typed error when HTTP status is unsuccessful", async () => {
  const { fetcher } = recordingFetcher(() =>
    jsonResponse({ success: true, data: { listing: { id: LISTING_ID } } }, 500),
  );

  await assert.rejects(
    () => fetchAdminListingSnapshot(LISTING_ID, { fetcher }),
    (err: unknown) => {
      assert.ok(err instanceof AdminListingsClientError);
      assert.equal(err.status, 500);
      return true;
    },
  );
});

test("admin listings client treats non-JSON responses as invalid envelope", async () => {
  const { fetcher } = recordingFetcher(
    () => new Response("not-json", { status: 200 }),
  );

  await assert.rejects(
    () => fetchAdminListingSnapshot(LISTING_ID, { fetcher }),
    (err: unknown) => {
      assert.ok(err instanceof AdminListingsClientError);
      assert.equal(err.message, "Invalid admin listings response");
      return true;
    },
  );
});
