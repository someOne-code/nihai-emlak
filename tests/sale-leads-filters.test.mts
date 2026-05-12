import assert from "node:assert/strict";
import test from "node:test";

import {
  SALE_LEADS_INITIAL_FILTER_STATE,
  applySaleLeadFilters,
  buildSaleLeadsBackendFilters,
  hasSaleLeadsBackendFilterChange,
  type SaleLeadsOverviewRow,
} from "../lib/admin-ui/sale-leads-filters.ts";

test("initial sale lead filter state shows actionable new leads", () => {
  assert.deepEqual(SALE_LEADS_INITIAL_FILTER_STATE, {
    search: "",
    status: "actionable",
  });
});

test("applySaleLeadFilters matches search text across listing and contact fields", () => {
  const rows = [
    makeRow({ listingTitle: "Moda Residence", contactName: "Ada" }),
    makeRow({ leadId: "33333333-3333-4333-8333-333333333333", listingTitle: "Bostanci", contactName: "Bora" }),
  ];

  const result = applySaleLeadFilters(rows, { search: "moda", status: "all" });

  assert.equal(result.length, 1);
  assert.equal(result[0].listingTitle, "Moda Residence");
});

test("applySaleLeadFilters combines search and status filters", () => {
  const rows = [
    makeRow({ listingTitle: "Moda Residence", status: "new" }),
    makeRow({ listingTitle: "Moda Residence", status: "closed" }),
  ];

  const result = applySaleLeadFilters(rows, { search: "moda", status: "actionable" });

  assert.equal(result.length, 1);
  assert.equal(result[0].status, "new");
});

test("buildSaleLeadsBackendFilters omits search so typing filters local rows only", () => {
  assert.deepEqual(
    buildSaleLeadsBackendFilters({ search: "moda", status: "actionable" }),
    { status: "actionable" },
  );
});

test("hasSaleLeadsBackendFilterChange ignores search-only changes", () => {
  assert.equal(
    hasSaleLeadsBackendFilterChange(
      { search: "", status: "actionable" },
      { search: "m", status: "actionable" },
    ),
    false,
  );
  assert.equal(
    hasSaleLeadsBackendFilterChange(
      { search: "m", status: "actionable" },
      { search: "m", status: "all" },
    ),
    true,
  );
});

function makeRow(overrides: Partial<SaleLeadsOverviewRow> = {}): SaleLeadsOverviewRow {
  return {
    leadId: "22222222-2222-4222-8222-222222222222",
    listingId: "11111111-1111-4111-8111-111111111111",
    userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    listingTitle: "Moda Residence",
    locationLabel: "Istanbul / Kadikoy",
    contactName: "Ada User",
    contactEmail: "ada@example.com",
    contactPhone: "+905551112233",
    messagePreview: "Bu ilanla ilgileniyorum",
    status: "new",
    statusLabel: "Yeni",
    createdAt: "2026-05-05T09:00:00Z",
    updatedAt: "2026-05-05T10:00:00Z",
    conversationHref: null,
    ...overrides,
  };
}
