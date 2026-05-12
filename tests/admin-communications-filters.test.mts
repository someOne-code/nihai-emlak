import assert from "node:assert/strict";
import test from "node:test";

import {
  applyCommunicationsFilters,
  buildCommunicationsBackendFilters,
  COMMUNICATIONS_INITIAL_FILTER_STATE,
  hasCommunicationsBackendFilterChange,
  type CommunicationsFilterState,
} from "../lib/admin-ui/communications-filters.ts";
import type { CommunicationsOverviewRow } from "../lib/admin-ui/communications-view-model.ts";

function makeRow(overrides: Partial<CommunicationsOverviewRow> = {}): CommunicationsOverviewRow {
  return {
    conversationId: "conv-1",
    userId: "user-1",
    listingId: "list-1",
    listingTitle: "Deniz Daire",
    locationLabel: "Istanbul / Kadikoy",
    userName: "Ali Veli",
    userEmail: "ali@test.com",
    status: "ready",
    failureReason: null,
    chatwootConversationId: "cw-1",
    chatwootOpenHref: null,
    createdAt: "2026-05-01T10:00:00Z",
    updatedAt: "2026-05-01T10:30:00Z",
    ...overrides,
  };
}

test("default filter (issues) shows only provisioning and failed", () => {
  const rows = [
    makeRow({ conversationId: "a", status: "ready" }),
    makeRow({ conversationId: "b", status: "provisioning" }),
    makeRow({ conversationId: "c", status: "failed" }),
  ];

  const result = applyCommunicationsFilters(rows, COMMUNICATIONS_INITIAL_FILTER_STATE);

  assert.equal(result.length, 2);
  assert.deepEqual(result.map((r) => r.conversationId), ["b", "c"]);
});

test("status=all returns every row", () => {
  const rows = [
    makeRow({ conversationId: "a", status: "ready" }),
    makeRow({ conversationId: "b", status: "failed" }),
  ];

  const filters: CommunicationsFilterState = { search: "", status: "all" };
  const result = applyCommunicationsFilters(rows, filters);

  assert.equal(result.length, 2);
});

test("status=ready filters only ready", () => {
  const rows = [
    makeRow({ conversationId: "a", status: "ready" }),
    makeRow({ conversationId: "b", status: "failed" }),
  ];

  const filters: CommunicationsFilterState = { search: "", status: "ready" };
  const result = applyCommunicationsFilters(rows, filters);

  assert.equal(result.length, 1);
  assert.equal(result[0].conversationId, "a");
});

test("search matches listing title (case-insensitive)", () => {
  const rows = [
    makeRow({ conversationId: "a", listingTitle: "Deniz Daire", status: "ready" }),
    makeRow({ conversationId: "b", listingTitle: "Park Villa", status: "ready" }),
  ];

  const filters: CommunicationsFilterState = { search: "deniz", status: "all" };
  const result = applyCommunicationsFilters(rows, filters);

  assert.equal(result.length, 1);
  assert.equal(result[0].conversationId, "a");
});

test("search matches userName, userEmail, conversationId", () => {
  const rows = [
    makeRow({ conversationId: "abc", userName: "Ali", userEmail: "x@y.com", status: "ready" }),
    makeRow({ conversationId: "xyz", userName: "Veli", userEmail: "v@y.com", status: "ready" }),
  ];

  const filters: CommunicationsFilterState = { search: "abc", status: "all" };
  assert.equal(applyCommunicationsFilters(rows, filters).length, 1);

  const f2: CommunicationsFilterState = { search: "veli", status: "all" };
  assert.equal(applyCommunicationsFilters(rows, f2).length, 1);

  const f3: CommunicationsFilterState = { search: "x@y", status: "all" };
  assert.equal(applyCommunicationsFilters(rows, f3).length, 1);
});

test("search and status combine", () => {
  const rows = [
    makeRow({ conversationId: "a", listingTitle: "Deniz", status: "failed" }),
    makeRow({ conversationId: "b", listingTitle: "Deniz", status: "ready" }),
    makeRow({ conversationId: "c", listingTitle: "Park", status: "failed" }),
  ];

  const filters: CommunicationsFilterState = { search: "deniz", status: "failed" };
  const result = applyCommunicationsFilters(rows, filters);

  assert.equal(result.length, 1);
  assert.equal(result[0].conversationId, "a");
});

test("buildCommunicationsBackendFilters omits search so typing filters local rows only", () => {
  assert.deepEqual(
    buildCommunicationsBackendFilters({ search: "deniz", status: "issues" }),
    { status: "issues" },
  );
});

test("hasCommunicationsBackendFilterChange ignores search-only changes", () => {
  assert.equal(
    hasCommunicationsBackendFilterChange(
      { search: "", status: "issues" },
      { search: "d", status: "issues" },
    ),
    false,
  );
  assert.equal(
    hasCommunicationsBackendFilterChange(
      { search: "d", status: "issues" },
      { search: "d", status: "all" },
    ),
    true,
  );
});
