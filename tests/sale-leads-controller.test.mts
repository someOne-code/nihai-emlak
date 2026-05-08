import assert from "node:assert/strict";
import test from "node:test";

import {
  loadSaleLeadsModel,
  updateSaleLeadStatusFromController,
} from "../lib/admin-ui/sale-leads-controller.ts";

test("loadSaleLeadsModel builds a view model from client data", async () => {
  const result = await loadSaleLeadsModel({
    fetcher: async () =>
      Response.json({
        success: true,
        data: {
          leads: [
            {
              id: "22222222-2222-4222-8222-222222222222",
              listing_id: "11111111-1111-4111-8111-111111111111",
              user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              contact_name: "Ada",
              contact_email: null,
              contact_phone: null,
              message: "Bu ilanla ilgileniyorum",
              status: "new",
              created_at: "2026-05-05T09:00:00Z",
              updated_at: "2026-05-05T10:00:00Z",
              chatwoot_conversation_id: null,
              listings: { id: "11111111-1111-4111-8111-111111111111", title: "Moda", city: null, district: null, type: "sale" },
              profiles: null,
            },
          ],
        },
      }),
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.viewModel.rows.length, 1);
    assert.equal(result.viewModel.rows[0].statusLabel, "Yeni");
  }
});

test("updateSaleLeadStatusFromController maps client errors", async () => {
  const result = await updateSaleLeadStatusFromController(
    "22222222-2222-4222-8222-222222222222",
    "called",
    null,
    {
      fetcher: async () =>
        Response.json(
          { success: false, error: "Admin role required" },
          { status: 403 },
        ),
    },
  );

  assert.deepEqual(result, {
    ok: false,
    error: "Admin role required",
    status: 403,
  });
});
