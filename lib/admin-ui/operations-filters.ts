import type { OperationsOverviewFilters } from "./operations-client.ts";
import type { OperationsOverviewRow, OperationsQueueId } from "./operations-view-model.ts";

export type OperationsFilterState = {
  search: string;
  queue: OperationsQueueId;
  reservationStatus: string;
  paymentStatus: string;
};

export const INITIAL_FILTER_STATE: OperationsFilterState = {
  search: "",
  queue: "all",
  reservationStatus: "all",
  paymentStatus: "all",
};

const BACKEND_TO_TURKISH: Record<string, string> = {
  pending: "Beklemede",
  confirmed: "Onayland\u0131",
  succeeded: "Ba\u015far\u0131l\u0131",
  completed: "Tamamland\u0131",
  cancelled: "\u0130ptal edildi",
  failed: "Ba\u015far\u0131s\u0131z",
  refunded: "\u0130ade edildi",
  conflict: "Uyu\u015fmazl\u0131k",
  expired: "S\u00fcresi doldu",
};

export function applyFilters(
  rows: OperationsOverviewRow[],
  filters: OperationsFilterState,
): OperationsOverviewRow[] {
  let filtered = rows;

  if (filters.search) {
    const q = filters.search.toLowerCase();
    filtered = filtered.filter(
      (row) =>
        (row.primaryStatus && row.primaryStatus.toLowerCase().includes(q)) ||
        row.listingTitle.toLowerCase().includes(q) ||
        row.reservationId.toLowerCase().includes(q) ||
        (row.orderId && row.orderId.toLowerCase().includes(q)) ||
        (row.paymentId && row.paymentId.toLowerCase().includes(q)) ||
        (row.locationLabel && row.locationLabel.toLowerCase().includes(q)),
    );
  }

  if ((filters.queue ?? "all") !== "all") {
    filtered = filtered.filter((row) => row.queue === filters.queue);
  }

  if (filters.reservationStatus !== "all") {
    const turkishLabel = BACKEND_TO_TURKISH[filters.reservationStatus] ?? filters.reservationStatus;
    filtered = filtered.filter((row) => row.reservationStatus === turkishLabel);
  }

  if (filters.paymentStatus !== "all") {
    const turkishLabel = BACKEND_TO_TURKISH[filters.paymentStatus] ?? filters.paymentStatus;
    filtered = filtered.filter((row) => row.paymentStatus === turkishLabel);
  }

  return filtered;
}

export function toBackendFilters(
  filters: OperationsFilterState,
): OperationsOverviewFilters {
  return {
    reservationQueue: filters.queue !== "all" ? filters.queue : undefined,
    reservationStatus: filters.reservationStatus !== "all" ? filters.reservationStatus as OperationsOverviewFilters["reservationStatus"] : undefined,
    paymentStatus: filters.paymentStatus !== "all" ? filters.paymentStatus as OperationsOverviewFilters["paymentStatus"] : undefined,
  };
}
