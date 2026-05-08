import type {
  SaleLeadStatus,
  SaleLeadsOverviewRow,
} from "./sale-leads-view-model.ts";

export type SaleLeadStatusFilter = "actionable" | "all" | SaleLeadStatus;

export type SaleLeadsFilterState = {
  search: string;
  status: SaleLeadStatusFilter;
};

export const SALE_LEADS_INITIAL_FILTER_STATE: SaleLeadsFilterState = {
  search: "",
  status: "actionable",
};

export type { SaleLeadsOverviewRow };

export function applySaleLeadFilters(
  rows: SaleLeadsOverviewRow[],
  filters: SaleLeadsFilterState,
): SaleLeadsOverviewRow[] {
  let filtered = rows;

  const search = filters.search.trim().toLowerCase();
  if (search.length > 0) {
    filtered = filtered.filter((row) => matchesSearch(row, search));
  }

  if (filters.status === "actionable") {
    filtered = filtered.filter((row) => row.status === "new" || row.status === "called");
  } else if (filters.status !== "all") {
    filtered = filtered.filter((row) => row.status === filters.status);
  }

  return filtered;
}

function matchesSearch(row: SaleLeadsOverviewRow, query: string): boolean {
  const fields = [
    row.leadId,
    row.listingId,
    row.userId,
    row.listingTitle,
    row.locationLabel,
    row.contactName,
    row.contactEmail,
    row.contactPhone,
    row.messagePreview,
  ];

  return fields.some(
    (value) => typeof value === "string" && value.toLowerCase().includes(query),
  );
}
