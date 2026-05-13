import assert from "node:assert/strict";
import test from "node:test";

import {
  handleAdminAuditEventsGet,
  handleAdminOrdersGet,
  handleAdminPaymentEventsGet,
  handleAdminPaymentsGet,
  handleAdminReservationsGet,
  handlePublicListingFiltersGet,
  handlePublicListingDetailGet,
  handlePublicListingServicesGet,
  handlePublicListingsGet,
  type ReadModelRouteDependencies,
} from "../lib/read-models/read-route.ts";

test("public listings route validates query params and calls list_public_listings RPC", async () => {
  const calls: Array<{ functionName: string; args: Record<string, unknown> }> = [];
  const response = await handlePublicListingsGet(
    new Request("http://localhost:3000/api/public/listings?type=rent&city=Istanbul&limit=10&offset=5"),
    createDependencies({
      rpc: (functionName, args) => {
        calls.push({ functionName, args });
        return {
          data: {
            items: [],
            limit: 10,
            offset: 5,
          },
          error: null,
        };
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [
    {
      functionName: "list_public_listings",
      args: {
        p_type: "rent",
        p_city: "Istanbul",
        p_district: null,
        p_min_price: null,
        p_max_price: null,
        p_min_rooms: null,
        p_min_bathrooms: null,
        p_min_area: null,
        p_max_area: null,
        p_is_furnished: null,
        p_limit: 10,
        p_offset: 5,
      },
    },
  ]);

  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.deepEqual(payload.data, {
    items: [],
    limit: 10,
    offset: 5,
  });
});

test("public listings route passes supported filter params to list_public_listings RPC", async (t) => {
  const cases: Array<{
    name: string;
    query: Record<string, string>;
    expectedArgs: Record<string, unknown>;
  }> = [
    {
      name: "min_price",
      query: { min_price: "100000" },
      expectedArgs: { p_min_price: 100000 },
    },
    {
      name: "max_price",
      query: { max_price: "2500000" },
      expectedArgs: { p_max_price: 2500000 },
    },
    {
      name: "min_price and max_price",
      query: { min_price: "100000", max_price: "2500000" },
      expectedArgs: { p_min_price: 100000, p_max_price: 2500000 },
    },
    {
      name: "min_rooms",
      query: { min_rooms: "3" },
      expectedArgs: { p_min_rooms: 3 },
    },
    {
      name: "min_bathrooms",
      query: { min_bathrooms: "2" },
      expectedArgs: { p_min_bathrooms: 2 },
    },
    {
      name: "min_area and max_area",
      query: { min_area: "80", max_area: "180" },
      expectedArgs: { p_min_area: 80, p_max_area: 180 },
    },
    {
      name: "is_furnished true",
      query: { is_furnished: "true" },
      expectedArgs: { p_is_furnished: true },
    },
    {
      name: "is_furnished false",
      query: { is_furnished: "false" },
      expectedArgs: { p_is_furnished: false },
    },
    {
      name: "district",
      query: { district: "Talas" },
      expectedArgs: { p_district: "Talas" },
    },
    {
      name: "combined location, type, and price filters",
      query: {
        type: "sale",
        city: "Kayseri",
        district: "Melikgazi",
        min_price: "1000000",
        max_price: "3000000",
      },
      expectedArgs: {
        p_type: "sale",
        p_city: "Kayseri",
        p_district: "Melikgazi",
        p_min_price: 1000000,
        p_max_price: 3000000,
      },
    },
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, async () => {
      const calls: Array<{ functionName: string; args: Record<string, unknown> }> = [];
      const response = await handlePublicListingsGet(
        publicListingsRequest(testCase.query),
        createDependencies({
          rpc: (functionName, args) => {
            calls.push({ functionName, args });
            return {
              data: {
                items: [],
                limit: 20,
                offset: 0,
              },
              error: null,
            };
          },
        }),
      );

      assert.equal(response.status, 200);
      assert.deepEqual(calls, [
        {
          functionName: "list_public_listings",
          args: {
            p_type: testCase.expectedArgs.p_type ?? null,
            p_city: testCase.expectedArgs.p_city ?? null,
            p_district: testCase.expectedArgs.p_district ?? null,
            p_min_price: testCase.expectedArgs.p_min_price ?? null,
            p_max_price: testCase.expectedArgs.p_max_price ?? null,
            p_min_rooms: testCase.expectedArgs.p_min_rooms ?? null,
            p_min_bathrooms: testCase.expectedArgs.p_min_bathrooms ?? null,
            p_min_area: testCase.expectedArgs.p_min_area ?? null,
            p_max_area: testCase.expectedArgs.p_max_area ?? null,
            p_is_furnished: testCase.expectedArgs.p_is_furnished ?? null,
            p_limit: 20,
            p_offset: 0,
          },
        },
      ]);

      assert.deepEqual(await response.json(), {
        success: true,
        data: {
          items: [],
          limit: 20,
          offset: 0,
        },
      });
    });
  }
});

test("public listings route rejects invalid pagination query before RPC", async () => {
  const response = await handlePublicListingsGet(
    new Request("http://localhost:3000/api/public/listings?limit=abc"),
    createDependencies({
      rpc: () => {
        throw new Error("rpc should not run for invalid query");
      },
    }),
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Invalid query parameter: limit");
});

test("public listings route rejects invalid filter query before RPC", async (t) => {
  const cases: Array<{ name: string; query: Record<string, string>; expectedError: string }> = [
    {
      name: "invalid type",
      query: { type: "invalid" },
      expectedError: "Invalid query parameter: type",
    },
    {
      name: "invalid min_price",
      query: { min_price: "abc" },
      expectedError: "Invalid query parameter: min_price",
    },
    {
      name: "negative max_price",
      query: { max_price: "-1" },
      expectedError: "Invalid query parameter: max_price",
    },
    {
      name: "invalid min_rooms",
      query: { min_rooms: "abc" },
      expectedError: "Invalid query parameter: min_rooms",
    },
    {
      name: "negative min_bathrooms",
      query: { min_bathrooms: "-1" },
      expectedError: "Invalid query parameter: min_bathrooms",
    },
    {
      name: "decimal min_rooms",
      query: { min_rooms: "1.5" },
      expectedError: "Invalid query parameter: min_rooms",
    },
    {
      name: "invalid min_area",
      query: { min_area: "abc" },
      expectedError: "Invalid query parameter: min_area",
    },
    {
      name: "negative max_area",
      query: { max_area: "-1" },
      expectedError: "Invalid query parameter: max_area",
    },
    {
      name: "invalid is_furnished",
      query: { is_furnished: "maybe" },
      expectedError: "Invalid query parameter: is_furnished",
    },
    {
      name: "limit above maximum",
      query: { limit: "999" },
      expectedError: "Invalid query parameter: limit",
    },
    {
      name: "negative offset",
      query: { offset: "-1" },
      expectedError: "Invalid query parameter: offset",
    },
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, async () => {
      const response = await handlePublicListingsGet(
        publicListingsRequest(testCase.query),
        createDependencies({
          rpc: () => {
            throw new Error("rpc should not run for invalid public listing filters");
          },
        }),
      );

      assert.equal(response.status, 400);
      assert.equal((await response.json()).error, testCase.expectedError);
    });
  }
});

test("public listings route falls back to table read when read RPC is unavailable", async () => {
  const response = await handlePublicListingsGet(
    new Request("http://localhost:3000/api/public/listings?limit=6"),
    createDependencies({
      rpc: () => ({
        data: null,
        error: {
          code: "PGRST202",
          message: "function public.list_public_listings was not found",
        },
      }),
      tableRead: {
        listings: [],
        images: [],
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    data: {
      items: [],
      limit: 6,
      offset: 0,
    },
  });
});

test("public listings route table fallback maps active listing rows to public list shape", async () => {
  const response = await handlePublicListingsGet(
    new Request("http://localhost:3000/api/public/listings?type=rent&limit=6"),
    createDependencies({
      rpc: () => ({
        data: null,
        error: {
          code: "PGRST202",
          message: "function public.list_public_listings was not found",
        },
      }),
      tableRead: {
        listings: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            type: "rent",
            status: "active",
            title: "Test listing",
            slug: "test-listing",
            summary: null,
            city: "Kayseri",
            district: "Talas",
            price: 35000,
            currency: "TRY",
            room_count: 3,
            bathroom_count: 2,
            gross_area_m2: 145,
            is_furnished: true,
            created_at: "2026-05-01T00:00:00.000Z",
          },
        ],
        images: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            listing_id: "11111111-1111-4111-8111-111111111111",
            image_url: "https://example.com/cover.jpg",
            is_primary: true,
            sort_order: 0,
            created_at: "2026-05-01T00:00:00.000Z",
          },
        ],
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    data: {
      items: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          type: "rent",
          status: "active",
          title: "Test listing",
          slug: "test-listing",
          summary: null,
          city: "Kayseri",
          district: "Talas",
          price: 35000,
          currency: "TRY",
          room_count: 3,
          bathroom_count: 2,
          gross_area_m2: 145,
          is_furnished: true,
          primary_image_url: "https://example.com/cover.jpg",
          created_at: "2026-05-01T00:00:00.000Z",
        },
      ],
      limit: 6,
      offset: 0,
    },
  });
});

