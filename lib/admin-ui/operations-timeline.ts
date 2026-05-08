export type OperationsTimelineEntry = {
  label: string;
  detail: string | null;
  timestamp: string | null;
};

const WORKFLOW_NAMES: Record<string, string> = {
  admin_cancel_reservation: "Rezervasyon iptali",
  admin_cancel_reservation_rejected: "Rezervasyon iptali reddedildi",
  admin_confirm_reservation: "Sözleşme tamamlandı",
  admin_confirm_reservation_rejected: "Sözleşme tamamlama reddedildi",
  admin_request_documents: "Belge istendi",
  admin_mark_documents_waiting: "Belge bekleniyor",
  admin_mark_documents_completed: "Belgeler tamamlandı",
  admin_mark_documents_failed: "Belge eksik/başarısız",
  admin_mark_refund_required: "İade gerekli",
  admin_mark_refund_requested: "İade istendi",
  admin_mark_refund_completed: "İade tamamlandı",
  admin_mark_deposit_forfeited: "Kapora tutuldu",
  admin_mark_manual_resolution_required: "Manuel finans incelemesi",
  admin_mark_conflict_payment: "Ödeme uyuşmazlığı",
  admin_mark_payment_issue_resolved: "Ödeme sorunu çözüldü",
  admin_mark_payment_not_received: "Ödeme alınmadı",
  admin_reopen_listing: "İlan yeniden açıldı",
  admin_reopen_listing_rejected: "İlan yeniden açma reddedildi",
};

export function buildOperationsTimelineEntries(
  reservationSnapshot: Record<string, unknown> | null,
  listingSnapshot: Record<string, unknown> | null,
  documentTracking: Record<string, unknown> | null = null,
  financeOps: Record<string, unknown> | null = null,
  eventHistory: Record<string, unknown>[] = [],
): OperationsTimelineEntry[] {
  const entries: OperationsTimelineEntry[] = [];
  const reservation = asRecord(reservationSnapshot?.reservation);
  const order = asRecord(reservationSnapshot?.order);
  const payment = asRecord(reservationSnapshot?.payment);
  const reservationStatus = asString(reservation?.status);
  const orderStatus = asString(order?.status);
  const paymentStatus = asString(payment?.status);

  if (reservation) {
    entries.push({
      label: "Rezervasyon oluşturuldu",
      detail: "Müşteri rezervasyon sürecini başlattı.",
      timestamp: asString(reservation.created_at),
    });
  }

  if (paymentStatus === "succeeded") {
    entries.push({
      label: "Ödeme onaylandı",
      detail: "Banka ödemesi başarılı döndü.",
      timestamp: asString(payment?.updated_at) ?? asString(payment?.created_at) ?? asString(order?.created_at),
    });
  }

  if (eventHistory.length > 0) {
    for (const event of eventHistory) {
      const entry = eventToTimeline(event, null, null);
      if (entry) entries.push(entry);
    }

    if (reservationStatus === "confirmed" && orderStatus === "completed" && paymentStatus === "succeeded") {
      entries.push({
        label: "Sözleşme tamamlandı",
        detail: "Rezervasyon kesinleşti; ilan müşteri tarafında görünmez.",
        timestamp: asString(eventHistory[eventHistory.length - 1]?.created_at) ?? asString(payment?.updated_at) ?? null,
      });
    }

    return dedupeTimelineEntries(entries);
  }

  const reservationEvent = asRecord(reservationSnapshot?.latestEvent);
  const listingEvent = asRecord(listingSnapshot?.latestEvent);
  if (reservationEvent) {
    const listingStatus = asString(asRecord(listingSnapshot?.listing)?.status);
    const mergedListingState = areSameWorkflowEvent(reservationEvent, listingEvent)
      ? getListingStateAfterCancellation(asString(reservationEvent.workflow_name), listingStatus)
      : null;
    const entry = eventToTimeline(reservationEvent, null, mergedListingState);
    if (entry) entries.push(entry);
  }

  if (listingEvent && !areSameWorkflowEvent(reservationEvent, listingEvent)) {
    const listingStatus = asString(asRecord(listingSnapshot?.listing)?.status);
    const entry = eventToTimeline(
      listingEvent,
      "İlan",
      getListingStateAfterCancellation(asString(listingEvent.workflow_name), listingStatus),
    );
    if (entry) entries.push(entry);
  }

  const documentStatus = asString(documentTracking?.status) ?? asString(documentTracking?.document_status);
  if (
    documentStatus === "completed" &&
    !entries.some((entry) => entry.label === "Belgeler tamamlandı")
  ) {
    const note = asString(documentTracking?.adminNote) ?? asString(documentTracking?.admin_note);
    entries.push({
      label: "Belgeler tamamlandı",
      detail: note ? `Not: ${note}` : "Admin belge sürecini tamamladı.",
      timestamp: asString(documentTracking?.updatedAt) ?? asString(documentTracking?.updated_at),
    });
  }

  const financeStatus = asString(financeOps?.status) ?? asString(financeOps?.finance_status);
  if (
    financeStatus === "issue_resolved" &&
    !entries.some((entry) => entry.label === "Ödeme sorunu çözüldü")
  ) {
    const note = asString(financeOps?.adminNote) ?? asString(financeOps?.admin_note);
    entries.push({
      label: "Ödeme sorunu çözüldü",
      detail: note ? `Not: ${note}` : "Admin ödeme sorununu kapattı.",
      timestamp: asString(financeOps?.updatedAt) ?? asString(financeOps?.updated_at),
    });
  }

  if (reservationStatus === "confirmed" && orderStatus === "completed" && paymentStatus === "succeeded") {
    entries.push({
      label: "Sözleşme tamamlandı",
      detail: "Rezervasyon kesinleşti; ilan müşteri tarafında görünmez.",
      timestamp: asString(reservationEvent?.created_at) ?? asString(payment?.updated_at) ?? null,
    });
  }

  return dedupeTimelineEntries(entries);
}

