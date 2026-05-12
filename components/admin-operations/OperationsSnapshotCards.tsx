import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  OperationsActionViewModel,
  OperationsDocumentTrackingViewModel,
  OperationsFinanceOpsViewModel,
} from "@/lib/admin-ui/operations-view-model";
import { OperationsStatusBadge } from "./OperationsStatusBadge";

// ── Generic summary card ────────────────────────────────────────────────────

function SummaryCard({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: ReactNode }>;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <div
            key={item.label}
            className="grid min-w-0 grid-cols-[minmax(72px,0.4fr)_minmax(0,1fr)] gap-2 text-sm"
          >
            <dt className="min-w-0 font-medium text-muted-foreground">{item.label}</dt>
            <dd className="min-w-0 break-words [overflow-wrap:anywhere] font-semibold">{item.value}</dd>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── Reservation details ─────────────────────────────────────────────────────

export function ReservationDetailsCard({
  reservationSnapshot,
}: {
  reservationSnapshot: Record<string, unknown> | null;
}) {
  const reservation = asRecord(reservationSnapshot?.reservation);
  if (!reservation) {
    return null;
  }

  const status = asString(reservation.status);
  const statusLabel = deriveReservationOperationStatusLabel({
    reservationStatus: status,
    reservationSnapshot,
  });
  const moveInDate = asString(reservation.move_in_date);
  const stayMonths = asNumber(reservation.stay_months);
  const guestCount = asNumber(reservation.guest_count);
  const note = asString(reservation.note);

  const items: Array<{ label: string; value: ReactNode }> = [];
  if (statusLabel) {
    items.push({ label: "Durum", value: <OperationsStatusBadge status={statusLabel} /> });
  }
  if (moveInDate) {
    items.push({ label: "Giriş tarihi", value: moveInDate });
  }
  if (stayMonths !== null) {
    items.push({ label: "Kalış süresi", value: `${stayMonths} ay` });
  }
  if (guestCount !== null) {
    items.push({ label: "Misafir sayısı", value: `${guestCount} kişi` });
  }
  if (note) {
    items.push({ label: "Not", value: note });
  }

  return <SummaryCard title="Rezervasyon Bilgileri" items={items} />;
}

// ── Contact summary ─────────────────────────────────────────────────────────

export function ContactSummaryCard({
  reservationSnapshot,
}: {
  reservationSnapshot: Record<string, unknown> | null;
}) {
  const contact = asRecord(reservationSnapshot?.contact);
  if (!contact) {
    return null;
  }

  const fullName = asString(contact.fullName);
  const phone = asString(contact.phone);
  const email = asString(contact.email);
  const preferredMethod = asString(contact.preferredContactMethod);
  const preferredTime = asString(contact.preferredContactTime);
  const occupant = asString(contact.occupantFullName);
  const documentReadiness = asString(contact.documentReadiness);
  const note = asString(contact.note);

  const items: Array<{ label: string; value: ReactNode }> = [];
  if (fullName) items.push({ label: "Ad soyad", value: fullName });
  if (phone) items.push({ label: "Telefon", value: phone });
  if (email) items.push({ label: "E-posta", value: email });

  const contactLabel = formatContactMethod(preferredMethod, preferredTime);
  if (contactLabel) items.push({ label: "İletişim tercihi", value: contactLabel });

  if (occupant) items.push({ label: "Kalacak kişi", value: occupant });
  if (documentReadiness) items.push({ label: "Evrak hazırlığı", value: formatDocReadiness(documentReadiness) });
  if (note) items.push({ label: "İletişim notu", value: note });

  return <SummaryCard title="İletişim Bilgileri" items={items} />;
}

// ── Listing summary ─────────────────────────────────────────────────────────

export function ListingSummaryCard({
  listingSnapshot,
  reservationSnapshot,
  selectedRow,
}: {
  listingSnapshot: Record<string, unknown> | null;
  reservationSnapshot: Record<string, unknown> | null;
  selectedRow: { listingTitle: string; locationLabel: string } | null;
}) {
  const listingFromListing = asRecord(listingSnapshot?.listing);
  const listingFromReservation = asRecord(reservationSnapshot?.listing);

  const title =
    asString(listingFromListing?.title) ??
    asString(listingFromReservation?.title) ??
    selectedRow?.listingTitle ??
    null;
  const city = asString(listingFromListing?.city) ?? asString(listingFromReservation?.city);
  const district = asString(listingFromListing?.district) ?? asString(listingFromReservation?.district);
  const status = asString(listingFromListing?.status) ?? asString(listingFromReservation?.status);
  const statusLabel = deriveListingOperationStatusLabel({
    listingStatus: status,
    reservationSnapshot,
  });
  const locationLabel =
    [city, district].filter(Boolean).join(" / ") || selectedRow?.locationLabel || "";

  const items: Array<{ label: string; value: ReactNode }> = [];
  if (title) items.push({ label: "İlan", value: title });
  if (locationLabel) items.push({ label: "Konum", value: locationLabel });
  if (statusLabel) items.push({ label: "Durum", value: <OperationsStatusBadge status={statusLabel} /> });

  return <SummaryCard title="İlan Bilgileri" items={items} />;
}

// ── Pricing breakdown ───────────────────────────────────────────────────────

export function PricingBreakdownCard({
  reservationSnapshot,
  actions = [],
  documentTracking = null,
  financeOps = null,
  listingSnapshot = null,
}: {
  reservationSnapshot: Record<string, unknown> | null;
  actions?: OperationsActionViewModel[];
  documentTracking?: OperationsDocumentTrackingViewModel | null;
  financeOps?: OperationsFinanceOpsViewModel | null;
  listingSnapshot?: Record<string, unknown> | null;
}) {
  const breakdown = readPricingBreakdown(reservationSnapshot);
  const order = asRecord(reservationSnapshot?.order);
  const orderStatus = asString(order?.status);
  const payment = asRecord(reservationSnapshot?.payment);
  const paymentStatus = asString(payment?.status);
  const paymentDate = asString(payment?.updated_at) ?? asString(payment?.created_at);
  const totalAmount = asNumber(order?.total_amount);
  const currency = asString(order?.currency);
  const totalLabel = breakdown?.totalLabel ?? (totalAmount !== null ? formatMoney(totalAmount, currency) : "-");
  const mainItems = breakdown?.mainItems ?? [];
  const serviceItems = breakdown?.serviceItems ?? [];
  const depositRefundLabel = getDepositRefundWindowLabel(financeOps?.depositRefundWindow ?? null, mainItems, paymentDate, paymentStatus);
  const completionItems = getCompletionControlItems({
    actions,
    documentTracking,
    financeOps,
    listingSnapshot,
    reservationSnapshot,
  });
  if (!breakdown && !order && !payment) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Ödeme özeti</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-[minmax(80px,0.4fr)_1fr] gap-2">
          <dt className="font-medium text-muted-foreground">{getOrderRecordLabel(orderStatus, paymentStatus)}</dt>
          <dd className="space-y-1 font-semibold">
            {orderStatus ? <OperationsStatusBadge status={translateStatus(orderStatus)} /> : "-"}
            {getOrderStatusHelpText(orderStatus) && (
              <p className="font-normal leading-relaxed text-muted-foreground">
                {getOrderStatusHelpText(orderStatus)}
              </p>
            )}
          </dd>
        </div>
        <div className="grid grid-cols-[minmax(80px,0.4fr)_1fr] gap-2">
          <dt className="font-medium text-muted-foreground">Banka ödemesi</dt>
          <dd className="space-y-1 font-semibold">
            {paymentStatus ? <OperationsStatusBadge status={translateStatus(paymentStatus)} /> : "-"}
            {getPaymentStatusHelpText(paymentStatus) && (
              <p className="font-normal leading-relaxed text-muted-foreground">
                {getPaymentStatusHelpText(paymentStatus)}
              </p>
            )}
          </dd>
        </div>
        <div className="grid grid-cols-[minmax(80px,0.4fr)_1fr] gap-2">
          <dt className="font-medium text-muted-foreground">Ödeme tarihi</dt>
          <dd className="font-semibold">{formatDate(paymentDate)}</dd>
        </div>
        {depositRefundLabel && (
          <div className="grid grid-cols-[minmax(80px,0.4fr)_1fr] gap-2">
            <dt className="font-medium text-muted-foreground">Kapora iade kontrolü</dt>
            <dd className="font-semibold">{depositRefundLabel}</dd>
          </div>
        )}
        <div className="grid grid-cols-[minmax(80px,0.4fr)_1fr] gap-2">
          <dt className="font-medium text-muted-foreground">Toplam tutar</dt>
          <dd className="font-semibold">{totalLabel}</dd>
        </div>
        <PricingItemsList label="Ana ödeme kalemleri" items={mainItems} />
        <PricingItemsList label="Ek ödemeler" items={serviceItems} />
        <CompletionControlList items={completionItems} />
      </CardContent>
    </Card>
  );
}

