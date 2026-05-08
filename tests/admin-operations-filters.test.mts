import assert from "node:assert/strict";
import test from "node:test";

import {
  applyFilters,
  INITIAL_FILTER_STATE,
  toBackendFilters,
  type OperationsFilterState,
} from "../lib/admin-ui/operations-filters.ts";
import type { OperationsOverviewRow } from "../lib/admin-ui/operations-view-model.ts";

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<OperationsOverviewRow> = {}): OperationsOverviewRow {
  return {
    reservationId: "res-1",
    listingId: "lst-1",
    listingTitle: "Test Daire",
    locationLabel: "Istanbul / Kadikoy",
    reservationStatus: "Beklemede",
    orderId: "ord-1",
    orderStatus: "Beklemede",
    paymentId: "pay-1",
    paymentStatus: "Beklemede",
    amountLabel: "1.000 TRY",
    moveInDate: "2026-06-01",
    stayMonthsLabel: "3 ay",
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

test("applyFilters returns all rows when filters are at initial state", () => {
  const rows = [makeRow(), makeRow({ reservationId: "res-2" })];
  const result = applyFilters(rows, INITIAL_FILTER_STATE);
  assert.equal(result.length, 2);
});

test("applyFilters filters by search on listingTitle", () => {
  const rows = [
    makeRow({ listingTitle: "Deniz Manzarali" }),
    makeRow({ reservationId: "res-2", listingTitle: "Sehir Merkezi" }),
  ];
  const filters: OperationsFilterState = { ...INITIAL_FILTER_STATE, search: "deniz" };
  const result = applyFilters(rows, filters);
  assert.equal(result.length, 1);
  assert.equal(result[0].listingTitle, "Deniz Manzarali");
});

test("applyFilters filters by search on reservationId", () => {
  const rows = [
    makeRow({ reservationId: "abc-123" }),
    makeRow({ reservationId: "xyz-789" }),
  ];
  const filters: OperationsFilterState = { ...INITIAL_FILTER_STATE, search: "abc" };
  const result = applyFilters(rows, filters);
  assert.equal(result.length, 1);
  assert.equal(result[0].reservationId, "abc-123");
});

test("applyFilters filters by search on locationLabel", () => {
  const rows = [
    makeRow({ locationLabel: "Ankara / Cankaya" }),
    makeRow({ reservationId: "res-2", locationLabel: "Izmir / Alsancak" }),
  ];
  const filters: OperationsFilterState = { ...INITIAL_FILTER_STATE, search: "ankara" };
  const result = applyFilters(rows, filters);
  assert.equal(result.length, 1);
  assert.equal(result[0].locationLabel, "Ankara / Cankaya");
});

test("applyFilters filters by reservationStatus using backend enum value", () => {
  const rows = [
    makeRow({ reservationStatus: "Beklemede" }),
    makeRow({ reservationId: "res-2", reservationStatus: "Onayland\u0131" }),
  ];
  const filters: OperationsFilterState = { ...INITIAL_FILTER_STATE, reservationStatus: "confirmed" };
  const result = applyFilters(rows, filters);
  assert.equal(result.length, 1);
  assert.equal(result[0].reservationId, "res-2");
});

test("applyFilters filters by paymentStatus using backend enum value", () => {
  const rows = [
    makeRow({ paymentStatus: "Ba\u015far\u0131l\u0131" }),
    makeRow({ reservationId: "res-2", paymentStatus: "Uyu\u015fmazl\u0131k" }),
  ];
  const filters: OperationsFilterState = { ...INITIAL_FILTER_STATE, paymentStatus: "conflict" };
  const result = applyFilters(rows, filters);
  assert.equal(result.length, 1);
  assert.equal(result[0].reservationId, "res-2");
});

test("applyFilters combines search and status filters using backend enums", () => {
  const rows = [
    makeRow({ listingTitle: "Deniz Daire", reservationStatus: "Beklemede", paymentStatus: "Ba\u015far\u0131l\u0131" }),
    makeRow({ reservationId: "res-2", listingTitle: "Deniz Villa", reservationStatus: "Onayland\u0131", paymentStatus: "Ba\u015far\u0131l\u0131" }),
    makeRow({ reservationId: "res-3", listingTitle: "Orman Evi", reservationStatus: "Beklemede", paymentStatus: "Beklemede" }),
  ];
  const filters: OperationsFilterState = {
    search: "deniz",
    reservationStatus: "pending",
    paymentStatus: "all",
  };
  const result = applyFilters(rows, filters);
  assert.equal(result.length, 1);
  assert.equal(result[0].listingTitle, "Deniz Daire");
});

test("applyFilters returns empty array when no rows match", () => {
  const rows = [makeRow({ reservationStatus: "Beklemede" })];
  const filters: OperationsFilterState = { ...INITIAL_FILTER_STATE, reservationStatus: "confirmed" };
  // "confirmed" maps to "Onaylandı" which doesn't match "Beklemede"
  const result = applyFilters(rows, filters);
  assert.equal(result.length, 0);
});

test("toBackendFilters converts filter state to backend enum format", () => {
  const filters: OperationsFilterState = {
    search: "test",
    queue: "payment_issues",
    reservationStatus: "pending",
    paymentStatus: "succeeded",
  };
  const backend = toBackendFilters(filters);
  assert.equal(backend.reservationQueue, "payment_issues");
  assert.equal(backend.reservationStatus, "pending");
  assert.equal(backend.paymentStatus, "succeeded");
});

test("toBackendFilters omits 'all' values", () => {
  const backend = toBackendFilters(INITIAL_FILTER_STATE);
  assert.equal(backend.reservationStatus, undefined);
  assert.equal(backend.paymentStatus, undefined);
});

test("applyFilters handles 'Yok' payment status with backend enum", () => {
  const rows = [
    makeRow({ paymentStatus: "Yok" }),
    makeRow({ reservationId: "res-2", paymentStatus: "Ba\u015far\u0131l\u0131" }),
  ];
  const filters: OperationsFilterState = { ...INITIAL_FILTER_STATE, paymentStatus: "succeeded" };
  const result = applyFilters(rows, filters);
  assert.equal(result.length, 1);
  assert.equal(result[0].reservationId, "res-2");
});

test("INITIAL_FILTER_STATE has expected default values with backend enum keys", () => {
  assert.equal(INITIAL_FILTER_STATE.search, "");
  assert.equal(INITIAL_FILTER_STATE.reservationStatus, "all");
  assert.equal(INITIAL_FILTER_STATE.paymentStatus, "all");
});
