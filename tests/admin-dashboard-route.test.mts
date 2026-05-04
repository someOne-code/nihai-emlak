import assert from "node:assert/strict";
import test from "node:test";

import {
  handleAdminDashboardSummaryGet,
  type AdminDashboardRouteDependencies,
} from "../lib/admin/dashboard-route.ts";

test("admin dashboard summary rejects unauthenticated requests", async () => {
  const response = await handleAdminDashboardSummaryGet(
    createGetRequest(),
    createDependencies({
      userId: null,
      rpc: () => {
        throw new Error("rpc should not run without auth");
      },
    }),
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Authentication required",
  });
});

test("admin dashboard summary rejects non-admin requests", async () => {
  const response = await handleAdminDashboardSummaryGet(
    createGetRequest(),
    createDependencies({
      profileRole: "editor",
      rpc: () => {
        throw new Error("rpc should not run for non-admin");
      },
    }),
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Admin role required",
  });
});

test("admin dashboard summary fails closed when profile lookup fails", async () => {
  const response = await handleAdminDashboardSummaryGet(
    createGetRequest(),
    createDependencies({
      profileError: { code: "57014", message: "statement timeout" },
      rpc: () => {
        throw new Error("rpc should not run when profile lookup fails");
      },
    }),
  );

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Admin profile lookup failed",
  });
});

test("admin dashboard summary returns sanitized no-store payload for admins", async () => {
  const calls: Array<{ functionName: string; args: Record<string, unknown> }> = [];

  const response = await handleAdminDashboardSummaryGet(
    createGetRequest(),
    createDependencies({
      rpc: (functionName, args) => {
        calls.push({ functionName, args });
        return {
          data: {
            listing_total: 12,
            listing_active: 8,
            listing_passive: 4,
            listing_without_images: 3,
            rent_listings_not_checkout_ready: 2,
            pending_reservations: 5,
            failed_or_conflict_payments: 1,
            manual_resolution_required: 0,
            communication_items: null,
            payment_payload: { raw: true },
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
      functionName: "admin_dashboard_summary",
      args: {},
    },
  ]);

  const payload = await response.json();
  assert.deepEqual(payload, {
    success: true,
    data: {
      listingTotal: 12,
      listingActive: 8,
      listingPassive: 4,
      listingWithoutImages: 3,
      rentListingsNotCheckoutReady: 2,
      pendingReservations: 5,
      failedOrConflictPayments: 1,
      manualResolutionRequired: 0,
      communicationItems: null,
    },
  });
});

test("admin dashboard summary returns null for missing metrics instead of fake values", async () => {
  const response = await handleAdminDashboardSummaryGet(
    createGetRequest(),
    createDependencies({
      rpc: () => ({
        data: {
          listing_total: 12,
          listing_active: 8,
          listing_passive: 4,
          listing_without_images: null,
          rent_listings_not_checkout_ready: null,
          pending_reservations: 5,
          failed_or_conflict_payments: 1,
          manual_resolution_required: null,
        },
        error: null,
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, {
    listingTotal: 12,
    listingActive: 8,
    listingPassive: 4,
    listingWithoutImages: null,
    rentListingsNotCheckoutReady: null,
    pendingReservations: 5,
    failedOrConflictPayments: 1,
    manualResolutionRequired: null,
    communicationItems: null,
  });
});

test("admin dashboard summary maps RPC failures to a safe generic error", async () => {
  const response = await handleAdminDashboardSummaryGet(
    createGetRequest(),
    createDependencies({
      rpc: () => ({
        data: null,
        error: {
          code: "XX000",
          message: "sensitive database failure details",
        },
      }),
    }),
  );

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Admin dashboard summary is unavailable",
  });
});

function createGetRequest(): Request {
  return new Request("http://localhost:3000/api/admin/dashboard/summary", {
    method: "GET",
  });
}

function createDependencies(options: {
  userId?: string | null;
  profileRole?: string | null;
  profileError?: { code?: string | null; message?: string | null } | null;
  rpc: (
    functionName: "admin_dashboard_summary",
    args: Record<string, unknown>,
  ) => {
    data: unknown;
    error: { code?: string | null; message?: string | null } | null;
  };
}): AdminDashboardRouteDependencies {
  return {
    createServerSupabaseClient: async () => ({
      auth: {
        getUser: async () => ({
          data: {
            user: options.userId === null
              ? null
              : { id: options.userId ?? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
          },
          error: null,
        }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: options.profileError ? null : { role: options.profileRole ?? "admin" },
              error: options.profileError ?? null,
            }),
          }),
        }),
      }),
      rpc: async (
        functionName: "admin_dashboard_summary",
        args: Record<string, unknown>,
      ) => options.rpc(functionName, args),
    }),
  };
}
