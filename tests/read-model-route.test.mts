import assert from "node:assert/strict";
import test from "node:test";

import {
  handleAdminAuditEventsGet,
  handleAdminOrdersGet,
  handleAdminPaymentEventsGet,
  handleAdminPaymentsGet,
  handleAdminReservationsGet,
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
  const query = {
    eq: () => query,
    order: () => query,
    range: async () => ({
      data: error ? null : rows,
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
