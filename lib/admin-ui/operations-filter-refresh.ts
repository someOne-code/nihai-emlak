import type { OperationsFilterState } from "./operations-filters.ts";

type TimerHandle = ReturnType<typeof globalThis.setTimeout>;

type OperationsFilterRefreshControllerOptions = {
  delayMs: number;
  loadData: (selectedReservationId?: string | null) => void;
  setTimeout?: (callback: () => void, delayMs: number) => TimerHandle;
  clearTimeout?: (handle: TimerHandle) => void;
};

export function createOperationsFilterRefreshController({
  delayMs,
  loadData,
  setTimeout = globalThis.setTimeout.bind(globalThis),
  clearTimeout = globalThis.clearTimeout.bind(globalThis),
}: OperationsFilterRefreshControllerOptions) {
  let pendingTimer: TimerHandle | null = null;

  const cancelPending = () => {
    if (pendingTimer === null) {
      return;
    }

    clearTimeout(pendingTimer);
    pendingTimer = null;
  };

  return {
    applyFilterChange(
      next: OperationsFilterState,
      prev: OperationsFilterState,
      selectedReservationId?: string | null,
    ) {
      if (isSearchOnlyChange(next, prev)) {
        cancelPending();
        return;
      }

      if (!hasBackendFilterChange(next, prev)) {
        return;
      }

      if (next.queue !== prev.queue) {
        cancelPending();
        pendingTimer = setTimeout(() => {
          pendingTimer = null;
          loadData(selectedReservationId);
        }, delayMs);
        return;
      }

      cancelPending();
      loadData(selectedReservationId);
    },
    cancelPending,
  };
}

function isSearchOnlyChange(next: OperationsFilterState, prev: OperationsFilterState): boolean {
  return next.search !== prev.search
    && next.queue === prev.queue
    && next.reservationStatus === prev.reservationStatus
    && next.paymentStatus === prev.paymentStatus;
}

function hasBackendFilterChange(next: OperationsFilterState, prev: OperationsFilterState): boolean {
  return next.queue !== prev.queue
    || next.reservationStatus !== prev.reservationStatus
    || next.paymentStatus !== prev.paymentStatus;
}
