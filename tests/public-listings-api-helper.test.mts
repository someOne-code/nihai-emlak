import assert from "node:assert/strict";
import test from "node:test";

import {
  getPublicListingFilters,
  getPublicListings,
} from "../lib/api/listings.ts";

test("getPublicListings sends only backend-supported public listing params", async () => {
  const requests: Array<RequestInfo | URL> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    requests.push(input);
    return Response.json({
      success: true,
      data: {
        items: [],
        limit: 12,
        offset: 24,
      },
    });
  };

  try {
    const result = await getPublicListings({
      type: "sale",
      city: " Kayseri ",
      district: " Talas ",
      min_price: 1000000,
      max_price: 3000000,
      min_rooms: 2,
      min_bathrooms: 1,
      min_area: 80,
      max_area: 180,
      is_furnished: false,
      limit: 12,
      offset: 24,
      sort: "price_desc",
    } as Parameters<typeof getPublicListings>[0] & { sort: string });

    assert.deepEqual(result, {
      items: [],
      limit: 12,
      offset: 24,
    });

    const url = new URL(String(requests[0]));
    assert.equal(url.pathname, "/api/public/listings");
    assert.deepEqual(Object.fromEntries(url.searchParams), {
      type: "sale",
      city: "Kayseri",
      district: "Talas",
      min_price: "1000000",
      max_price: "3000000",
      min_rooms: "2",
      min_bathrooms: "1",
      min_area: "80",
      max_area: "180",
      is_furnished: "false",
      limit: "12",
      offset: "24",
    });
    assert.equal(url.searchParams.has("sort"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getPublicListingFilters reads the public listing filter metadata endpoint", async () => {
  const requests: Array<RequestInfo | URL> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    requests.push(input);
    return Response.json({
      success: true,
      data: {
        cities: [{ value: "Kayseri", label: "Kayseri", count: 3 }],
        districts: [{ city: "Kayseri", value: "Talas", label: "Talas", count: 2 }],
        priceRange: { min: 1000000, max: 3000000 },
        areaRange: { min: 80, max: 180 },
      },
    });
  };

  try {
    const result = await getPublicListingFilters();

    assert.deepEqual(result, {
      cities: [{ value: "Kayseri", label: "Kayseri", count: 3 }],
      districts: [{ city: "Kayseri", value: "Talas", label: "Talas", count: 2 }],
      priceRange: { min: 1000000, max: 3000000 },
      areaRange: { min: 80, max: 180 },
    });

    const url = new URL(String(requests[0]));
    assert.equal(url.pathname, "/api/public/listing-filters");
    assert.equal(url.search, "");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
