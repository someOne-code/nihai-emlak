import assert from "node:assert/strict";
import test from "node:test";

import {
  loadAdminListingsModel,
  refreshAdminListingsModelAfterMutation,
  selectAdminListing,
} from "../lib/admin-ui/listings-controller.ts";

const LISTING_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SECOND_LISTING_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function makeList(items: Array<Partial<{ id: string; type: string; status: string; title: string }>> = []) {
  return {
    items: items.map((item) => ({
      id: item.id ?? LISTING_ID,
      type: item.type ?? "rent",
      status: item.status ?? "active",
      title: item.title ?? "Test",
      slug: "test",
      city: null,
      district: null,
      price: 0,
      currency: "TRY",
      is_furnished: false,
      image_count: 0,
      main_item_count: 0,
      service_option_count: 0,
      is_checkout_ready: false,
      created_at: null,
      updated_at: null,
    })),
    limit: 20,
    offset: 0,
  };
}

function makeSnapshot(id: string) {
  return {
    listing: {
      id,
      type: "rent",
      status: "active",
      title: "Detay",
      slug: "detay",
      summary: null,
      description: null,
      city: null,
      district: null,
      price: 0,
      currency: "TRY",
      room_count: null,
      bathroom_count: null,
      heating_type: null,
      fuel_type: null,
      balcony_count: null,
      has_elevator: null,
      parking_type: null,
      in_site: null,
      building_age: null,
      floor_count: null,
      floor_number: null,
      usage_status: null,
      facade: null,
      gross_area_m2: null,
      is_furnished: false,
      created_at: null,
      updated_at: null,
    },
    images: [],
    main_item_options: [],
    service_options: [],
    checkout_eligibility: { is_checkout_ready: false, missing: [] as string[] },
    publish_readiness: { is_publish_ready: true, missing: [] as string[] },
  };
}

test("loadAdminListingsModel fetches list, then snapshot for default selection", async () => {
  const calls: string[] = [];
  const model = await loadAdminListingsModel(
    {
      fetchAdminListingsList: async () => {
        calls.push("list");
        return makeList([{ id: LISTING_ID }, { id: SECOND_LISTING_ID }]);
      },
      fetchAdminListingSnapshot: async (listingId: string) => {
        calls.push(`snapshot:${listingId}`);
        return makeSnapshot(listingId);
      },
    },
    { selectedListingId: null },
  );

  assert.deepEqual(calls, ["list", `snapshot:${LISTING_ID}`]);
  assert.equal(model.selectedListingId, LISTING_ID);
  assert.ok(model.detail);
  assert.equal(model.detail.listing.id, LISTING_ID);
});

test("loadAdminListingsModel honours selectedListingId when present in list", async () => {
  const calls: string[] = [];
  const model = await loadAdminListingsModel(
    {
      fetchAdminListingsList: async () => {
        calls.push("list");
        return makeList([{ id: LISTING_ID }, { id: SECOND_LISTING_ID }]);
      },
      fetchAdminListingSnapshot: async (listingId: string) => {
        calls.push(`snapshot:${listingId}`);
        return makeSnapshot(listingId);
      },
    },
    { selectedListingId: SECOND_LISTING_ID },
  );

  assert.deepEqual(calls, ["list", `snapshot:${SECOND_LISTING_ID}`]);
  assert.equal(model.selectedListingId, SECOND_LISTING_ID);
});

test("loadAdminListingsModel falls back to first row when selectedListingId is missing from list", async () => {
  const calls: string[] = [];
  const model = await loadAdminListingsModel(
    {
      fetchAdminListingsList: async () => {
        calls.push("list");
        return makeList([{ id: LISTING_ID }]);
      },
      fetchAdminListingSnapshot: async (listingId: string) => {
        calls.push(`snapshot:${listingId}`);
        return makeSnapshot(listingId);
      },
    },
    { selectedListingId: SECOND_LISTING_ID },
  );

  assert.deepEqual(calls, ["list", `snapshot:${LISTING_ID}`]);
  assert.equal(model.selectedListingId, LISTING_ID);
});

test("loadAdminListingsModel skips snapshot fetch when list is empty", async () => {
  const calls: string[] = [];
  const model = await loadAdminListingsModel(
    {
      fetchAdminListingsList: async () => {
        calls.push("list");
        return makeList([]);
      },
      fetchAdminListingSnapshot: async (listingId: string) => {
        calls.push(`snapshot:${listingId}`);
        return makeSnapshot(listingId);
      },
    },
    { selectedListingId: null },
  );

  assert.deepEqual(calls, ["list"]);
  assert.equal(model.selectedListingId, null);
  assert.equal(model.detail, null);
});

