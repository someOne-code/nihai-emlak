import assert from "node:assert/strict";
import test from "node:test";

import {
  AdminOperationsClientError,
  cancelReservationWorkflow,
  confirmReservationWorkflow,
  fetchListingWorkflowSnapshot,
  fetchReservationWorkflowSnapshot,
  loadAdminOperationsOverview,
  reopenListingWorkflow,
} from "../lib/admin-ui/operations-client.ts";

test("operations overview loader fetches pending reservations, orders, and payments", async () => {
  const calls: Array<{ url: string; method: string }> = [];
  const overview = await loadAdminOperationsOverview({
    fetcher: async (input, init) => {
      calls.push({
        url: String(input),
        method: init?.method ?? "GET",
      });

      if (String(input).includes("/reservations?")) {
        return jsonResponse({
          success: true,
          data: {
            items: [{ id: "reservation-1" }],
            limit: 20,
            offset: 0,
          },
        });
      }

      if (String(input).includes("/orders?")) {
        return jsonResponse({
          success: true,
          data: {
            items: [{ id: "order-1" }],
            limit: 100,
            offset: 0,
          },
        });
      }

      if (String(input).includes("/payments?")) {
        return jsonResponse({
          success: true,
          data: {
            items: [{ id: "payment-1" }],
            limit: 100,
            offset: 0,
          },
        });
      }

      throw new Error(`Unexpected URL: ${String(input)}`);
    },
  });

  assert.deepEqual(calls, [
    {
      url: "/api/admin/read/reservations?status=pending&limit=20&offset=0",
      method: "GET",
    },
    {
      url: "/api/admin/read/orders?limit=100&offset=0",
      method: "GET",
    },
    {
      url: "/api/admin/read/payments?limit=100&offset=0",
      method: "GET",
    },
  ]);
  assert.deepEqual(overview.reservations.items, [{ id: "reservation-1" }]);
  assert.deepEqual(overview.orders.items, [{ id: "order-1" }]);
  assert.deepEqual(overview.payments.items, [{ id: "payment-1" }]);
});

test("operations snapshot loaders use exact workflow snapshot URLs", async () => {
  const calls: string[] = [];
  const reservation = await fetchReservationWorkflowSnapshot(
    "11111111-1111-4111-8111-111111111111",
    {
      fetcher: async (input) => {
        calls.push(String(input));
        return jsonResponse({
          success: true,
          data: { reservation: { id: "11111111-1111-4111-8111-111111111111" } },
        });
      },
    },
  );
  const listing = await fetchListingWorkflowSnapshot(
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    {
      fetcher: async (input) => {
        calls.push(String(input));
        return jsonResponse({
          success: true,
          data: { listing: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } },
        });
      },
    },
  );

  assert.deepEqual(calls, [
    "/api/admin/workflows/reservations/11111111-1111-4111-8111-111111111111/snapshot",
    "/api/admin/workflows/listings/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/snapshot",
  ]);
  assert.deepEqual(reservation, {
    reservation: { id: "11111111-1111-4111-8111-111111111111" },
  });
  assert.deepEqual(listing, {
    listing: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
  });
});

test("operations workflow helpers post exact action bodies", async () => {
  const calls: Array<{ url: string; method: string; headers: Record<string, string>; body: unknown }> = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    calls.push({
      url: String(input),
      method: init?.method ?? "GET",
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });

    return jsonResponse({
      success: true,
      data: { result: "ok" },
    });
  };

  await cancelReservationWorkflow(
    "11111111-1111-4111-8111-111111111111",
    { reason: "customer_withdrew", note: "changed plans" },
    { fetcher },
  );
  await confirmReservationWorkflow(
    "11111111-1111-4111-8111-111111111111",
    { note: "documents completed" },
    { fetcher },
  );
  await reopenListingWorkflow(
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    { reason: "reservation_cancelled", note: null },
    { fetcher },
  );

  assert.deepEqual(calls, [
    {
      url: "/api/admin/workflows/reservations/11111111-1111-4111-8111-111111111111/cancel",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: { reason: "customer_withdrew", note: "changed plans" },
    },
    {
      url: "/api/admin/workflows/reservations/11111111-1111-4111-8111-111111111111/confirm",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: { note: "documents completed" },
    },
    {
      url: "/api/admin/workflows/listings/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/reopen",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: { reason: "reservation_cancelled", note: null },
    },
  ]);
});

test("operations client sends same-origin credentials and disables fetch cache", async () => {
  const calls: Array<{ url: string; credentials: RequestCredentials | undefined; cache: RequestCache | undefined }> = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    calls.push({
      url: String(input),
      credentials: init?.credentials,
      cache: init?.cache,
    });

    return jsonResponse({
      success: true,
      data: { result: "ok" },
    });
  };

  await fetchReservationWorkflowSnapshot(
    "11111111-1111-4111-8111-111111111111",
    { fetcher },
  );
  await cancelReservationWorkflow(
    "11111111-1111-4111-8111-111111111111",
    { reason: "customer_withdrew" },
    { fetcher },
  );

  assert.deepEqual(calls, [
    {
      url: "/api/admin/workflows/reservations/11111111-1111-4111-8111-111111111111/snapshot",
      credentials: "same-origin",
      cache: "no-store",
    },
    {
      url: "/api/admin/workflows/reservations/11111111-1111-4111-8111-111111111111/cancel",
      credentials: "same-origin",
      cache: "no-store",
    },
  ]);
});

test("operations client throws typed errors for failed envelopes", async () => {
  await assert.rejects(
    () =>
      fetchReservationWorkflowSnapshot("11111111-1111-4111-8111-111111111111", {
        fetcher: async () =>
          jsonResponse({
            success: false,
            error: "Admin role required",
          }, 403),
      }),
    (error: unknown) => {
      assert.ok(error instanceof AdminOperationsClientError);
      assert.equal(error.message, "Admin role required");
      assert.equal(error.status, 403);
      return true;
    },
  );
});

test("operations client fails closed when HTTP status is unsuccessful", async () => {
  await assert.rejects(
    () =>
      fetchReservationWorkflowSnapshot("11111111-1111-4111-8111-111111111111", {
        fetcher: async () =>
          jsonResponse({
            success: true,
            data: { reservation: { id: "11111111-1111-4111-8111-111111111111" } },
          }, 500),
      }),
    (error: unknown) => {
      assert.ok(error instanceof AdminOperationsClientError);
      assert.equal(error.message, "Admin operation request failed");
      assert.equal(error.status, 500);
      return true;
    },
  );
});

test("operations client throws generic typed errors for invalid response envelopes", async () => {
  await assert.rejects(
    () =>
      fetchReservationWorkflowSnapshot("11111111-1111-4111-8111-111111111111", {
        fetcher: async () => new Response("not-json", { status: 200 }),
      }),
    (error: unknown) => {
      assert.ok(error instanceof AdminOperationsClientError);
      assert.equal(error.message, "Invalid admin operation response");
      assert.equal(error.status, 200);
      return true;
    },
  );

  await assert.rejects(
    () =>
      fetchReservationWorkflowSnapshot("11111111-1111-4111-8111-111111111111", {
        fetcher: async () => jsonResponse({ data: { leaked: true } }),
      }),
    (error: unknown) => {
      assert.ok(error instanceof AdminOperationsClientError);
      assert.equal(error.message, "Invalid admin operation response");
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
