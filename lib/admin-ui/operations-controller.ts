import {
  cancelReservationWorkflow,
  confirmReservationWorkflow,
  fetchReservationDocumentTracking,
  fetchReservationEventHistory,
  fetchReservationFinanceOps,
  fetchListingWorkflowSnapshot,
  fetchReservationWorkflowSnapshot,
  loadAdminOperationsOverview,
  loadAdminPaymentEvents,
  reopenListingWorkflow,
  updateReservationDocumentTracking,
  updateReservationFinanceOps,
  type AdminOperationsOverview,
  type OperationsOverviewFilters,
} from "./operations-client.ts";
import {
  buildOperationsViewModel,
  type OperationsActionId,
  type OperationsViewModel,
} from "./operations-view-model.ts";

type OperationsLoaderDependencies = {
  fetchListingWorkflowSnapshot: (listingId: string) => Promise<unknown>;
  fetchReservationDocumentTracking: (reservationId: string) => Promise<unknown>;
  fetchReservationEventHistory?: (reservationId: string) => Promise<unknown>;
  fetchReservationFinanceOps: (reservationId: string) => Promise<unknown>;
  fetchReservationWorkflowSnapshot: (reservationId: string) => Promise<unknown>;
  loadAdminOperationsOverview: (options?: Record<string, never>, filters?: OperationsOverviewFilters) => Promise<AdminOperationsOverview>;
  loadAdminPaymentEvents: (paymentId: string) => Promise<unknown>;
};

type OperationsActionDependencies = {
  cancelReservationWorkflow: typeof cancelReservationWorkflow;
  confirmReservationWorkflow: typeof confirmReservationWorkflow;
  reopenListingWorkflow: typeof reopenListingWorkflow;
  updateReservationDocumentTracking: typeof updateReservationDocumentTracking;
  updateReservationFinanceOps: typeof updateReservationFinanceOps;
};

export type OperationsDocumentStatus = "requested" | "waiting" | "completed" | "failed";
export type OperationsFinanceStatus =
  | "refund_required"
  | "refund_requested"
  | "refund_completed"
  | "deposit_forfeited"
  | "manual_resolution_required"
  | "conflict_payment"
  | "issue_resolved"
  | "payment_not_received";

export type OperationsActionInput = {
  actionId: OperationsActionId;
  refundDecision?: "manual_refund" | "no_refund";
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
  fetchReservationDocumentTracking,
  fetchReservationEventHistory,
  fetchReservationFinanceOps,
  fetchReservationWorkflowSnapshot,
  loadAdminOperationsOverview,
  loadAdminPaymentEvents,
};

const DEFAULT_ACTION_DEPENDENCIES: OperationsActionDependencies = {
  cancelReservationWorkflow,
  confirmReservationWorkflow,
  reopenListingWorkflow,
  updateReservationDocumentTracking,
  updateReservationFinanceOps,
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
  filters?: OperationsOverviewFilters,
  cachedOverview?: AdminOperationsOverview,
): Promise<OperationsViewModel> {
  const overview = cachedOverview ?? await dependencies.loadAdminOperationsOverview(undefined, filters);
  const selectedId = getSelectedReservationIdFromOverview(overview, selectedReservationId);
  let reservationSnapshot: unknown = null;
  let documentTracking: unknown = null;
  let financeOps: unknown = null;
  let eventHistory: unknown = null;
  let listingSnapshot: unknown = null;

  if (selectedId) {
    const listingIdFromOverview = getListingIdFromOverview(overview, selectedId);
    const results = await Promise.allSettled([
      dependencies.fetchReservationWorkflowSnapshot(selectedId),
      dependencies.fetchReservationDocumentTracking(selectedId),
      dependencies.fetchReservationFinanceOps(selectedId),
      dependencies.fetchReservationEventHistory?.(selectedId) ?? Promise.resolve({ items: [] }),
      listingIdFromOverview
        ? dependencies.fetchListingWorkflowSnapshot(listingIdFromOverview)
        : Promise.resolve(null),
    ]);

    reservationSnapshot = results[0].status === "fulfilled" ? results[0].value : null;
    documentTracking = results[1].status === "fulfilled" ? results[1].value : null;
    financeOps = results[2].status === "fulfilled" ? results[2].value : null;
    eventHistory = results[3].status === "fulfilled" ? results[3].value : null;
    listingSnapshot = results[4].status === "fulfilled" ? results[4].value : null;

    if (!listingSnapshot) {
      const listingId = getListingId(reservationSnapshot);
      if (listingId) {
        try {
          listingSnapshot = await dependencies.fetchListingWorkflowSnapshot(listingId);
        } catch {
          // Listing snapshot is non-critical; continue without it.
        }
      }
    }
  }

  return buildOperationsViewModel({
    actionPending: null,
    listingSnapshot,
    documentTracking,
    eventHistory,
    financeOps,
    overview,
    reservationSnapshot,
    selectedReservationId: selectedId,
  });
}