test("public listings route table fallback applies supported listing filters", async () => {
  const response = await handlePublicListingsGet(
    new Request("http://localhost:3000/api/public/listings?city=kayseri&district=talas&min_price=30000&max_price=40000&min_rooms=2&min_bathrooms=2&min_area=120&max_area=160&is_furnished=true&limit=6"),
    createDependencies({
      rpc: () => ({
        data: null,
        error: {
          code: "PGRST202",
          message: "function public.list_public_listings was not found",
        },
      }),
      tableRead: {
        listings: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            type: "rent",
            status: "active",
            title: "Matching listing",
            slug: "matching-listing",
            summary: null,
            city: "Kayseri",
            district: "Talas",
            price: 35000,
            currency: "TRY",
            room_count: 3,
            bathroom_count: 2,
            gross_area_m2: 145,
            is_furnished: true,
            created_at: "2026-05-01T00:00:00.000Z",
          },
          {
            id: "33333333-3333-4333-8333-333333333333",
            type: "rent",
            status: "active",
            title: "Non matching listing",
            slug: "non-matching-listing",
            summary: null,
            city: "Kayseri",
            district: "Melikgazi",
            price: 45000,
            currency: "TRY",
            room_count: 1,
            bathroom_count: 1,
            gross_area_m2: 90,
            is_furnished: false,
            created_at: "2026-05-02T00:00:00.000Z",
          },
        ],
        images: [],
      },
    }),
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(
    payload.data.items.map((item: { id: string }) => item.id),
    ["11111111-1111-4111-8111-111111111111"],
  );
});

