type ListResult = {
  items: unknown[];
  limit: number;
  offset: number;
};

export type OperationsActionId = "cancel" | "confirm" | "reopen";

export type OperationsViewModelInput = {
  overview: {
    reservations: ListResult;
    orders: ListResult;
    payments: ListResult;
  };
  selectedReservationId?: string | null;
  reservationSnapshot?: unknown;
  listingSnapshot?: unknown;
  actionPending?: OperationsActionId | null;
};

export type OperationsActionViewModel = {
  id: OperationsActionId;
  label: string;
  enabled: boolean;
  disabledReason: string | null;
};

export type OperationsOverviewRow = {
  reservationId: string;
  listingId: string | null;
  listingTitle: string;
  locationLabel: string;
  reservationStatus: string;
  orderId: string | null;
  orderStatus: string;
  paymentId: string | null;
  paymentStatus: string;
  amountLabel: string;
  moveInDate: string;
  stayMonthsLabel: string;
};

export type OperationsViewModel = {
  rows: OperationsOverviewRow[];
  selectedReservationId: string | null;
  selectedListingId: string | null;
  reservationSnapshot: Record<string, unknown> | null;
  listingSnapshot: Record<string, unknown> | null;
  actions: OperationsActionViewModel[];
};

const ACTION_LABELS: Record<OperationsActionId, string> = {
  cancel: "Rezervasyonu iptal et",
  confirm: "Rezervasyonu onayla",
  reopen: "İlanı yeniden aç",
};

export function buildOperationsViewModel(input: OperationsViewModelInput): OperationsViewModel {
  const orders = input.overview.orders.items.filter(isRecord);
  const payments = input.overview.payments.items.filter(isRecord);
  const rows = input.overview.reservations.items
    .filter(isRecord)
    .map((reservation) => buildOverviewRow(reservation, orders, payments));

  const selectedRow =
    rows.find((row) => row.reservationId === input.selectedReservationId) ?? rows[0] ?? null;
  const reservationSnapshot = sanitizeReservationSnapshot(input.reservationSnapshot);
  const listingSnapshot = sanitizeListingSnapshot(input.listingSnapshot);
  const selectedListingId =
    asString(nestedRecord(reservationSnapshot, "listing")?.id) ??
    selectedRow?.listingId ??
    asString(nestedRecord(listingSnapshot, "listing")?.id);

  return {
    rows,
    selectedReservationId: selectedRow?.reservationId ?? null,
    selectedListingId,
    reservationSnapshot,
    listingSnapshot,
    actions: buildActions({
      reservationSnapshot,
      listingSnapshot,
      selectedListingId,
      actionPending: input.actionPending ?? null,
    }),
  };
}

function buildOverviewRow(
  reservation: Record<string, unknown>,
  orders: Record<string, unknown>[],
  payments: Record<string, unknown>[],
): OperationsOverviewRow {
  const reservationId = asString(reservation.id) ?? "";
  const listing = nestedRecord(reservation, "listing");
  const listingId = asString(reservation.listing_id) ?? asString(listing?.id);
  const order = orders.find((candidate) => asString(candidate.reservation_id) === reservationId) ?? null;
  const orderId = asString(order?.id);
  const payment = payments.find((candidate) => asString(candidate.order_id) === orderId) ?? null;
  const amount = asNumber(payment?.amount) ?? asNumber(order?.total_amount);
  const currency = asString(payment?.currency) ?? asString(order?.currency);

  return {
    reservationId,
    listingId,
    listingTitle: asString(listing?.title) ?? "İsimsiz ilan",
    locationLabel: [asString(listing?.city), asString(listing?.district)].filter(Boolean).join(" / "),
    reservationStatus: asString(reservation.status) ?? "unknown",
    orderId,
    orderStatus: asString(order?.status) ?? "Yok",
    paymentId: asString(payment?.id),
    paymentStatus: asString(payment?.status) ?? "Yok",
    amountLabel: formatAmount(amount, currency),
    moveInDate: asString(reservation.move_in_date) ?? "Belirtilmedi",
    stayMonthsLabel: formatStayMonths(asNumber(reservation.stay_months)),
  };
}

function buildActions(input: {
  reservationSnapshot: Record<string, unknown> | null;
  listingSnapshot: Record<string, unknown> | null;
  selectedListingId: string | null;
  actionPending: OperationsActionId | null;
}): OperationsActionViewModel[] {
  const reservationEligibility = nestedRecord(input.reservationSnapshot, "eligibility");
  const listingEligibility = nestedRecord(input.listingSnapshot, "eligibility");
  const actions: OperationsActionViewModel[] = [
    createAction("cancel", asBoolean(reservationEligibility?.can_cancel), input.actionPending),
    createAction("confirm", asBoolean(reservationEligibility?.can_confirm), input.actionPending),
  ];

  if (input.selectedListingId) {
    actions.push(createAction("reopen", asBoolean(listingEligibility?.can_reopen), input.actionPending));
  }

  return actions;
}

function createAction(
  id: OperationsActionId,
  allowed: boolean,
  actionPending: OperationsActionId | null,
): OperationsActionViewModel {
  if (actionPending) {
    return {
      id,
      label: ACTION_LABELS[id],
      enabled: false,
      disabledReason: "İşlem devam ederken yeni aksiyon başlatılamaz.",
    };
  }

  return {
    id,
    label: ACTION_LABELS[id],
    enabled: allowed,
    disabledReason: allowed ? null : "Backend snapshot bu aksiyona izin vermiyor.",
  };
}

function sanitizeReservationSnapshot(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    reservation: pickRecord(value.reservation, ["id", "status", "move_in_date", "stay_months"]),
    order: pickRecord(value.order, ["id", "status", "total_amount", "currency"]),
    payment: pickRecord(value.payment, ["id", "status", "amount", "currency"]),
    listing: pickRecord(value.listing, ["id", "status"]),
    contact: pickRecord(value.contact, [
      "fullName",
      "phone",
      "email",
      "preferredContactMethod",
      "preferredContactTime",
      "occupantFullName",
      "documentReadiness",
      "note",
    ]),
    latestEvent: pickRecord(value.latest_event, ["id", "workflow_name", "reason", "note", "created_at"]),
    eligibility: pickRecord(value.eligibility, ["can_cancel", "can_confirm"]),
  };
}

function sanitizeListingSnapshot(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    listing: pickRecord(value.listing, ["id", "status"]),
    latestEvent: pickRecord(value.latest_event, ["id", "workflow_name", "reason", "note", "created_at"]),
    eligibility: pickRecord(value.eligibility, ["can_reopen"]),
  };
}

function pickRecord(value: unknown, keys: string[]): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }

  return Object.fromEntries(keys.map((key) => [key, value[key]]).filter(([, entry]) => entry !== undefined));
}

function nestedRecord(value: unknown, key: string): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }

  const nested = value[key];
  return isRecord(nested) ? nested : null;
}

function formatAmount(amount: number | null, currency: string | null): string {
  if (amount === null) {
    return "Yok";
  }

  return currency ? `${amount} ${currency}` : String(amount);
}

function formatStayMonths(stayMonths: number | null): string {
  if (stayMonths === null) {
    return "Belirtilmedi";
  }

  return `${stayMonths} ay`;
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

function asNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}
