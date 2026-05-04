import assert from "node:assert/strict";
import test from "node:test";

import {
  AdminDashboardClientError,
  fetchAdminDashboardSummary,
} from "../lib/admin-ui/dashboard-client.ts";

test("dashboard client fetches the summary endpoint and returns summary data", async () => {
  const calls: Array<{
    url: string;
    method: string;
    credentials: RequestCredentials | undefined;
    cache: RequestCache | undefined;
  }> = [];

  const summary = await fetchAdminDashboardSummary({
    fetcher: async (input, init) => {
      calls.push({
        url: String(input),
        method: init?.method ?? "GET",
        credentials: init?.credentials,
        cache: init?.cache,
      });

      return jsonResponse({
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
    },
  });

  assert.deepEqual(calls, [
    {
      url: "/api/admin/dashboard/summary",
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    },
  ]);
  assert.equal(summary.listingTotal, 12);
  assert.equal(summary.communicationItems, null);
});

test("dashboard client throws typed errors for failed envelopes", async () => {
  await assert.rejects(
    () =>
      fetchAdminDashboardSummary({
        fetcher: async () =>
          jsonResponse(
            {
              success: false,
              error: "Admin role required",
            },
            403,
          ),
      }),
    (error: unknown) => {
      assert.ok(error instanceof AdminDashboardClientError);
      assert.equal(error.message, "Admin role required");
      assert.equal(error.status, 403);
      return true;
    },
  );
});

test("dashboard client fails closed when HTTP status is unsuccessful", async () => {
  await assert.rejects(
    () =>
      fetchAdminDashboardSummary({
        fetcher: async () =>
          jsonResponse(
            {
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
            },
            500,
          ),
      }),
    (error: unknown) => {
      assert.ok(error instanceof AdminDashboardClientError);
      assert.equal(error.message, "Admin dashboard request failed");
      assert.equal(error.status, 500);
      return true;
    },
  );
});

test("dashboard client throws generic typed errors for invalid JSON responses", async () => {
  await assert.rejects(
    () =>
      fetchAdminDashboardSummary({
        fetcher: async () => new Response("not-json", { status: 200 }),
      }),
    (error: unknown) => {
      assert.ok(error instanceof AdminDashboardClientError);
      assert.equal(error.message, "Invalid admin dashboard response");
      assert.equal(error.status, 200);
      return true;
    },
  );
});

test("dashboard client throws generic typed errors for invalid envelopes", async () => {
  await assert.rejects(
    () =>
      fetchAdminDashboardSummary({
        fetcher: async () => jsonResponse({ data: { leaked: true } }),
      }),
    (error: unknown) => {
      assert.ok(error instanceof AdminDashboardClientError);
      assert.equal(error.message, "Invalid admin dashboard response");
      assert.equal(error.status, 200);
      return true;
    },
  );
});

function jsonResponse(payload: unknown, status = 200): Response {
  return Response.json(payload, {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}