function CompletionControlList({
  items,
}: {
  items: Array<{ label: string; value: string; blocked: boolean }>;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-[minmax(80px,0.4fr)_1fr] gap-2">
      <dt className="font-medium text-muted-foreground">Tamamlama kontrolü</dt>
      <dd className="space-y-2">
        {items.map((item) => (
          <div
            key={item.label}
            className={`rounded-md border px-3 py-2 text-xs leading-relaxed ${
              item.blocked
                ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
            }`}
          >
            <span className="font-semibold">{item.label}:</span> {item.value}
          </div>
        ))}
      </dd>
    </div>
  );
}

function getCompletionControlItems({
  actions,
  documentTracking,
  financeOps,
  listingSnapshot,
  reservationSnapshot,
}: {
  actions: OperationsActionViewModel[];
  documentTracking: OperationsDocumentTrackingViewModel | null;
  financeOps: OperationsFinanceOpsViewModel | null;
  listingSnapshot: Record<string, unknown> | null;
  reservationSnapshot: Record<string, unknown> | null;
}): Array<{ label: string; value: string; blocked: boolean }> {
  const items: Array<{ label: string; value: string; blocked: boolean }> = [];
  const confirmAction = actions.find((action) => action.id === "confirm");
  const reservationEligibility = asRecord(reservationSnapshot?.eligibility);
  const reservation = asRecord(reservationSnapshot?.reservation);
  const order = asRecord(reservationSnapshot?.order);
  const payment = asRecord(reservationSnapshot?.payment);
  const listing = asRecord(listingSnapshot?.listing) ?? asRecord(reservationSnapshot?.listing);
  const reservationStatus = asString(reservation?.status);
  const orderStatus = asString(order?.status);
  const paymentStatus = asString(payment?.status);
  const listingStatus = asString(listing?.status);
  const canConfirm = asBoolean(reservationEligibility?.can_confirm);
  const isContractCompleted = reservationStatus === "confirmed" && orderStatus === "completed";
  const isPaidOrder = paymentStatus === "succeeded" || orderStatus === "completed";
  const documentBlocksContract = Boolean(documentTracking && documentTracking.status !== "completed" && isPaidOrder);
  const contractCanComplete = Boolean(confirmAction?.enabled || canConfirm);
  const confirmReason =
    confirmAction?.disabledReason ??
    formatWorkflowReason(asString(reservationEligibility?.can_confirm_reason));

  if (confirmAction || reservationEligibility) {
    items.push({
      label: "Sözleşme",
      value:
        isContractCompleted
          ? "Sözleşme tamamlandı; tekrar işlem gerekmez."
          : documentBlocksContract
          ? "Belge süreci tamamlanınca sözleşme kesinleşebilir."
          : contractCanComplete
          ? "Sözleşme tamamlanabilir."
          : confirmReason ?? "Sözleşme şu anda tamamlanamaz; aşağıdaki açık işleri kontrol et.",
      blocked: !isContractCompleted && (documentBlocksContract || !contractCanComplete),
    });
  }

  if (documentTracking) {
    const documentCompleted = documentTracking.status === "completed";
    items.push({
      label: "Belge süreci",
      value: documentCompleted
        ? `${documentTracking.statusLabel}; belge tarafında blokaj yok.`
        : `${documentTracking.statusLabel}; sözleşme tamamlamadan önce belge süreci tamamlanmalı.`,
      blocked: !documentCompleted,
    });
  }

  if (financeOps?.hasVisibleWork) {
    const financeBlocksCompletion =
      !["issue_resolved", "payment_not_received", "refund_completed", "deposit_forfeited"].includes(financeOps.status ?? "");
    items.push({
      label: "Ödeme / iade",
      value: financeBlocksCompletion
        ? `${financeOps.statusLabel}; önce bu finans işi kapatılmalı.`
        : `${financeOps.statusLabel}; finans tarafında açık iş yok.`,
      blocked: financeBlocksCompletion,
    });
  }

  if (listingStatus) {
    const isPassiveHeldListing = listingStatus === "passive" && (isContractCompleted || isPaidOrder);
    const listingBlocksCompletion =
      !isPassiveHeldListing && !["active", "reserved"].includes(listingStatus);
    items.push({
      label: "İlan",
      value: isPassiveHeldListing
        ? "İlan müşteri tarafında görünmüyor; ödeme veya sözleşme kapsamında tutulmuş durumda. Bu durum bu operasyon için blokaj değildir."
        : listingBlocksCompletion
          ? `${translateStatus(listingStatus)}; ilan durumu sözleşme tamamlama için uygun görünmüyor.`
          : `${translateStatus(listingStatus)}; ilan tarafında görünür blokaj yok.`,
      blocked: listingBlocksCompletion,
    });
  }

  return items;
}

