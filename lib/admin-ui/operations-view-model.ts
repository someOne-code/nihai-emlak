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
  documentTracking?: unknown;
  eventHistory?: unknown;
  financeOps?: unknown;
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
  queue: OperationsQueueId;
  primaryStatus: string;
  priority: number;
  updatedAt: string | null;
  reservationStatus: string;
  orderId: string | null;
  orderStatus: string;
  paymentId: string | null;
  paymentStatus: string;
  amountLabel: string;
  moveInDate: string;
  stayMonthsLabel: string;
};

export type OperationsQueueId =
  | "payment_issues"
  | "refund_requests"
  | "manual_refunds"
  | "document_waiting"
  | "completed"
  | "all";

export type OperationsViewModel = {
  rows: OperationsOverviewRow[];
  selectedReservationId: string | null;
  selectedListingId: string | null;
  reservationSnapshot: Record<string, unknown> | null;
  documentTracking: OperationsDocumentTrackingViewModel | null;
  financeOps: OperationsFinanceOpsViewModel | null;
  eventHistory: Record<string, unknown>[];
  listingSnapshot: Record<string, unknown> | null;
  actions: OperationsActionViewModel[];
};

export type OperationsDocumentTrackingViewModel = {
  reservationId: string;
  orderId: string | null;
  status: string;
  statusLabel: string;
  allowedStatuses: string[];
  disabledReason: string | null;
  adminNote: string | null;
  updatedAt: string | null;
  lastAdminUserId: string | null;
  adminDisplayText: string | null;
};

export type OperationsFinanceOpsViewModel = {
  reservationId: string;
  orderId: string | null;
  paymentId: string | null;
  status: string | null;
  statusLabel: string;
  recommendedStatus: string | null;
  allowedStatuses: string[];
  hasVisibleWork: boolean;
  adminNote: string | null;
  updatedAt: string | null;
  lastAdminUserId: string | null;
  adminDisplayText: string | null;
  depositRefundWindow: {
    hasDeposit: boolean;
    paymentDate: string | null;
    elapsedDays: number | null;
    isExpired: boolean;
    systemRecommendation: string | null;
  } | null;
  issueFlags: {
    amountDrift: boolean;
    ownershipDrift: boolean;
    missingPayment: boolean;
  };
};

const ACTION_LABELS: Record<OperationsActionId, string> = {
  cancel: "İptal et",
  confirm: "Sözleşmeyi tamamla",
  reopen: "İlanı yeniden aç",
};

export function buildOperationsViewModel(input: OperationsViewModelInput): OperationsViewModel {
  const orders = input.overview.orders.items.filter(isRecord);
  const payments = input.overview.payments.items.filter(isRecord);
  const rows = input.overview.reservations.items
    .filter(isRecord)
    .map((reservation) => buildOverviewRow(reservation, orders, payments))
    .sort(compareOverviewRows);

  const selectedRow =
    rows.find((row) => row.reservationId === input.selectedReservationId) ?? rows[0] ?? null;
  const reservationSnapshot = sanitizeReservationSnapshot(input.reservationSnapshot);
  const financeOps = sanitizeFinanceOps(input.financeOps);
  const eventHistory = sanitizeEventHistory(input.eventHistory);
  const documentTracking = sanitizeDocumentTracking(input.documentTracking, reservationSnapshot, financeOps);
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
    documentTracking,
    financeOps,
    eventHistory,
    listingSnapshot,
    actions: selectedRow
      ? buildActions({
          reservationSnapshot,
          listingSnapshot,
          selectedListingId,
          actionPending: input.actionPending ?? null,
        })
      : [],
  };
}

function sanitizeEventHistory(value: unknown): Record<string, unknown>[] {
  const items = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.items)
      ? value.items
      : [];

  return items.filter(isRecord).map((item) => ({
    id: asString(item.id),
    created_at: asString(item.created_at) ?? asString(item.createdAt),
    actor_type: asString(item.actor_type) ?? asString(item.actorType),
    admin_user_id: asString(item.admin_user_id) ?? asString(item.adminUserId),
    workflow_name: asString(item.workflow_name) ?? asString(item.workflowName),
    reason: asString(item.reason),
    note: asString(item.note),
    reservation_id: asString(item.reservation_id) ?? asString(item.reservationId),
    order_id: asString(item.order_id) ?? asString(item.orderId),
    payment_id: asString(item.payment_id) ?? asString(item.paymentId),
    listing_id: asString(item.listing_id) ?? asString(item.listingId),
  }));
}

