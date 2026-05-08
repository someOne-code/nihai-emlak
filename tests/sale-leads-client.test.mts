import assert from "node:assert/strict";
import test from "node:test";

import {
  AdminSaleLeadsClientError,
  loadAdminSaleLeadsOverview,
  updateSaleLeadStatus,
} from "../lib/admin-ui/sale-leads-client.ts";

test("loadAdminSaleLeadsOverview reads success envelope", async () => {
  const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];

  const data = await loadAdminSaleLeadsOverview({
    fetcher: async (input, init) => {
      requests.push({ input, init });
      return Response.json({ success: true, data: { leads: [] } });
    },
  });

  assert.deepEqual(data, { leads: [] });
  assert.equal(requests[0].input, "/api/admin/sale-leads");
  assert.equal(requests[0].init?.credentials, "same-origin");
  assert.equal(requests[0].init?.cache, "no-store");
});

test("loadAdminSaleLeadsOverview sends server-side filters as query params", async () => {
  const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];

  await loadAdminSaleLeadsOverview({
    filters: {
      status: "actionable",
      search: "Ada",
      limit: 25,
      offset: 50,
    },
    fetcher: async (input, init) => {
      requests.push({ input, init });
      return Response.json({ success: true, data: { leads: [] } });
    },
  });

  assert.equal(
    requests[0].input,
    "/api/admin/sale-leads?status=actionable&search=Ada&limit=25&offset=50",
  );
});

test("updateSaleLeadStatus posts typed status update payload", async () => {
  const bodies: unknown[] = [];

  await updateSaleLeadStatus("22222222-2222-4222-8222-222222222222", "called", "Arandi", {
    fetcher: async (_input, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return Response.json({ success: true, data: { lead: { id: "lead" } } });
    },
  });

  assert.deepEqual(bodies, [
    {
      lead_id: "22222222-2222-4222-8222-222222222222",
      status: "called",
      note: "Arandi",
    },
  ]);
});

test("updateSaleLeadStatus returns typed error on failed envelope", async () => {
  await assert.rejects(
    () =>
      updateSaleLeadStatus("22222222-2222-4222-8222-222222222222", "called", null, {
        fetcher: async () =>
          Response.json(
            { success: false, error: "Admin role required" },
            { status: 403 },
          ),
      }),
    (error) => {
      assert.equal(error instanceof AdminSaleLeadsClientError, true);
      assert.equal((error as AdminSaleLeadsClientError).status, 403);
      assert.equal((error as Error).message, "Admin role required");
      return true;
    },
  );
});