function PricingItemsList({
  label,
  items,
}: {
  label: string;
  items: Array<{ code: string; label: string; amountLabel: string }>;
}) {
  return (
    <div className="grid grid-cols-[minmax(80px,0.4fr)_1fr] gap-2">
      <dt className="font-medium text-muted-foreground">{label}</dt>
      <dd>
        {items.length === 0 ? (
          <span className="text-muted-foreground">-</span>
        ) : (
          <div className="space-y-1">
            {items.map((item, i) => (
              <div key={`${item.label}-${i}`} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-semibold">{item.amountLabel}</span>
              </div>
            ))}
          </div>
        )}
      </dd>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function translateStatus(status: string): string {
  const map: Record<string, string> = {
    pending: "Beklemede",
    confirmed: "Onaylandı",
    succeeded: "Başarılı",
    completed: "Tamamlandı",
    cancelled: "İptal edildi",
    failed: "Başarısız",
    refunded: "İade edildi",
    conflict: "Uyuşmazlık",
    expired: "Süresi doldu",
    active: "Aktif",
    passive: "Pasif",
    unknown: "Bilinmiyor",
  };
  return map[status.toLowerCase()] ?? status;
}

function deriveListingOperationStatusLabel({
  listingStatus,
  reservationSnapshot,
}: {
  listingStatus: string | null;
  reservationSnapshot: Record<string, unknown> | null;
}): string | null {
  const reservation = asRecord(reservationSnapshot?.reservation);
  const order = asRecord(reservationSnapshot?.order);
  const payment = asRecord(reservationSnapshot?.payment);
  const reservationStatus = asString(reservation?.status);
  const orderStatus = asString(order?.status);
  const paymentStatus = asString(payment?.status);

  if (
    listingStatus === "passive" &&
    reservationStatus === "confirmed" &&
    orderStatus === "completed" &&
    paymentStatus === "succeeded"
  ) {
    return "Kiralandı / Sözleşme tamamlandı";
  }

  if (listingStatus === "passive" && (paymentStatus === "succeeded" || orderStatus === "completed")) {
    return "Ödeme sonrası tutuluyor / yayında değil";
  }

  return listingStatus ? translateStatus(listingStatus) : null;
}

function deriveReservationOperationStatusLabel({
  reservationStatus,
  reservationSnapshot,
}: {
  reservationStatus: string | null;
  reservationSnapshot: Record<string, unknown> | null;
}): string | null {
  const order = asRecord(reservationSnapshot?.order);
  const payment = asRecord(reservationSnapshot?.payment);
  const orderStatus = asString(order?.status);
  const paymentStatus = asString(payment?.status);

  if (
    reservationStatus === "confirmed" &&
    orderStatus === "completed" &&
    paymentStatus === "succeeded"
  ) {
    return "Sözleşme tamamlandı / kesinleşti";
  }

  return reservationStatus ? translateStatus(reservationStatus) : null;
}

function getOrderStatusHelpText(status: string | null): string | null {
  if (status?.toLowerCase() === "pending") {
    return "Banka ödemesi başarılı olmadıkça bu kayıt ödeme işlemi olarak kalır.";
  }

  return null;
}

function getOrderRecordLabel(orderStatus: string | null, paymentStatus: string | null): string {
  if (orderStatus?.toLowerCase() === "completed" && paymentStatus?.toLowerCase() === "succeeded") {
    return "Sipariş kaydı";
  }

  return "Ödeme işlemi";
}

function getPaymentStatusHelpText(status: string | null): string | null {
  if (status?.toLowerCase() === "pending") {
    return "Müşteri ödeme akışını başlatmış olabilir; banka henüz başarılı ödeme dönüşü yapmadı.";
  }

  if (status?.toLowerCase() === "failed") {
    return "Banka ödemeyi başarısız döndürdü veya ödeme tamamlanamadı.";
  }

  return null;
}

function formatContactMethod(method: string | null, time: string | null): string | null {
  const methodMap: Record<string, string> = {
    phone: "Telefon",
    whatsapp: "WhatsApp",
    sms: "SMS",
    email: "E-posta",
  };
  const label = method ? methodMap[method.toLowerCase()] ?? method : null;
  if (!label && !time) return null;
  if (label && time) return `${label} (${time})`;
  return label ?? time;
}

function formatDocReadiness(value: string): string {
  const map: Record<string, string> = { ready: "Hazır", needs_help: "Yardım gerekiyor", later: "Daha sonra" };
  return map[value.toLowerCase()] ?? value;
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getDepositRefundWindowLabel(
  backendWindow: OperationsFinanceOpsViewModel["depositRefundWindow"] | null,
  mainItems: Array<{ code: string; label: string; amountLabel: string }>,
  paymentDate: string | null,
  paymentStatus: string | null,
): string | null {
  if (backendWindow) {
    if (!backendWindow.hasDeposit || paymentStatus?.toLowerCase() !== "succeeded") {
      return null;
    }

    if (backendWindow.elapsedDays === null) {
      return "Ödeme tarihi yok; kapora iade süresi hesaplanamıyor.";
    }

    if (backendWindow.isExpired) {
      return `Ödeme üzerinden ${backendWindow.elapsedDays} gün geçti. Backend önerisi: 14 günlük kapora iade süresi dolmuş.`;
    }

    const remainingDays = Math.max(0, 14 - backendWindow.elapsedDays);
    return `Ödeme üzerinden ${backendWindow.elapsedDays} gün geçti. Backend önerisi: kapora iade hakkı sürüyor; ${remainingDays} gün kaldı.`;
  }

  const hasDeposit = mainItems.some((item) => {
    const code = item.code.toLowerCase();
    const label = item.label.toLocaleLowerCase("tr-TR");
    return code === "deposit" || label.includes("kapora");
  });

  if (!hasDeposit || paymentStatus?.toLowerCase() !== "succeeded") {
    return null;
  }

  if (!paymentDate) {
    return "Ödeme tarihi yok; kapora iade süresi hesaplanamıyor.";
  }

  const days = daysSince(paymentDate);
  if (days === null) {
    return "Ödeme tarihi okunamadı; kapora iade süresi hesaplanamıyor.";
  }

  if (days > 14) {
    return `Ödeme üzerinden ${days} gün geçti. Normal kurala göre 14 günlük kapora iade süresi dolmuş.`;
  }

  const remainingDays = 14 - days;
  return `Ödeme üzerinden ${days} gün geçti. Normal kurala göre kapora iade hakkı sürüyor; ${remainingDays} gün kaldı.`;
}

function daysSince(value: string): number | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const today = new Date();
  const startOfToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfPaymentDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.max(0, Math.floor((startOfToday - startOfPaymentDay) / 86_400_000));
}

function formatMoney(amount: number, currency: string | null): string {
  const formatted = amount.toLocaleString("tr-TR");
  return currency ? `${formatted} ${currency}` : formatted;
}

function readPricingBreakdown(reservationSnapshot: Record<string, unknown> | null): {
  totalLabel: string;
  mainItems: Array<{ code: string; label: string; amountLabel: string }>;
  serviceItems: Array<{ code: string; label: string; amountLabel: string }>;
} | null {
  if (!reservationSnapshot || typeof reservationSnapshot !== "object") return null;

  const order = asRecord(reservationSnapshot.order);
  const orderItemsRaw = reservationSnapshot.orderItems;
  if (!Array.isArray(orderItemsRaw) || orderItemsRaw.length === 0) return null;

  const currency = asString(order?.currency);
  const totalAmount = asNumber(order?.total_amount);
  const items = orderItemsRaw
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object")
    .map((item) => ({
      itemType: asString(item.itemType) ?? "unknown",
      code: asString(item.code) ?? "",
      label: asString(item.label) ?? "İsimsiz kalem",
      amount: asNumber(item.amount),
    }))
    .filter((item) => item.amount !== null)
    .map((item) => ({
      ...item,
      amountLabel: formatMoney(item.amount as number, currency),
    }));

  if (items.length === 0) return null;

  return {
    totalLabel: totalAmount === null ? "-" : formatMoney(totalAmount, currency),
    mainItems: items
      .filter((i) => i.itemType === "main_item")
      .map((i) => ({ code: i.code, label: i.label, amountLabel: i.amountLabel })),
    serviceItems: items
      .filter((i) => i.itemType === "service_item")
      .map((i) => ({ code: i.code, label: i.label, amountLabel: i.amountLabel })),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  return value.trim();
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function formatWorkflowReason(reason: string | null): string | null {
  if (!reason) {
    return null;
  }

  const map: Record<string, string> = {
    "Odeme henuz basarili degil.": "Ödeme henüz başarılı değil.",
    "Banka odeme onayi bekleniyor.":
      "Banka ödeme onayı bekleniyor; ödeme sonucu gelmeden sözleşme tamamlanamaz.",
    "Ilan durumu bu islem icin uygun degil.":
      "İlan durumu bu işlem için uygun değil. İlan zaten yayında, kapalı veya başka bir süreç tarafından kilitlenmiş olabilir.",
    "Rezervasyon zaten iptal edilmis veya suresi dolmus.":
      "Rezervasyon iptal edilmiş veya süresi dolmuş.",
    "Odeme tutari siparis toplamiyla eslesmiyor.":
      "Ödeme tutarı sipariş toplamıyla eşleşmiyor; önce ödeme sorunu çözülmeli.",
    "Odeme sahipligi rezervasyon veya siparisle eslesmiyor.":
      "Ödeme kaydı rezervasyon veya siparişle eşleşmiyor; önce ödeme kaydı kontrol edilmeli.",
    "Rezervasyon icin tamamlanmis odeme bulunamadi.":
      "Rezervasyon için tamamlanmış ödeme bulunamadı.",
    "Bu ilan icin baska tamamlanmis rezervasyon var.":
      "Bu ilan için başka tamamlanmış rezervasyon var.",
  };

  return map[reason] ?? reason;
}