function sanitizeFinanceOps(value: unknown): OperationsFinanceOpsViewModel | null {
  if (!isRecord(value)) {
    return null;
  }

  const reservationId = asString(value.reservation_id) ?? asString(value.reservationId);
  if (!reservationId) {
    return null;
  }

  const issueFlags = nestedRecord(value, "issue_flags");
  const status = asString(value.finance_status) ?? asString(value.status);
  const recommendedStatus = asString(value.recommended_status) ?? asString(value.recommendedStatus);
  const normalizedIssueFlags = {
    amountDrift: asBoolean(issueFlags?.amount_drift) || asBoolean(issueFlags?.amountDrift),
    ownershipDrift: asBoolean(issueFlags?.ownership_drift) || asBoolean(issueFlags?.ownershipDrift),
    missingPayment: asBoolean(issueFlags?.missing_payment) || asBoolean(issueFlags?.missingPayment),
  };
  const allowedStatuses = getAllowedFinanceStatuses(status, recommendedStatus);
  const terminalStatus = isTerminalFinanceStatus(status);

  return {
    reservationId,
    orderId: asString(value.order_id) ?? asString(value.orderId),
    paymentId: asString(value.payment_id) ?? asString(value.paymentId),
    status,
    statusLabel: status ? formatFinanceStatusLabel(status) : "Finans kararı yok",
    recommendedStatus,
    allowedStatuses,
    hasVisibleWork:
      !terminalStatus &&
      (Boolean(status) ||
        Boolean(recommendedStatus) ||
        allowedStatuses.length > 0 ||
        normalizedIssueFlags.amountDrift ||
        normalizedIssueFlags.ownershipDrift ||
        normalizedIssueFlags.missingPayment),
    adminNote: asString(value.admin_note) ?? asString(value.adminNote),
    updatedAt: asString(value.updated_at) ?? asString(value.updatedAt),
    lastAdminUserId: asString(value.last_admin_user_id) ?? asString(value.lastAdminUserId),
    adminDisplayText: asString(value.admin_display) ?? asString(value.adminDisplayText),
    depositRefundWindow: sanitizeDepositRefundWindow(
      nestedRecord(value, "deposit_refund_window") ?? nestedRecord(value, "depositRefundWindow"),
    ),
    issueFlags: normalizedIssueFlags,
  };
}

function sanitizeDepositRefundWindow(value: Record<string, unknown> | null): OperationsFinanceOpsViewModel["depositRefundWindow"] {
  if (!value) {
    return null;
  }

  return {
    hasDeposit: asBoolean(value.has_deposit) || asBoolean(value.hasDeposit),
    paymentDate: asString(value.payment_date) ?? asString(value.paymentDate),
    elapsedDays: asNumber(value.elapsed_days) ?? asNumber(value.elapsedDays),
    isExpired: asBoolean(value.is_expired) || asBoolean(value.isExpired),
    systemRecommendation: asString(value.system_recommendation) ?? asString(value.systemRecommendation),
  };
}

function isTerminalFinanceStatus(status: string | null): boolean {
  if (!status) {
    return false;
  }
  return ["issue_resolved", "payment_not_received", "refund_completed", "deposit_forfeited"].includes(
    status.toLowerCase(),
  );
}

function formatFinanceStatusLabel(status: string): string {
  const map: Record<string, string> = {
    refund_required: "İade gerekli",
    refund_requested: "Manuel iade bekliyor",
    refund_completed: "İade tamamlandı",
    deposit_forfeited: "Kapora iade edilmeyecek",
    manual_resolution_required: "Ödeme sorunu",
    conflict_payment: "Ödeme sorunu",
    issue_resolved: "Ödeme sorunu çözüldü",
    payment_not_received: "Ödeme alınmadı",
  };
  return map[status.toLowerCase()] ?? status;
}

