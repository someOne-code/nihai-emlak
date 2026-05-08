import assert from "node:assert/strict";
import test from "node:test";

import {
  AdminOperationsClientError,
  cancelReservationWorkflow,
  confirmReservationWorkflow,
  fetchListingWorkflowSnapshot,
  fetchReservationDocumentTracking,
  fetchReservationEventHistory,
  fetchReservationFinanceOps,
  fetchReservationWorkflowSnapshot,
  loadAdminOperationsOverview,
  loadAdminPaymentEvents,
  reopenListingWorkflow,
  updateReservationDocumentTracking,
  updateReservationFinanceOps,
} from "../lib/admin-ui/operations-client.ts";

test("operations overview loader fetches all reservations when no filter is given", async () => {
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
      url: "/api/admin/read/reservations?limit=20&offset=0",
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

test("operations overview loader sends reservationStatus filter to backend", async () => {
  const calls: Array<{ url: string }> = [];
  await loadAdminOperationsOverview({
    fetcher: async (input) => {
      calls.push({ url: String(input) });
      return jsonResponse({ success: true, data: { items: [], limit: 20, offset: 0 } });
    },
  }, { reservationStatus: "confirmed" });

  const reservationUrl = calls.find((c) => c.url.includes("/reservations?"));
  assert.ok(reservationUrl);
  assert.match(reservationUrl.url, /status=confirmed/);
});

test("operations overview loader sends paymentStatus filter to backend", async () => {
  const calls: Array<{ url: string }> = [];
  await loadAdminOperationsOverview({
    fetcher: async (input) => {
      calls.push({ url: String(input) });
      return jsonResponse({ success: true, data: { items: [], limit: 20, offset: 0 } });
    },
  }, { paymentStatus: "failed" });

  const paymentUrl = calls.find((c) => c.url.includes("/payments?"));
  assert.ok(paymentUrl);
  assert.match(paymentUrl.url, /status=failed/);
});

test("operations overview loader omits status param when filter is 'all'", async () => {
  const calls: Array<{ url: string }> = [];
  await loadAdminOperationsOverview({
    fetcher: async (input) => {
      calls.push({ url: String(input) });
      return jsonResponse({ success: true, data: { items: [], limit: 20, offset: 0 } });
    },
  }, { reservationStatus: "all", paymentStatus: "all" });

  const reservationUrl = calls.find((c) => c.url.includes("/reservations?"))?.url ?? "";
  const paymentUrl = calls.find((c) => c.url.includes("/payments?"))?.url ?? "";
  assert.doesNotMatch(reservationUrl, /status=/);
  assert.doesNotMatch(paymentUrl, /status=/);
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

test("operations document tracking helpers use exact workflow URL and body", async () => {
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
      data: {
        reservation_id: "11111111-1111-4111-8111-111111111111",
        document_status: "waiting",
      },
    });
  };

  await fetchReservationDocumentTracking(
    "11111111-1111-4111-8111-111111111111",
    { fetcher },
  );
  await updateReservationDocumentTracking(
    "11111111-1111-4111-8111-111111111111",
    { status: "completed", note: "documents verified" },
    { fetcher },
  );

  assert.deepEqual(calls, [
    {
      url: "/api/admin/workflows/reservations/11111111-1111-4111-8111-111111111111/documents",
      method: "GET",
      headers: {},
      body: null,
    },
    {
      url: "/api/admin/workflows/reservations/11111111-1111-4111-8111-111111111111/documents",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: { status: "completed", note: "documents verified" },
    },
  ]);
});

test("operations finance ops helpers use exact workflow URL and body", async () => {
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
      data: {
        reservation_id: "11111111-1111-4111-8111-111111111111",
        finance_status: "refund_required",
      },
    });
  };

  await fetchReservationFinanceOps(
    "11111111-1111-4111-8111-111111111111",
    { fetcher },
  );
  await updateReservationFinanceOps(
    "11111111-1111-4111-8111-111111111111",
    { status: "refund_requested", note: "bank panel request opened" },
    { fetcher },
  );

  assert.deepEqual(calls, [
    {
      url: "/api/admin/workflows/reservations/11111111-1111-4111-8111-111111111111/finance",
      method: "GET",
      headers: {},
      body: null,
    },
    {
      url: "/api/admin/workflows/reservations/11111111-1111-4111-8111-111111111111/finance",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: { status: "refund_requested", note: "bank panel request opened" },
    },
  ]);
});

test("operations event history helper uses exact workflow URL", async () => {
  const calls: Array<{ url: string; method: string }> = [];
  const result = await fetchReservationEventHistory(
    "11111111-1111-4111-8111-111111111111",
    {
      fetcher: async (input, init) => {
        calls.push({
          url: String(input),
          method: init?.method ?? "GET",
        });
        return jsonResponse({
          success: true,
          data: {
            items: [
              {
                workflow_name: "admin_mark_documents_completed",
                created_at: "2026-05-07T16:00:00.000Z",
              },
            ],
          },
        });
      },
    },
  );

  assert.deepEqual(calls, [
    {
      url: "/api/admin/workflows/reservations/11111111-1111-4111-8111-111111111111/events",
      method: "GET",
    },
  ]);
  assert.deepEqual(result, {
    items: [
      {
        workflow_name: "admin_mark_documents_completed",
        created_at: "2026-05-07T16:00:00.000Z",
      },
    ],
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
    { refundDecision: "manual_refund", note: "changed plans" },
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
      body: { refundDecision: "manual_refund", note: "changed plans" },
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

test("loadAdminPaymentEvents sends correct URL with paymentId, limit, offset", async () => {
  const calls: Array<{ url: string; credentials: RequestCredentials | undefined; cache: RequestCache | undefined }> = [];
  const result = await loadAdminPaymentEvents(
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    {
      fetcher: async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({
          url: String(input),
          credentials: init?.credentials,
          cache: init?.cache,
        });
        return jsonResponse({
          success: true,
          data: {
            items: [{ id: "event-1", workflow_name: "payment_callback" }],
            limit: 20,
            offset: 0,
          },
        });
      },
    },
  );

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/api\/admin\/read\/payment-events\?/);
  assert.match(calls[0].url, /paymentId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/);
  assert.match(calls[0].url, /limit=20/);
  assert.match(calls[0].url, /offset=0/);
  assert.equal(calls[0].credentials, "same-origin");
  assert.equal(calls[0].cache, "no-store");
  assert.deepEqual((result as Record<string, unknown>).items, [
    { id: "event-1", workflow_name: "payment_callback" },
  ]);
});

test("loadAdminPaymentEvents throws typed error on failure", async () => {
  await assert.rejects(
    () =>
      loadAdminPaymentEvents("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", {
        fetcher: async () =>
          jsonResponse({ success: false, error: "Admin role required" }, 403),
      }),
    (error: unknown) => {
      assert.ok(error instanceof AdminOperationsClientError);
      assert.equal(error.message, "Admin role required");
      assert.equal(error.status, 403);
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