export async function updateOperationsFinanceOps(
  dependencies: OperationsActionDependencies = DEFAULT_ACTION_DEPENDENCIES,
  input: {
    selectedReservationId: string | null;
    status: OperationsFinanceStatus;
    noteText: string;
  },
): Promise<OperationsActionResult> {
  if (!input.selectedReservationId) {
    throw new AdminOperationsActionValidationError("Seçili rezervasyon bulunamadı.");
  }

  const note = normalizeOptionalText(input.noteText);
  if (input.status === "refund_completed" && !note) {
    throw new AdminOperationsActionValidationError("İade tamamlandı notu zorunludur.");
  }
  if (input.status === "deposit_forfeited" && !note) {
    throw new AdminOperationsActionValidationError("İade reddi notu zorunludur.");
  }
  if (
    (input.status === "manual_resolution_required" ||
      input.status === "conflict_payment" ||
      input.status === "issue_resolved" ||
      input.status === "payment_not_received") &&
    !note
  ) {
    throw new AdminOperationsActionValidationError("Ödeme sorunu notu zorunludur.");
  }

  await dependencies.updateReservationFinanceOps(input.selectedReservationId, {
    status: input.status,
    note,
  });

  return {
    message: `Finans kararı güncellendi: ${formatFinanceStatusLabel(input.status)}`,
    refreshReservationId: input.selectedReservationId,
  };
}

export async function updateOperationsDocumentTracking(
  dependencies: OperationsActionDependencies = DEFAULT_ACTION_DEPENDENCIES,
  input: {
    selectedReservationId: string | null;
    status: OperationsDocumentStatus;
    noteText: string;
  },
): Promise<OperationsActionResult> {
  if (!input.selectedReservationId) {
    throw new AdminOperationsActionValidationError("Seçili rezervasyon bulunamadı.");
  }

  const note = normalizeOptionalText(input.noteText);
  if (input.status === "failed" && !note) {
    throw new AdminOperationsActionValidationError("Eksik/başarısız belge notu zorunludur.");
  }
  if (input.status === "completed" && !note) {
    throw new AdminOperationsActionValidationError("Belgeler tamamlandı notu zorunludur.");
  }

  await dependencies.updateReservationDocumentTracking(input.selectedReservationId, {
    status: input.status,
    note,
  });

  return {
    message: `Belge takibi güncellendi: ${formatDocumentStatusLabel(input.status)}`,
    refreshReservationId: input.selectedReservationId,
  };
}

export async function executeOperationsAction(
  dependencies: OperationsActionDependencies = DEFAULT_ACTION_DEPENDENCIES,
  input: OperationsActionInput,
): Promise<OperationsActionResult> {
  const reason = normalizeOptionalText(input.reasonText);
  const note = normalizeOptionalText(input.noteText);

  if (input.actionId === "cancel") {
    if (!input.refundDecision) {
      throw new AdminOperationsActionValidationError("İade durumu seçilmelidir.");
    }
    if (!note) {
      throw new AdminOperationsActionValidationError("İptal notu zorunludur.");
    }
  }

  if (input.actionId === "reopen" && !reason) {
    throw new AdminOperationsActionValidationError("Sebep alanı boş bırakılamaz.");
  }

  if (input.actionId === "cancel" && input.selectedReservationId) {
    await dependencies.cancelReservationWorkflow(input.selectedReservationId, {
      refundDecision: input.refundDecision ?? "no_refund",
      note: note ?? "",
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
    throw new AdminOperationsActionValidationError("Seçili kayıt bu aksiyon için uygun değil.");
  }

  return {
    message: `İşlem başarıyla tamamlandı: ${formatActionLabel(input.actionId)}`,
    refreshReservationId: input.selectedReservationId,
  };
}

function getSelectedReservationIdFromOverview(
  overview: AdminOperationsOverview,
  selectedReservationId?: string | null,
): string | null {
  if (!selectedReservationId) {
    return null;
  }

  return overview.reservations.items
    .filter(isRecord)
    .some((item) => asString(item.id) === selectedReservationId)
    ? selectedReservationId
    : null;
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

function formatDocumentStatusLabel(status: OperationsDocumentStatus): string {
  const map: Record<OperationsDocumentStatus, string> = {
    requested: "Belge istendi",
    waiting: "Belge bekleniyor",
    completed: "Belgeler tamamlandı",
    failed: "Eksik/başarısız",
  };
  return map[status];
}

function formatFinanceStatusLabel(status: OperationsFinanceStatus): string {
  const map: Record<OperationsFinanceStatus, string> = {
    refund_required: "İade gerekli",
    refund_requested: "Manuel iade bekliyor",
    refund_completed: "İade tamamlandı",
    deposit_forfeited: "Kapora iade edilmeyecek",
    manual_resolution_required: "Ödeme sorunu",
    conflict_payment: "Ödeme sorunu",
    issue_resolved: "Ödeme sorunu çözüldü",
    payment_not_received: "Ödeme alınmadı",
  };
  return map[status];
}

function formatActionLabel(actionId: OperationsActionId): string {
  const map: Record<OperationsActionId, string> = {
    cancel: "İptal et",
    confirm: "Sözleşmeyi tamamla",
    reopen: "İlanı yeniden aç",
  };
  return map[actionId];
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