function sanitizeDocumentTracking(
  value: unknown,
  reservationSnapshot: Record<string, unknown> | null,
  financeOps: OperationsFinanceOpsViewModel | null,
): OperationsDocumentTrackingViewModel | null {
  if (!isRecord(value)) {
    return null;
  }

  const reservationId = asString(value.reservation_id) ?? asString(value.reservationId);
  const status = asString(value.document_status) ?? asString(value.status);
  if (!reservationId || !status) {
    return null;
  }

  return {
    reservationId,
    orderId: asString(value.order_id) ?? asString(value.orderId),
    status,
    statusLabel: formatDocumentStatusLabel(status),
    allowedStatuses: getAllowedDocumentStatuses(status, reservationSnapshot, financeOps),
    disabledReason: getDocumentWorkflowDisabledReason(status, reservationSnapshot, financeOps),
    adminNote: asString(value.admin_note) ?? asString(value.adminNote),
    updatedAt: asString(value.updated_at) ?? asString(value.updatedAt),
    lastAdminUserId: asString(value.last_admin_user_id) ?? asString(value.lastAdminUserId),
    adminDisplayText: asString(value.admin_display) ?? asString(value.adminDisplayText),
  };
}

function getDocumentWorkflowDisabledReason(
  status: string,
  reservationSnapshot: Record<string, unknown> | null,
  financeOps: OperationsFinanceOpsViewModel | null,
): string | null {
  const reservationStatus = asString(nestedRecord(reservationSnapshot, "reservation")?.status);
  if (reservationStatus === "cancelled" || reservationStatus === "expired") {
    return "Rezervasyon kapalı olduğu için belge süreci değiştirilemez.";
  }

  const paymentStatus = asString(nestedRecord(reservationSnapshot, "payment")?.status);
  if (paymentStatus !== "succeeded") {
    return "Ödeme henüz başarılı değil. Belge süreci ödeme başarılı olduktan sonra başlatılabilir.";
  }

  if (hasOpenRefundRequest(financeOps)) {
    return "Açık iptal / iade talebi varken belge süreci ilerletilemez. Önce talebi onayla veya reddet.";
  }

  if (getAllowedDocumentStatuses(status, reservationSnapshot, financeOps).length === 0) {
    return "Mevcut belge durumunda kullanılabilir bir sonraki adım yok.";
  }

  return null;
}

function getAllowedDocumentStatuses(
  status: string,
  reservationSnapshot: Record<string, unknown> | null,
  financeOps: OperationsFinanceOpsViewModel | null,
): string[] {
  const reservationStatus = asString(nestedRecord(reservationSnapshot, "reservation")?.status);
  if (reservationStatus === "cancelled" || reservationStatus === "expired") {
    return [];
  }

  const paymentStatus = asString(nestedRecord(reservationSnapshot, "payment")?.status);
  if (paymentStatus !== "succeeded") {
    return [];
  }

  if (hasOpenRefundRequest(financeOps)) {
    return [];
  }

  const normalized = status.toLowerCase();
  if (normalized === "not_requested") {
    return ["requested"];
  }
  if (normalized === "requested") {
    return ["waiting"];
  }
  if (normalized === "waiting") {
    return ["completed", "failed"];
  }
  if (normalized === "failed") {
    return ["requested", "waiting"];
  }
  return [];
}

function hasOpenRefundRequest(financeOps: OperationsFinanceOpsViewModel | null): boolean {
  return financeOps?.status === "refund_required";
}

function formatDocumentStatusLabel(status: string): string {
  const map: Record<string, string> = {
    not_requested: "Belge istenmedi",
    requested: "Belge istendi",
    waiting: "Belge bekleniyor",
    completed: "Tamamlandı",
    failed: "Eksik / başarısız",
  };
  return map[status.toLowerCase()] ?? formatStatusLabel(status);
}

