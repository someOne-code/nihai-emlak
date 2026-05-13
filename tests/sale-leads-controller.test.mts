import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  applySaleLeadStatusMutation,
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

test("updateSaleLeadStatusFromController returns mutation payload for local refresh", async () => {
  const result = await updateSaleLeadStatusFromController(
    "22222222-2222-4222-8222-222222222222",
    "called",
    null,
    {
      fetcher: async () =>
        Response.json({
          success: true,
          data: {
            lead: {
              id: "22222222-2222-4222-8222-222222222222",
              status: "called",
              updated_at: "2026-05-13T10:00:00Z",
            },
          },
        }),
    },
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.lead, {
      id: "22222222-2222-4222-8222-222222222222",
      status: "called",
      updated_at: "2026-05-13T10:00:00Z",
    });
  }
});

test("applySaleLeadStatusMutation updates the row from mutation payload", () => {
  const rows = [
    {
      leadId: "22222222-2222-4222-8222-222222222222",
      listingId: "11111111-1111-4111-8111-111111111111",
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      listingTitle: "Moda",
      locationLabel: "Istanbul / Kadikoy",
      contactName: "Ada",
      contactEmail: null,
      contactPhone: null,
      messagePreview: "Bu ilanla ilgileniyorum",
      status: "new" as const,
      statusLabel: "Yeni",
      createdAt: "2026-05-05T09:00:00Z",
      updatedAt: "2026-05-05T10:00:00Z",
      conversationHref: null,
    },
  ];

  const next = applySaleLeadStatusMutation(
    rows,
    {
      id: "22222222-2222-4222-8222-222222222222",
      status: "called",
      updated_at: "2026-05-13T10:00:00Z",
    },
    "called",
  );

  assert.equal(next.length, 1);
  assert.equal(next[0].status, "called");
  assert.equal(next[0].statusLabel, "Arandi");
  assert.equal(next[0].updatedAt, "2026-05-13T10:00:00Z");
  assert.equal(next[0].listingTitle, "Moda");
});

test("sale leads page applies status mutation without reloading the overview", () => {
  const source = readFileSync(
    resolve(import.meta.dirname, "..", "components/admin-sale-leads/SaleLeadsView.tsx"),
    "utf-8",
  );

  assert.match(source, /applySaleLeadStatusMutation/);
  assert.match(source, /setRows\(\(current\) =>/);
  assert.doesNotMatch(source, /await loadData\(\);/);
});
