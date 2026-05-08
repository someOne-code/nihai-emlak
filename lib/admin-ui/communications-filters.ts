// Phase D: Communication Admin filter state and pure filter logic.
// Kept in a pure .ts module so the Node test runner can import it without
// requiring TSX support.

import type { CommunicationsOverviewRow } from "./communications-view-model.ts";

export type CommunicationsStatusFilter =
  | "issues"
  | "all"
  | "ready"
  | "provisioning"
  | "failed";

export type CommunicationsFilterState = {
  search: string;
  status: CommunicationsStatusFilter;
};

export const COMMUNICATIONS_INITIAL_FILTER_STATE: CommunicationsFilterState = {
  search: "",
  status: "issues",
};

export function applyCommunicationsFilters(
  rows: CommunicationsOverviewRow[],
  filters: CommunicationsFilterState,
): CommunicationsOverviewRow[] {
  let filtered = rows;

  const search = filters.search.trim().toLowerCase();
  if (search.length > 0) {
    filtered = filtered.filter((row) => matchesSearch(row, search));
  }

  if (filters.status === "issues") {
    filtered = filtered.filter(
      (row) => row.status === "provisioning" || row.status === "failed",
    );
  } else if (filters.status !== "all") {
    filtered = filtered.filter((row) => row.status === filters.status);
  }

  return filtered;
}

function matchesSearch(row: CommunicationsOverviewRow, query: string): boolean {
  if (row.listingTitle.toLowerCase().includes(query)) {
    return true;
  }
  if (row.conversationId.toLowerCase().includes(query)) {
    return true;
  }
  if (row.userName && row.userName.toLowerCase().includes(query)) {
    return true;
  }
  if (row.userEmail && row.userEmail.toLowerCase().includes(query)) {
    return true;
  }
  return false;
}