function eventToTimeline(
  event: Record<string, unknown>,
  scope: string | null,
  listingState: { label: string; detail: string } | null,
): OperationsTimelineEntry | null {
  const workflowRaw = asString(event.workflow_name);
  const reason = asString(event.reason);
  const note = asString(event.note);
  const createdAt = asString(event.created_at);
  const label = workflowRaw ? WORKFLOW_NAMES[workflowRaw] ?? workflowRaw : null;

  if (!label && !reason && !note && !createdAt) {
    return null;
  }

  const detailParts: string[] = [];
  if (listingState?.detail) detailParts.push(listingState.detail);
  if (reason) detailParts.push(`Sebep: ${reason}`);
  if (note) detailParts.push(`Not: ${note}`);

  return {
    label: label ? `${scope ? `${scope}: ` : ""}${label}` : `${scope ?? "Operasyon"} işlemi`,
    detail: detailParts.length > 0 ? detailParts.join(" - ") : null,
    timestamp: createdAt,
  };
}

function getListingStateAfterCancellation(
  workflowName: string | null,
  listingStatus: string | null,
): { label: string; detail: string } | null {
  if (workflowName !== "admin_cancel_reservation") {
    return null;
  }

  if (listingStatus === "active") {
    return {
      label: "İlan yayında",
      detail: "Rezervasyon iptali sonrası ilan yayında.",
    };
  }

  if (listingStatus === "passive") {
    return {
      label: "İlan pasif durumda",
      detail: "Rezervasyon iptali sonrası ilan pasif; yayına almak için yeniden açma aksiyonu gerekir.",
    };
  }

  return null;
}

function areSameWorkflowEvent(
  a: Record<string, unknown> | null,
  b: Record<string, unknown> | null,
): boolean {
  if (!a || !b) {
    return false;
  }

  const aId = asString(a.id);
  const bId = asString(b.id);
  if (aId && bId && aId === bId) {
    return true;
  }

  return (
    asString(a.workflow_name) === asString(b.workflow_name) &&
    asString(a.created_at) === asString(b.created_at) &&
    asString(a.note) === asString(b.note) &&
    asString(a.reason) === asString(b.reason)
  );
}

function dedupeTimelineEntries(entries: OperationsTimelineEntry[]): OperationsTimelineEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = `${entry.label}|${entry.timestamp ?? ""}|${entry.detail ?? ""}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  return value.trim();
}