test("public listings route returns an empty list when local Supabase is unavailable outside production", async () => {
  const response = await handlePublicListingsGet(
    new Request("http://localhost:3000/api/public/listings?limit=6"),
    createDependencies({
      rpc: () => ({
        data: null,
        error: {
          code: "",
          message: "TypeError: fetch failed",
        },
      }),
      tableRead: {
        listings: [],
        images: [],
        listingsError: {
          code: "",
          message: "TypeError: fetch failed",
        },
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    data: {
      items: [],
      limit: 6,
      offset: 0,
    },
  });
});

test("public listings route keeps unexpected table fallback errors as server errors", async () => {
  const response = await handlePublicListingsGet(
    new Request("http://localhost:3000/api/public/listings?limit=6"),
    createDependencies({
      rpc: () => ({
        data: null,
        error: {
          code: "XX000",
          message: "unexpected rpc failure",
        },
      }),
      tableRead: {
        listings: [],
        images: [],
        listingsError: {
          code: "42501",
          message: "permission denied",
        },
      },
    }),
  );

  assert.equal(response.status, 500);
  assert.equal((await response.json()).error, "Public read RPC failed");
});

test("public listing filters route calls get_public_listing_filters RPC and returns success envelope", async () => {
  const calls: Array<{ functionName: string; args: Record<string, unknown> }> = [];
  const response = await handlePublicListingFiltersGet(
    publicListingFiltersRequest(),
    createDependencies({
      rpc: (functionName, args) => {
        calls.push({ functionName, args });
        return {
          data: {
            cities: [
              {
                value: "Kayseri",
                label: "Kayseri",
                count: 12,
              },
            ],
            districts: [
              {
                city: "Kayseri",
                value: "Melikgazi",
                label: "Melikgazi",
                count: 7,
              },
            ],
            priceRange: {
              min: 25000,
              max: 3250000,
            },
            areaRange: {
              min: 80,
              max: 240,
            },
          },
          error: null,
        };
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [
    {
      functionName: "get_public_listing_filters",
      args: {},
    },
  ]);
  assert.deepEqual(await response.json(), {
    success: true,
    data: {
      cities: [
        {
          value: "Kayseri",
          label: "Kayseri",
          count: 12,
        },
      ],
      districts: [
        {
          city: "Kayseri",
          value: "Melikgazi",
          label: "Melikgazi",
          count: 7,
        },
      ],
      priceRange: {
        min: 25000,
        max: 3250000,
      },
      areaRange: {
        min: 80,
        max: 240,
      },
    },
  });
});

test("public listing filters route returns empty filter state from RPC", async () => {
  const response = await handlePublicListingFiltersGet(
    publicListingFiltersRequest(),
    createDependencies({
      rpc: () => ({
        data: {
          cities: [],
          districts: [],
          priceRange: {
            min: null,
            max: null,
          },
          areaRange: {
            min: null,
            max: null,
          },
        },
        error: null,
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    data: {
      cities: [],
      districts: [],
      priceRange: {
        min: null,
        max: null,
      },
      areaRange: {
        min: null,
        max: null,
      },
    },
  });
});

test("public listing filters route maps RPC errors to public read error style", async () => {
  const response = await handlePublicListingFiltersGet(
    publicListingFiltersRequest(),
    createDependencies({
      rpc: () => ({
        data: null,
        error: {
          code: "42501",
          message: "permission denied",
        },
      }),
    }),
  );

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Public read RPC failed",
  });
});

test("public listing detail route maps not found RPC error to 404", async () => {
  const response = await handlePublicListingDetailGet(
    new Request("http://localhost:3000/api/public/listings/11111111-1111-4111-8111-111111111111"),
    createDependencies({
      rpc: () => ({
        data: null,
        error: {
          code: "P0002",
          message: "listing not found",
        },
      }),
    }),
    { listingId: "11111111-1111-4111-8111-111111111111" },
  );

  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "Listing not found");
});

test("public listing services route rejects invalid listing id", async () => {
  const response = await handlePublicListingServicesGet(
    new Request("http://localhost:3000/api/public/listings/not-a-uuid/services"),
    createDependencies({
      rpc: () => {
        throw new Error("rpc should not run for invalid listing id");
      },
    }),
    { listingId: "not-a-uuid" },
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Invalid listing id");
});

test("admin reservations route rejects unauthenticated requests", async () => {
  const response = await handleAdminReservationsGet(
    new Request("http://localhost:3000/api/admin/read/reservations"),
    createDependencies({
      userId: null,
      rpc: () => {
        throw new Error("rpc should not run without auth");
      },
    }),
  );

  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "Authentication required");
});

test("admin reservations route fails closed when profile lookup fails", async () => {
  const response = await handleAdminReservationsGet(
    new Request("http://localhost:3000/api/admin/read/reservations"),
    createDependencies({
      profileError: {
        code: "57014",
        message: "statement timeout",
      },
      rpc: () => {
        throw new Error("rpc should not run when profile lookup fails");
      },
    }),
  );

  assert.equal(response.status, 500);
  assert.equal((await response.json()).error, "Admin profile lookup failed");
});

test("admin reservations route rejects non-admin users", async () => {
  const response = await handleAdminReservationsGet(
    new Request("http://localhost:3000/api/admin/read/reservations"),
    createDependencies({
      getProfileRole: () => "user",
      rpc: () => {
        throw new Error("rpc should not run for non-admin users");
      },
    }),
  );

  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "Admin role required");
});

test("admin reservations route calls list_admin_reservations RPC", async () => {
  const calls: Array<{ functionName: string; args: Record<string, unknown> }> = [];
  const response = await handleAdminReservationsGet(
    new Request("http://localhost:3000/api/admin/read/reservations?status=pending&limit=5&offset=1"),
    createDependencies({
      rpc: (functionName, args) => {
        calls.push({ functionName, args });
        return {
          data: {
            items: [],
            limit: 5,
            offset: 1,
          },
          error: null,
        };
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [
    {
      functionName: "list_admin_reservations",
      args: {
        p_status: "pending",
        p_queue: null,
        p_limit: 5,
        p_offset: 1,
      },
    },
  ]);

  calls.length = 0;
  const paymentWaitingResponse = await handleAdminReservationsGet(
    new Request("http://localhost:3000/api/admin/read/reservations?queue=payment_waiting&limit=10&offset=20"),
    createDependencies({
      rpc: (functionName, args) => {
        calls.push({ functionName, args });
        return {
          data: {
            items: [],
            limit: 10,
            offset: 20,
          },
          error: null,
        };
      },
    }),
  );

  assert.equal(paymentWaitingResponse.status, 200);
  assert.deepEqual(calls, [
    {
      functionName: "list_admin_reservations",
      args: {
        p_status: null,
        p_queue: "payment_waiting",
        p_limit: 10,
        p_offset: 20,
      },
    },
  ]);
});

test("admin reservations route validates queue and passes it to list_admin_reservations RPC", async () => {
  const invalidResponse = await handleAdminReservationsGet(
    new Request("http://localhost:3000/api/admin/read/reservations?queue=nope"),
    createDependencies({
      rpc: () => {
        throw new Error("rpc should not run for invalid queue");
      },
    }),
  );

  assert.equal(invalidResponse.status, 400);
  assert.equal((await invalidResponse.json()).error, "Invalid query parameter: queue");

  const calls: Array<{ functionName: string; args: Record<string, unknown> }> = [];
  const response = await handleAdminReservationsGet(
    new Request("http://localhost:3000/api/admin/read/reservations?queue=payment_issues&limit=10&offset=20"),
    createDependencies({
      rpc: (functionName, args) => {
        calls.push({ functionName, args });
        return {
          data: {
            items: [],
            limit: 10,
            offset: 20,
          },
          error: null,
        };
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [
    {
      functionName: "list_admin_reservations",
      args: {
        p_status: null,
        p_queue: "payment_issues",
        p_limit: 10,
        p_offset: 20,
      },
    },
  ]);
});

test("admin orders route calls list_admin_orders RPC", async () => {
  const calls: Array<{ functionName: string; args: Record<string, unknown> }> = [];
  const response = await handleAdminOrdersGet(
    new Request("http://localhost:3000/api/admin/read/orders?status=completed"),
    createDependencies({
      rpc: (functionName, args) => {
        calls.push({ functionName, args });
        return {
          data: {
            items: [],
            limit: 20,
            offset: 0,
          },
          error: null,
        };
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [
    {
      functionName: "list_admin_orders",
      args: {
        p_status: "completed",
        p_limit: 20,
        p_offset: 0,
      },
    },
  ]);
});

test("admin payments route calls list_admin_payments RPC", async () => {
  const calls: Array<{ functionName: string; args: Record<string, unknown> }> = [];
  const response = await handleAdminPaymentsGet(
    new Request("http://localhost:3000/api/admin/read/payments?status=succeeded"),
    createDependencies({
      rpc: (functionName, args) => {
        calls.push({ functionName, args });
        return {
          data: {
            items: [],
            limit: 20,
            offset: 0,
          },
          error: null,
        };
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [
    {
      functionName: "list_admin_payments",
      args: {
        p_status: "succeeded",
        p_limit: 20,
        p_offset: 0,
      },
    },
  ]);
});

test("admin payment events route validates payment id query and calls RPC", async () => {
  const invalidResponse = await handleAdminPaymentEventsGet(
    new Request("http://localhost:3000/api/admin/read/payment-events?paymentId=not-a-uuid"),
    createDependencies({
      rpc: () => {
        throw new Error("rpc should not run for invalid payment id");
      },
    }),
  );

  assert.equal(invalidResponse.status, 400);
  assert.equal((await invalidResponse.json()).error, "Invalid query parameter: paymentId");

  const calls: Array<{ functionName: string; args: Record<string, unknown> }> = [];
  const validResponse = await handleAdminPaymentEventsGet(
    new Request("http://localhost:3000/api/admin/read/payment-events?paymentId=11111111-1111-4111-8111-111111111111&limit=50"),
    createDependencies({
      rpc: (functionName, args) => {
        calls.push({ functionName, args });
        return {
          data: {
            items: [],
            limit: 50,
            offset: 0,
          },
          error: null,
        };
      },
    }),
  );

  assert.equal(validResponse.status, 200);
  assert.deepEqual(calls, [
    {
      functionName: "list_admin_payment_events",
      args: {
        p_payment_id: "11111111-1111-4111-8111-111111111111",
        p_limit: 50,
        p_offset: 0,
      },
    },
  ]);
});

test("admin audit route validates filters and calls list_admin_audit_events RPC", async () => {
  const invalidResponse = await handleAdminAuditEventsGet(
    new Request("http://localhost:3000/api/admin/audit?entityId=not-a-uuid"),
    createDependencies({
      rpc: () => {
        throw new Error("rpc should not run for invalid audit filters");
      },
    }),
  );

  assert.equal(invalidResponse.status, 400);
  assert.equal((await invalidResponse.json()).error, "Invalid query parameter: entityId");

  const calls: Array<{ functionName: string; args: Record<string, unknown> }> = [];
  const response = await handleAdminAuditEventsGet(
    new Request("http://localhost:3000/api/admin/audit?entityType=reservation&entityId=eeeeeeee-ffff-4fff-8fff-fffffffff101&actorId=aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb101&action=admin_request_documents&from=2026-05-01T00:00:00.000Z&to=2026-05-08T00:00:00.000Z&limit=10&offset=5"),
    createDependencies({
      rpc: (functionName, args) => {
        calls.push({ functionName, args });
        return {
          data: {
            items: [
              {
                id: "66666666-7777-4777-8777-777777777101",
                source: "admin_workflow",
                action: "admin_request_documents",
                entity_type: "reservation",
                entity_id: "eeeeeeee-ffff-4fff-8fff-fffffffff101",
                actor_type: "admin",
                actor_id: "aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb101",
                summary: "Belgeler istendi",
                created_at: "2026-05-05T10:00:00.000Z",
              },
            ],
            limit: 10,
            offset: 5,
          },
          error: null,
        };
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [
    {
      functionName: "list_admin_audit_events",
      args: {
        p_entity_type: "reservation",
        p_entity_id: "eeeeeeee-ffff-4fff-8fff-fffffffff101",
        p_actor_id: "aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb101",
        p_action: "admin_request_documents",
        p_from: "2026-05-01T00:00:00.000Z",
        p_to: "2026-05-08T00:00:00.000Z",
        p_limit: 10,
        p_offset: 5,
      },
    },
  ]);
  assert.doesNotMatch(JSON.stringify(await response.json()), /payload|token|SECRET|raw_callback_body/i);
});

function publicListingsRequest(query: Record<string, string>): Request {
  const search = new URLSearchParams(query);
  const suffix = search.size > 0 ? `?${search.toString()}` : "";
  return new Request(`http://localhost:3000/api/public/listings${suffix}`);
}

function publicListingFiltersRequest(): Request {
  return new Request("http://localhost:3000/api/public/listing-filters");
}

function createDependencies(options: {
  userId?: string | null;
  getProfileRole?: () => string | null;
  profileError?: { code?: string | null; message?: string | null } | null;
  tableRead?: {
    listings: unknown[];
    images: unknown[];
    listingsError?: { code?: string | null; message?: string | null } | null;
    imagesError?: { code?: string | null; message?: string | null } | null;
  };
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => { data: unknown; error: { code?: string | null; message?: string | null } | null };
}): ReadModelRouteDependencies {
  return {
    createServerSupabaseClient: async () => ({
      auth: {
        getUser: async () => ({
          data: {
            user: options.userId === null
              ? null
              : { id: options.userId ?? "55555555-5555-4555-8555-555555555555" },
          },
          error: null,
        }),
      },
      from: (table: string) => createTableMock(table, options),
      rpc: async (functionName: string, args: Record<string, unknown>) =>
        options.rpc(functionName, args),
    }),
  };
}

function createTableMock(
  table: string,
  options: {
    getProfileRole?: () => string | null;
    profileError?: { code?: string | null; message?: string | null } | null;
    tableRead?: {
      listings: unknown[];
      images: unknown[];
      listingsError?: { code?: string | null; message?: string | null } | null;
      imagesError?: { code?: string | null; message?: string | null } | null;
    };
  },
) {
  if (table === "profiles") {
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: options.profileError
              ? null
              : {
                  role: options.getProfileRole?.() ?? "admin",
                },
            error: options.profileError ?? null,
          }),
        }),
      }),
    };
  }

  if (table === "listings") {
    return {
      select: () => createListingsQuery(options.tableRead?.listings ?? [], options.tableRead?.listingsError ?? null),
    };
  }

  if (table === "listing_images") {
    return {
      select: () => createListingImagesQuery(options.tableRead?.images ?? [], options.tableRead?.imagesError ?? null),
    };
  }

  throw new Error(`unexpected table: ${table}`);
}

function createListingsQuery(
  rows: unknown[],
  error: { code?: string | null; message?: string | null } | null,
) {
  const filters: Array<(row: unknown) => boolean> = [];
  const query = {
    eq: (column: string, value: unknown) => {
      filters.push((row) => readMockField(row, column) === value);
      return query;
    },
    ilike: (column: string, pattern: string) => {
      const search = pattern.replaceAll("%", "").toLowerCase();
      filters.push((row) => String(readMockField(row, column) ?? "").toLowerCase().includes(search));
      return query;
    },
    gte: (column: string, value: number) => {
      filters.push((row) => Number(readMockField(row, column)) >= value);
      return query;
    },
    lte: (column: string, value: number) => {
      filters.push((row) => Number(readMockField(row, column)) <= value);
      return query;
    },
    order: () => query,
    range: async () => ({
      data: error ? null : rows.filter((row) => filters.every((filter) => filter(row))),
      error,
    }),
  };
  return query;
}

function createListingImagesQuery(
  rows: unknown[],
  error: { code?: string | null; message?: string | null } | null,
) {
  const query = {
    in: () => query,
    order: () => query,
    range: async () => ({
      data: error ? null : rows,
      error,
    }),
  };
  return query;
}

function readMockField(row: unknown, key: string): unknown {
  return typeof row === "object" && row !== null && key in row
    ? (row as Record<string, unknown>)[key]
    : null;
}
