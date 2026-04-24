import assert from "node:assert/strict";
import test from "node:test";

import {
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
        p_limit: 5,
        p_offset: 1,
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

function createDependencies(options: {
  userId?: string | null;
  getProfileRole?: () => string | null;
  profileError?: { code?: string | null; message?: string | null } | null;
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
      from: () => ({
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
      }),
      rpc: async (functionName: string, args: Record<string, unknown>) =>
        options.rpc(functionName, args),
    }),
  };
}
