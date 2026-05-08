import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSaleLeadsViewModel,
  type RawSaleLead,
} from "../lib/admin-ui/sale-leads-view-model.ts";

test("buildSaleLeadsViewModel maps raw rows to admin-safe labels", () => {
  const model = buildSaleLeadsViewModel({ leads: [rawLead()] });

  assert.equal(model.rows.length, 1);
  assert.equal(model.rows[0].leadId, "22222222-2222-4222-8222-222222222222");
  assert.equal(model.rows[0].listingTitle, "Moda Residence");
  assert.equal(model.rows[0].locationLabel, "Istanbul / Kadikoy");
  assert.equal(model.rows[0].contactName, "Ada User");
  assert.equal(model.rows[0].statusLabel, "Yeni");
  assert.equal(model.rows[0].conversationHref, "/admin/communications?conversation=33333333-3333-4333-8333-333333333333");
});

test("buildSaleLeadsViewModel falls back safely for missing joined data", () => {
  const model = buildSaleLeadsViewModel({
    leads: [
      rawLead({
        contact_name: " ",
        contact_email: null,
        contact_phone: null,
        listings: null,
        profiles: null,
        chatwoot_conversation_id: null,
      }),
    ],
  });

  assert.equal(model.rows[0].listingTitle, "Bilinmeyen Ilan");
  assert.equal(model.rows[0].locationLabel, "Konum yok");
  assert.notEqual(model.rows[0].locationLabel, model.rows[0].listingId);
  assert.equal(model.rows[0].contactName, null);
  assert.equal(model.rows[0].conversationHref, null);
});

function rawLead(overrides: Partial<RawSaleLead> = {}): RawSaleLead {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    listing_id: "11111111-1111-4111-8111-111111111111",
    user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    contact_name: "Ada User",
    contact_email: "ada@example.com",
    contact_phone: "+905551112233",
    message: "Bu ilanla ilgileniyorum ve detaylari konusmak istiyorum.",
    status: "new",
    created_at: "2026-05-05T09:00:00Z",
    updated_at: "2026-05-05T10:00:00Z",
    chatwoot_conversation_id: "33333333-3333-4333-8333-333333333333",
    listings: {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Moda Residence",
      city: "Istanbul",
      district: "Kadikoy",
      type: "sale",
    },
    profiles: {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      full_name: "Ada User",
      email: "ada@example.com",
    },
    ...overrides,
  };
}