test("loadAdminListingsModel passes filters to the list fetcher", async () => {
  let receivedFilters: unknown = null;
  await loadAdminListingsModel(
    {
      fetchAdminListingsList: async (filters) => {
        receivedFilters = filters;
        return makeList([]);
      },
      fetchAdminListingSnapshot: async (listingId: string) => makeSnapshot(listingId),
    },
    { selectedListingId: null, filters: { status: "passive", type: "sale" } },
  );

  assert.deepEqual(receivedFilters, { status: "passive", type: "sale" });
});

test("selectAdminListing reuses the existing list and only refetches the snapshot", async () => {
  const list = makeList([{ id: LISTING_ID }, { id: SECOND_LISTING_ID }]);
  const calls: string[] = [];
  const model = await selectAdminListing(
    {
      fetchAdminListingSnapshot: async (listingId: string) => {
        calls.push(`snapshot:${listingId}`);
        return makeSnapshot(listingId);
      },
    },
    { list, listingId: SECOND_LISTING_ID },
  );

  assert.deepEqual(calls, [`snapshot:${SECOND_LISTING_ID}`]);
  assert.equal(model.selectedListingId, SECOND_LISTING_ID);
  assert.ok(model.detail);
  assert.equal(model.detail.listing.id, SECOND_LISTING_ID);
});

test("loadAdminListingsModel tolerates snapshot failure and returns model without detail", async () => {
  const calls: string[] = [];
  const model = await loadAdminListingsModel(
    {
      fetchAdminListingsList: async () => {
        calls.push("list");
        return makeList([{ id: LISTING_ID }]);
      },
      fetchAdminListingSnapshot: async () => {
        calls.push("snapshot");
        throw new Error("simulated snapshot 500");
      },
    },
    { selectedListingId: LISTING_ID },
  );

  assert.deepEqual(calls, ["list", "snapshot"]);
  assert.equal(model.selectedListingId, LISTING_ID);
  assert.equal(model.detail, null, "detail must be null when snapshot fails, not crash the loader");
  assert.ok(model.rows.length > 0, "list rows must still be available");
});

test("selectAdminListing tolerates snapshot failure and returns model without detail", async () => {
  const list = makeList([{ id: LISTING_ID }, { id: SECOND_LISTING_ID }]);
  const model = await selectAdminListing(
    {
      fetchAdminListingSnapshot: async () => {
        throw new Error("simulated snapshot 500");
      },
    },
    { list, listingId: SECOND_LISTING_ID },
  );

  assert.equal(model.selectedListingId, SECOND_LISTING_ID);
  assert.equal(model.detail, null, "detail must be null when snapshot fails, not crash the selector");
  assert.ok(model.rows.length > 0, "list rows must still be available");
});

test("selectAdminListing returns null detail when listing id is not in list", async () => {
  const list = makeList([{ id: LISTING_ID }]);
  const model = await selectAdminListing(
    {
      fetchAdminListingSnapshot: async () => {
        throw new Error("snapshot must not be called");
      },
    },
    { list, listingId: "ffffffff-ffff-4fff-8fff-ffffffffffff" },
  );

  assert.equal(model.selectedListingId, LISTING_ID);
  assert.equal(model.detail, null);
});

test("refreshAdminListingsModelAfterMutation reuses mutation snapshot instead of refetching detail", async () => {
  const calls: string[] = [];
  const result = await refreshAdminListingsModelAfterMutation(
    {
      fetchAdminListingsList: async () => {
        calls.push("list");
        return makeList([{ id: LISTING_ID }]);
      },
      fetchAdminListingSnapshot: async (listingId: string) => {
        calls.push(`snapshot:${listingId}`);
        return makeSnapshot(listingId);
      },
    },
    {
      selectedListingId: LISTING_ID,
      mutationSnapshot: makeSnapshot(LISTING_ID),
    },
  );

  assert.deepEqual(calls, ["list"]);
  assert.equal(result.model.selectedListingId, LISTING_ID);
  assert.ok(result.model.detail);
  assert.equal(result.model.detail.listing.id, LISTING_ID);
  assert.equal(result.list.items.length, 1);
});

test("refreshAdminListingsModelAfterMutation can reuse cached list for same-listing snapshot", async () => {
  const cachedList = makeList([{ id: LISTING_ID, title: "Eski baslik" }]);
  const snapshot = makeSnapshot(LISTING_ID);
  snapshot.listing.title = "Yeni baslik";
  const calls: string[] = [];

  const result = await refreshAdminListingsModelAfterMutation(
    {
      fetchAdminListingsList: async () => {
        calls.push("list");
        return makeList([{ id: LISTING_ID }]);
      },
      fetchAdminListingSnapshot: async (listingId: string) => {
        calls.push(`snapshot:${listingId}`);
        return makeSnapshot(listingId);
      },
    },
    {
      selectedListingId: LISTING_ID,
      cachedList,
      mutationSnapshot: snapshot,
    },
  );

  assert.deepEqual(calls, []);
  assert.equal(result.model.rows[0].title, "Yeni baslik");
  assert.equal(result.model.detail?.listing.title, "Yeni baslik");
});