function getAllowedFinanceStatuses(status: string | null, recommendedStatus: string | null): string[] {
  const normalizedStatus = status?.toLowerCase() ?? null;
  const normalizedRecommended = recommendedStatus?.toLowerCase() ?? null;

  if (!normalizedStatus) {
    return normalizedRecommended ? [normalizedRecommended] : [];
  }
  if (normalizedStatus === "refund_required") {
    return ["refund_requested", "deposit_forfeited"];
  }
  if (normalizedStatus === "refund_requested") {
    return ["refund_completed"];
  }
  if (normalizedStatus === "manual_resolution_required") {
    return ["manual_resolution_required", "issue_resolved", "payment_not_received"];
  }
  if (normalizedStatus === "conflict_payment") {
    return ["conflict_payment", "issue_resolved", "payment_not_received"];
  }
  return [];
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
  const financeOps = nestedRecord(reservation, "finance_ops");
  const amount = asNumber(payment?.amount) ?? asNumber(order?.total_amount);
  const currency = asString(payment?.currency) ?? asString(order?.currency);
  const queue = deriveQueue(reservation, order, payment, financeOps);
  const updatedAt =
    asString(payment?.updated_at) ??
    asString(order?.updated_at) ??
    asString(reservation.updated_at) ??
    asString(payment?.created_at) ??
    asString(order?.created_at) ??
    asString(reservation.created_at);

  return {
    reservationId,
    listingId,
    listingTitle: asString(listing?.title) ?? "\u0130simsiz ilan",
    locationLabel: [asString(listing?.city), asString(listing?.district)].filter(Boolean).join(" / "),
    queue,
    primaryStatus: formatPrimaryStatus(queue, order, payment, financeOps),
    priority: queuePriority(queue),
    updatedAt,
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

function deriveQueue(
  reservation: Record<string, unknown>,
  order: Record<string, unknown> | null,
  payment: Record<string, unknown> | null,
  financeOps: Record<string, unknown> | null = null,
): OperationsQueueId {
  const reservationStatus = asString(reservation.status)?.toLowerCase() ?? "";
  const orderStatus = asString(order?.status)?.toLowerCase() ?? "";
  const paymentStatus = asString(payment?.status)?.toLowerCase() ?? "";
  const financeStatus = asString(financeOps?.status)?.toLowerCase() ?? "";

  if (financeStatus === "refund_required") {
    return "refund_requests";
  }

  if (financeStatus === "refund_requested") {
    return "manual_refunds";
  }

  if (financeStatus === "manual_resolution_required" || financeStatus === "conflict_payment") {
    return "payment_issues";
  }

  if (financeStatus === "payment_not_received") {
    return "all";
  }

  if (
    paymentStatus === "conflict" ||
    orderStatus === "conflict"
  ) {
    return "payment_issues";
  }

  if (reservationStatus === "cancelled" && paymentStatus === "succeeded") {
    return "manual_refunds";
  }

  if (reservationStatus === "confirmed") {
    return "completed";
  }

  if (paymentStatus === "succeeded") {
    return "document_waiting";
  }

  return "all";
}

function formatPrimaryStatus(
  queue: OperationsQueueId,
  order: Record<string, unknown> | null,
  payment: Record<string, unknown> | null,
  financeOps: Record<string, unknown> | null = null,
): string {
  const orderStatus = asString(order?.status)?.toLowerCase() ?? "";
  const paymentStatus = asString(payment?.status)?.toLowerCase() ?? "";
  const financeStatus = asString(financeOps?.status)?.toLowerCase() ?? "";

  if (financeStatus === "payment_not_received") {
    return "Ödeme alınmadı / süreç kapandı";
  }

  if (paymentStatus === "pending" || orderStatus === "pending") {
    return "Ödeme bekliyor";
  }

  if (!paymentStatus) {
    return "Ödeme kaydı yok";
  }

  return formatQueueLabel(queue);
}

function formatQueueLabel(queue: OperationsQueueId): string {
  const map: Record<OperationsQueueId, string> = {
    all: "Operasyon",
    payment_issues: "Ödeme sorunu",
    refund_requests: "İptal / iade talebi",
    manual_refunds: "Manuel iade bekliyor",
    document_waiting: "Belge bekliyor",
    completed: "Kiralandı / Sözleşme tamamlandı",
  };
  return map[queue];
}

function queuePriority(queue: OperationsQueueId): number {
  const map: Record<OperationsQueueId, number> = {
    payment_issues: 0,
    refund_requests: 1,
    manual_refunds: 2,
    document_waiting: 3,
    completed: 4,
    all: 5,
  };
  return map[queue];
}

function compareOverviewRows(a: OperationsOverviewRow, b: OperationsOverviewRow): number {
  if (a.priority !== b.priority) {
    return a.priority - b.priority;
  }

  const aTime = a.updatedAt ? Date.parse(a.updatedAt) : 0;
  const bTime = b.updatedAt ? Date.parse(b.updatedAt) : 0;
  return bTime - aTime;
}

function buildActions(input: {
  reservationSnapshot: Record<string, unknown> | null;
  listingSnapshot: Record<string, unknown> | null;
  selectedListingId: string | null;
  actionPending: OperationsActionId | null;
}): OperationsActionViewModel[] {
  const reservationEligibility = nestedRecord(input.reservationSnapshot, "eligibility");
  const listingEligibility = nestedRecord(input.listingSnapshot, "eligibility");
  const listingStatus = asString(nestedRecord(input.listingSnapshot, "listing")?.status);
  const actions: OperationsActionViewModel[] = [
    createAction(
      "cancel",
      asBoolean(reservationEligibility?.can_cancel),
      formatBackendReason(asString(reservationEligibility?.can_cancel_reason)),
      input.actionPending,
    ),
    createAction(
      "confirm",
      asBoolean(reservationEligibility?.can_confirm),
      formatBackendReason(asString(reservationEligibility?.can_confirm_reason)),
      input.actionPending,
    ),
  ];

  if (input.selectedListingId && listingStatus !== "active") {
    const canReopen = asBoolean(listingEligibility?.can_reopen);
    actions.push(
      createAction(
        "reopen",
        canReopen,
        getReopenDisabledReason(
          canReopen,
          listingStatus,
          formatBackendReason(asString(listingEligibility?.can_reopen_reason)),
        ),
        input.actionPending,
      ),
    );
  }

  return actions;
}

function getReopenDisabledReason(
  allowed: boolean,
  listingStatus: string | null,
  backendReason: string | null,
): string | null {
  if (allowed) {
    return null;
  }

  if (listingStatus === "active") {
    return "İlan zaten yayında.";
  }

  return backendReason;
}

function formatBackendReason(reason: string | null): string | null {
  if (!reason) {
    return null;
  }

  const map: Record<string, string> = {
    "Odeme henuz basarili degil.": "Ödeme henüz başarılı değil.",
    "Banka odeme onayi bekleniyor.":
      "Banka ödeme onayı bekleniyor. Ödeme sonucu gelmeden rezervasyonu iptal etmek, banka dönüşüyle çakışma riski yaratır.",
    "Ilan durumu bu islem icin uygun degil.":
      "İlan durumu bu işlem için uygun değil. İlan zaten yayında, kapalı veya başka bir süreç tarafından kilitlenmiş olabilir.",
    "Rezervasyon zaten iptal edilmis veya suresi dolmus.":
      "Rezervasyon zaten iptal edilmiş veya süresi dolmuş. Kapanmış rezervasyonda tekrar iptal veya sözleşme tamamlama yapılmaz.",
    "Odeme tutari siparis toplamiyla eslesmiyor.":
      "Ödeme tutarı sipariş toplamıyla eşleşmiyor. Önce ödeme sorununu çöz.",
    "Odeme sahipligi rezervasyon veya siparisle eslesmiyor.":
      "Ödeme kaydı rezervasyon veya siparişle eşleşmiyor. Önce ödeme kaydını doğru rezervasyonla eşleştir.",
    "Rezervasyon icin tamamlanmis odeme bulunamadi.":
      "Rezervasyon için tamamlanmış ödeme bulunamadı. Ödeme başarılı olmadan sözleşme tamamlanamaz.",
    "Bu ilana bagli tamamlanmis odeme kaydi var.":
      "Bu ilana bağlı tamamlanmış ödeme kaydı var. Aynı ilan için çakışan rezervasyonları kontrol et.",
    "Bu ilan icin baska tamamlanmis rezervasyon var.":
      "Bu ilan başka bir rezervasyonla kapanmış. Sözleşmeyi tamamlamak için önce ilgili kayıtları kontrol et.",
  };

  return map[reason] ?? reason;
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
      disabledReason: "İşlem devam ederken yeni aksiyon başlatılamaz.",
    };
  }

  return {
    id,
    label: ACTION_LABELS[id],
    enabled: allowed,
    disabledReason: allowed
      ? null
      : reason ??
        "Bu işlem mevcut kayıt durumunda kullanılamaz. Önce ödeme, iade veya belge sürecindeki açık işi kontrol et.",
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
      "created_at",
      "updated_at",
      "move_in_date",
      "stay_months",
      "guest_count",
      "note",
    ]),
    order: pickRecord(value.order, ["id", "status", "total_amount", "currency", "created_at", "updated_at"]),
    orderItems: sanitizeOrderItems(value.order_items),
    payment: pickRecord(value.payment, ["id", "status", "amount", "currency", "created_at", "updated_at"]),
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
      label: asString(item.label) ?? "İsimsiz kalem",
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
    confirmed: "Onayland\u0131",
    succeeded: "Ba\u015far\u0131l\u0131",
    completed: "Tamamland\u0131",
    cancelled: "\u0130ptal edildi",
    failed: "Ba\u015far\u0131s\u0131z",
    refunded: "\u0130ade edildi",
    conflict: "Uyu\u015fmazl\u0131k",
    expired: "S\u00fcresi doldu",
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
