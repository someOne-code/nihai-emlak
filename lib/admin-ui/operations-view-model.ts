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
  reopen: "Ilani yeniden ac",
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
    listingTitle: asString(listing?.title) ?? "Isimsiz ilan",
    locationLabel: [asString(listing?.city), asString(listing?.district)].filter(Boolean).join(" / "),
    reservationStatus: formatStatusLabel(asString(reservation.status)),
    orderId,
    orderStatus: formatStatusLabel(asString(order?.status), "Yok"),
    paymentId: asString(payment?.id),
    paymentStatus: formatStatusLabel(asString(payment?.status), "Yok"),
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
    createAction(
      "cancel",
      asBoolean(reservationEligibility?.can_cancel),
      asString(reservationEligibility?.can_cancel_reason),
      input.actionPending,
    ),
    createAction(
      "confirm",
      asBoolean(reservationEligibility?.can_confirm),
      asString(reservationEligibility?.can_confirm_reason),
      input.actionPending,
    ),
  ];

  if (input.selectedListingId) {
    actions.push(
      createAction(
        "reopen",
        asBoolean(listingEligibility?.can_reopen),
        asString(listingEligibility?.can_reopen_reason),
        input.actionPending,
      ),
    );
  }

  return actions;
}

function createAction(
  id: OperationsActionId,
  allowed: boolean,
  reason: string | null,
  actionPending: OperationsActionId | null,
): OperationsActionViewModel {
  if (actionPending) {
    return {
      id,
      label: ACTION_LABELS[id],
      enabled: false,
      disabledReason: "Islem devam ederken yeni aksiyon baslatilamaz.",
    };
  }

  return {
    id,
    label: ACTION_LABELS[id],
    enabled: allowed,
    disabledReason: allowed ? null : reason ?? "Backend snapshot bu aksiyona izin vermiyor.",
  };
}

function sanitizeReservationSnapshot(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    reservation: pickRecord(value.reservation, [
      "id",
      "status",
      "move_in_date",
      "stay_months",
      "guest_count",
      "note",
    ]),
    order: pickRecord(value.order, ["id", "status", "total_amount", "currency"]),
    orderItems: sanitizeOrderItems(value.order_items),
    payment: pickRecord(value.payment, ["id", "status", "amount", "currency"]),
    listing: pickRecord(value.listing, ["id", "status", "title", "city", "district"]),
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
    eligibility: pickRecord(value.eligibility, [
      "can_cancel",
      "can_cancel_reason",
      "can_confirm",
      "can_confirm_reason",
    ]),
  };
}

function sanitizeListingSnapshot(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    listing: pickRecord(value.listing, ["id", "status", "title", "city", "district"]),
    latestEvent: pickRecord(value.latest_event, ["id", "workflow_name", "reason", "note", "created_at"]),
    eligibility: pickRecord(value.eligibility, ["can_reopen", "can_reopen_reason"]),
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

  const formattedAmount = amount.toLocaleString("tr-TR");
  return currency ? `${formattedAmount} ${currency}` : formattedAmount;
}

function formatStayMonths(stayMonths: number | null): string {
  if (stayMonths === null) {
    return "Belirtilmedi";
  }

  return `${stayMonths} ay`;
}

function sanitizeOrderItems(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((item) => ({
      itemType: asString(item.item_type) ?? asString(item.itemType) ?? "unknown",
      code: asString(item.code) ?? "",
      label: asString(item.label) ?? "Isimsiz kalem",
      amount: asNumber(item.amount),
    }))
    .filter((item) => item.amount !== null);
}

function formatStatusLabel(status: string | null, fallback = "Bilinmiyor"): string {
  if (!status) {
    return fallback;
  }

  const normalized = status.toLowerCase();
  const statusMap: Record<string, string> = {
    pending: "Beklemede",
    confirmed: "Onaylandi",
    succeeded: "Basarili",
    completed: "Tamamlandi",
    cancelled: "Iptal edildi",
    failed: "Basarisiz",
    refunded: "Iade edildi",
    conflict: "Uyusmazlik",
    expired: "Suresi doldu",
    active: "Aktif",
    passive: "Pasif",
    unknown: "Bilinmiyor",
  };

  return statusMap[normalized] ?? status;
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
