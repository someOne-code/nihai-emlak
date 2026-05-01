import {
  cancelReservationWorkflow,
  confirmReservationWorkflow,
  fetchListingWorkflowSnapshot,
  fetchReservationWorkflowSnapshot,
  loadAdminOperationsOverview,
  reopenListingWorkflow,
  type AdminOperationsOverview,
} from "./operations-client.ts";
import {
  buildOperationsViewModel,
  type OperationsActionId,
  type OperationsViewModel,
} from "./operations-view-model.ts";

type OperationsLoaderDependencies = {
  fetchListingWorkflowSnapshot: (listingId: string) => Promise<unknown>;
  fetchReservationWorkflowSnapshot: (reservationId: string) => Promise<unknown>;
  loadAdminOperationsOverview: () => Promise<AdminOperationsOverview>;
};

type OperationsActionDependencies = {
  cancelReservationWorkflow: typeof cancelReservationWorkflow;
  confirmReservationWorkflow: typeof confirmReservationWorkflow;
  reopenListingWorkflow: typeof reopenListingWorkflow;
};

export type OperationsActionInput = {
  actionId: OperationsActionId;
  noteText: string;
  reasonText: string;
  selectedListingId: string | null;
  selectedReservationId: string | null;
};

export type OperationsActionResult = {
  message: string;
  refreshReservationId: string | null;
};

const DEFAULT_LOADER_DEPENDENCIES: OperationsLoaderDependencies = {
  fetchListingWorkflowSnapshot,
  fetchReservationWorkflowSnapshot,
  loadAdminOperationsOverview,
};

const DEFAULT_ACTION_DEPENDENCIES: OperationsActionDependencies = {
  cancelReservationWorkflow,
  confirmReservationWorkflow,
  reopenListingWorkflow,
};

export class AdminOperationsActionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminOperationsActionValidationError";
  }
}

export async function loadOperationsModel(
  dependencies: OperationsLoaderDependencies = DEFAULT_LOADER_DEPENDENCIES,
  selectedReservationId?: string | null,
): Promise<OperationsViewModel> {
  const overview = await dependencies.loadAdminOperationsOverview();
  const selectedId = selectedReservationId ?? getFirstReservationId(overview);
  let reservationSnapshot: unknown = null;
  let listingSnapshot: unknown = null;

  if (selectedId) {
    reservationSnapshot = await dependencies.fetchReservationWorkflowSnapshot(selectedId);
    const listingId = getListingId(reservationSnapshot) ?? getListingIdFromOverview(overview, selectedId);

    if (listingId) {
      listingSnapshot = await dependencies.fetchListingWorkflowSnapshot(listingId);
    }
  }

  return buildOperationsViewModel({
    actionPending: null,
    listingSnapshot,
    overview,
    reservationSnapshot,
    selectedReservationId: selectedId,
  });
}

export async function executeOperationsAction(
  dependencies: OperationsActionDependencies = DEFAULT_ACTION_DEPENDENCIES,
  input: OperationsActionInput,
): Promise<OperationsActionResult> {
  const reason = normalizeOptionalText(input.reasonText);
  const note = normalizeOptionalText(input.noteText);

  if ((input.actionId === "cancel" || input.actionId === "reopen") && !reason) {
    throw new AdminOperationsActionValidationError("Sebep alani bos birakilamaz.");
  }

  if (input.actionId === "cancel" && input.selectedReservationId) {
    await dependencies.cancelReservationWorkflow(input.selectedReservationId, {
      reason: reason ?? "",
      note,
    });
  } else if (input.actionId === "confirm" && input.selectedReservationId) {
    await dependencies.confirmReservationWorkflow(input.selectedReservationId, {
      note,
    });
  } else if (input.actionId === "reopen" && input.selectedListingId) {
    await dependencies.reopenListingWorkflow(input.selectedListingId, {
      reason: reason ?? "",
      note,
    });
  } else {
    throw new AdminOperationsActionValidationError("Secili kayit bu aksiyon icin uygun degil.");
  }

  return {
    message: `Islem basariyla tamamlandi: ${input.actionId}`,
    refreshReservationId: input.selectedReservationId,
  };
}

function getFirstReservationId(overview: AdminOperationsOverview): string | null {
  const firstItem = overview.reservations.items[0];
  return isRecord(firstItem) ? asString(firstItem.id) : null;
}

function getListingIdFromOverview(
  overview: AdminOperationsOverview,
  reservationId: string,
): string | null {
  const reservation = overview.reservations.items
    .filter(isRecord)
    .find((item) => asString(item.id) === reservationId);

  return getListingId(reservation);
}

function getListingId(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  const nestedListing = value.listing;
  return asString(value.listing_id) ?? (isRecord(nestedListing) ? asString(nestedListing.id) : null);
}

function normalizeOptionalText(value: string): string | null {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return value.trim();
}
