"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { AdminOperationsClientError } from "@/lib/admin-ui/operations-client.ts";
import {
  AdminOperationsActionValidationError,
  executeOperationsAction,
  loadOperationsModel,
} from "@/lib/admin-ui/operations-controller.ts";
import type {
  OperationsActionId,
  OperationsActionViewModel,
  OperationsOverviewRow,
  OperationsViewModel,
} from "@/lib/admin-ui/operations-view-model.ts";

const INITIAL_VIEW_MODEL: OperationsViewModel = {
  rows: [],
  selectedReservationId: null,
  selectedListingId: null,
  reservationSnapshot: null,
  listingSnapshot: null,
  actions: [],
};

const styles = {
  actionButton: "opsActionButton",
  actionButtons: "opsActionButtons",
  actionCancel: "opsActionCancel",
  actionConfirm: "opsActionConfirm",
  actionReason: "opsActionReason",
  actionReopen: "opsActionReopen",
  actionsSection: "opsActionsSection",
  badge: "opsBadge",
  badgeDanger: "opsBadgeDanger",
  badgeNeutral: "opsBadgeNeutral",
  badgeSuccess: "opsBadgeSuccess",
  badgeWarning: "opsBadgeWarning",
  container: "opsContainer",
  decisionGrid: "opsDecisionGrid",
  emptyCell: "opsEmptyCell",
  errorBanner: "opsErrorBanner",
  heading: "opsHeading",
  input: "opsInput",
  inputGroup: "opsInputGroup",
  label: "opsLabel",
  lead: "opsLead",
  loadingText: "opsLoadingText",
  mobileCard: "opsMobileCard",
  mobileCardHeader: "opsMobileCardHeader",
  mobileCardLabel: "opsMobileCardLabel",
  mobileCardMeta: "opsMobileCardMeta",
  mobileCardMetaItem: "opsMobileCardMetaItem",
  mobileCardTitle: "opsMobileCardTitle",
  mobileList: "opsMobileList",
  mobileSelectedCard: "opsMobileSelectedCard",
  row: "opsRow",
  selectedRow: "opsSelectedRow",
  summaryCard: "opsSummaryCard",
  summaryHeader: "opsSummaryHeader",
  summaryItem: "opsSummaryItem",
  summaryList: "opsSummaryList",
  summaryMeta: "opsSummaryMeta",
  summaryValueStrong: "opsSummaryValueStrong",
  snapshotCard: "opsSnapshotCard",
  snapshotDd: "opsSnapshotDd",
  snapshotDl: "opsSnapshotDl",
  snapshotDt: "opsSnapshotDt",
  snapshotEmpty: "opsSnapshotEmpty",
  snapshotGrid: "opsSnapshotGrid",
  snapshotItem: "opsSnapshotItem",
  snapshotNestedItem: "opsSnapshotNestedItem",
  snapshotNestedKey: "opsSnapshotNestedKey",
  snapshotNestedValue: "opsSnapshotNestedValue",
  snapshotObject: "opsSnapshotObject",
  snapshotTitle: "opsSnapshotTitle",
  subHeading: "opsSubHeading",
  successBanner: "opsSuccessBanner",
  table: "opsTable",
  tableWrapper: "opsTableWrapper",
  retryButton: "opsRetryButton",
  advancedDetails: "opsAdvancedDetails",
  advancedSummary: "opsAdvancedSummary",
  techId: "opsTechId",
  eligibilityNote: "opsEligibilityNote",
} as const;

export default function OperationsView() {
  const [viewModel, setViewModel] = useState<OperationsViewModel>(INITIAL_VIEW_MODEL);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<OperationsActionId | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [noteText, setNoteText] = useState("");

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadData = useCallback(async (selectedReservationId?: string | null) => {
    setLoading(true);
    setError(null);

    try {
      const nextViewModel = await loadOperationsModel(undefined, selectedReservationId);
      if (!mountedRef.current) {
        return;
      }

      setViewModel(nextViewModel);
    } catch (err) {
      if (!mountedRef.current) {
        return;
      }

      setError(safeErrorMessage(err));
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setActionPending(null);
      }
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRowSelect = useCallback((reservationId: string) => {
    setActionError(null);
    setActionSuccess(null);
    setReasonText("");
    setNoteText("");
    loadData(reservationId);
  }, [loadData]);

  const handleAction = useCallback(async (actionId: OperationsActionId) => {
    const selectedReservationId = viewModel.selectedReservationId;
    const selectedListingId = viewModel.selectedListingId;

    setActionPending(actionId);
    setActionError(null);
    setActionSuccess(null);

    try {
      const result = await executeOperationsAction(undefined, {
        actionId,
        noteText,
        reasonText,
        selectedListingId,
        selectedReservationId,
      });

      if (!mountedRef.current) {
        return;
      }

      setActionSuccess(result.message);
      setReasonText("");
      setNoteText("");
      await loadData(result.refreshReservationId);
    } catch (err) {
      if (!mountedRef.current) {
        return;
      }

      setActionError(safeErrorMessage(err));
      setActionPending(null);
    }
  }, [loadData, noteText, reasonText, viewModel.selectedListingId, viewModel.selectedReservationId]);

  if (loading && viewModel.rows.length === 0) {
    return (
      <div className={styles.container}>
        <h1 className={styles.heading}>Operasyon Yonetimi</h1>
        <p className={styles.loadingText}>Yukleniyor...</p>
      </div>
    );
  }

  if (error && viewModel.rows.length === 0) {
    return (
      <div className={styles.container}>
        <h1 className={styles.heading}>Operasyon Yonetimi</h1>
        <div className={styles.errorBanner}>{error}</div>
        <button type="button" className={styles.retryButton} onClick={() => loadData()}>
          Tekrar dene
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>Operasyon Yonetimi</h1>
      <p className={styles.lead}>
        Bekleyen rezervasyonlari sec, ozetleri incele ve izin verilen aksiyonlari bu ekrandan yonet.
      </p>

      {error && <div className={styles.errorBanner}>{error}</div>}
      {actionError && <div className={styles.errorBanner}>{actionError}</div>}
      {actionSuccess && <div className={styles.successBanner}>{actionSuccess}</div>}

      <div className={styles.mobileList}>
        {viewModel.rows.map((row) => (
          <MobileOverviewCard
            key={row.reservationId}
            row={row}
            selected={row.reservationId === viewModel.selectedReservationId}
            onSelect={handleRowSelect}
          />
        ))}
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Ilan</th>
              <th>Konum</th>
              <th>Durum</th>
              <th>Siparis</th>
              <th>Odeme</th>
              <th>Tutar</th>
              <th>Giris Tarihi</th>
              <th>Sure</th>
            </tr>
          </thead>
          <tbody>
            {viewModel.rows.map((row) => (
              <OverviewTableRow
                key={row.reservationId}
                row={row}
                selected={row.reservationId === viewModel.selectedReservationId}
                onSelect={handleRowSelect}
              />
            ))}
            {viewModel.rows.length === 0 && (
              <tr>
                <td colSpan={8} className={styles.emptyCell}>
                  Bekleyen rezervasyon bulunamadi.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {viewModel.selectedReservationId && (
        <PricingBreakdownCard reservationSnapshot={viewModel.reservationSnapshot} />
      )}

      {viewModel.selectedReservationId && (
        <div className={styles.decisionGrid}>
          <ReservationDetailsCard reservationSnapshot={viewModel.reservationSnapshot} />
          <ContactSummaryCard reservationSnapshot={viewModel.reservationSnapshot} />
          <ListingSummaryCard
            listingSnapshot={viewModel.listingSnapshot}
            reservationSnapshot={viewModel.reservationSnapshot}
            selectedRow={
              viewModel.rows.find((row) => row.reservationId === viewModel.selectedReservationId) ?? null
            }
          />
        </div>
      )}

      {viewModel.selectedReservationId && (
        <AdvancedDetailsPanel
          reservationSnapshot={viewModel.reservationSnapshot}
          listingSnapshot={viewModel.listingSnapshot}
          selectedReservationId={viewModel.selectedReservationId}
          selectedListingId={viewModel.selectedListingId}
        />
      )}

      {viewModel.actions.length > 0 && (
        <div className={styles.actionsSection}>
          <h2 className={styles.subHeading}>Aksiyonlar</h2>
          <p className={styles.eligibilityNote}>{buildEligibilityMessage(viewModel.actions)}</p>

          <div className={styles.inputGroup}>
            <label className={styles.label} htmlFor="ops-reason">
              Sebep (cancel/reopen icin zorunlu)
            </label>
            <input
              id="ops-reason"
              type="text"
              value={reasonText}
              onChange={(event) => setReasonText(event.target.value)}
              className={styles.input}
              placeholder="Iptal veya yeniden acma sebebi"
              disabled={actionPending !== null}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label} htmlFor="ops-note">
              Not (opsiyonel)
            </label>
            <input
              id="ops-note"
              type="text"
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              className={styles.input}
              placeholder="Ek not"
              disabled={actionPending !== null}
            />
          </div>

          <div className={styles.actionButtons}>
            {viewModel.actions.map((action) => (
              <ActionButton
                key={action.id}
                action={action}
                pending={actionPending === action.id}
                disabled={actionPending !== null || !action.enabled}
                onExecute={handleAction}
              />
            ))}
          </div>
        </div>
      )}

      {loading && <p className={styles.loadingText}>Guncelleniyor...</p>}
    </div>
  );
}

function OverviewTableRow({
  row,
  selected,
  onSelect,
}: {
  row: OperationsOverviewRow;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <tr
      className={selected ? styles.selectedRow : styles.row}
      onClick={() => onSelect(row.reservationId)}
    >
      <td>{row.listingTitle}</td>
      <td>{row.locationLabel || "-"}</td>
      <td>
        <StatusBadge status={row.reservationStatus} />
      </td>
      <td>
        <StatusBadge status={row.orderStatus} />
      </td>
      <td>
        <StatusBadge status={row.paymentStatus} />
      </td>
      <td>{row.amountLabel}</td>
      <td>{row.moveInDate}</td>
      <td>{row.stayMonthsLabel}</td>
    </tr>
  );
}

function MobileOverviewCard({
  row,
  selected,
  onSelect,
}: {
  row: OperationsOverviewRow;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.mobileCard} ${selected ? styles.mobileSelectedCard : ""}`.trim()}
      onClick={() => onSelect(row.reservationId)}
    >
      <div className={styles.mobileCardHeader}>
        <div>
          <span className={styles.mobileCardLabel}>{row.locationLabel || "Konum yok"}</span>
          <h2 className={styles.mobileCardTitle}>{row.listingTitle}</h2>
        </div>
        <StatusBadge status={row.reservationStatus} />
      </div>

      <div className={styles.mobileCardMeta}>
        <div className={styles.mobileCardMetaItem}>
          <span className={styles.mobileCardLabel}>Siparis</span>
          <StatusBadge status={row.orderStatus} />
        </div>
        <div className={styles.mobileCardMetaItem}>
          <span className={styles.mobileCardLabel}>Odeme</span>
          <StatusBadge status={row.paymentStatus} />
        </div>
        <div className={styles.mobileCardMetaItem}>
          <span className={styles.mobileCardLabel}>Tutar</span>
          <strong>{row.amountLabel}</strong>
        </div>
        <div className={styles.mobileCardMetaItem}>
          <span className={styles.mobileCardLabel}>Giris</span>
          <strong>{row.moveInDate}</strong>
        </div>
        <div className={styles.mobileCardMetaItem}>
          <span className={styles.mobileCardLabel}>Sure</span>
          <strong>{row.stayMonthsLabel}</strong>
        </div>
      </div>
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const classMap: Record<string, string> = {
    Beklemede: styles.badgeWarning,
    Onaylandi: styles.badgeSuccess,
    Basarili: styles.badgeSuccess,
    Tamamlandi: styles.badgeSuccess,
    "Iptal edildi": styles.badgeDanger,
    Basarisiz: styles.badgeDanger,
    "Iade edildi": styles.badgeNeutral,
    Uyusmazlik: styles.badgeDanger,
    "Suresi doldu": styles.badgeNeutral,
    Aktif: styles.badgeSuccess,
    Pasif: styles.badgeNeutral,
    Bilinmiyor: styles.badgeNeutral,
    pending: styles.badgeWarning,
    confirmed: styles.badgeSuccess,
    succeeded: styles.badgeSuccess,
    completed: styles.badgeSuccess,
    cancelled: styles.badgeDanger,
    failed: styles.badgeDanger,
    refunded: styles.badgeNeutral,
    conflict: styles.badgeDanger,
    expired: styles.badgeNeutral,
    active: styles.badgeSuccess,
    passive: styles.badgeNeutral,
    Yok: styles.badgeNeutral,
    unknown: styles.badgeNeutral,
  };

  return (
    <span className={`${styles.badge} ${classMap[status] ?? styles.badgeNeutral}`}>
      {status}
    </span>
  );
}

function PricingBreakdownCard({
  reservationSnapshot,
}: {
  reservationSnapshot: Record<string, unknown> | null;
}) {
  const breakdown = readPricingBreakdown(reservationSnapshot);
  if (!breakdown) {
    return null;
  }

  return (
    <div className={styles.snapshotCard}>
      <h3 className={styles.snapshotTitle}>Fiyat Kirilimi</h3>
      <dl className={styles.snapshotDl}>
        <div className={styles.snapshotItem}>
          <dt className={styles.snapshotDt}>Toplam Tutar</dt>
          <dd className={styles.snapshotDd}>{breakdown.totalLabel}</dd>
        </div>
        <div className={styles.snapshotItem}>
          <dt className={styles.snapshotDt}>Ana Kalemler</dt>
          <dd className={styles.snapshotDd}>
            <PricingItemsList items={breakdown.mainItems} />
          </dd>
        </div>
        <div className={styles.snapshotItem}>
          <dt className={styles.snapshotDt}>Ek Hizmetler</dt>
          <dd className={styles.snapshotDd}>
            <PricingItemsList items={breakdown.serviceItems} />
          </dd>
        </div>
      </dl>
    </div>
  );
}

function PricingItemsList({
  items,
}: {
  items: Array<{ label: string; amountLabel: string }>;
}) {
  if (items.length === 0) {
    return <span>-</span>;
  }

  return (
    <div className={styles.snapshotObject}>
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className={styles.snapshotNestedItem}>
          <span className={styles.snapshotNestedKey}>{item.label}</span>
          <span className={styles.snapshotNestedValue}>{item.amountLabel}</span>
        </div>
      ))}
    </div>
  );
}

function ReservationDetailsCard({
  reservationSnapshot,
}: {
  reservationSnapshot: Record<string, unknown> | null;
}) {
  const reservation = asRecord(reservationSnapshot?.reservation);
  if (!reservation) {
    return null;
  }

  const status = asString(reservation.status);
  const moveInDate = asString(reservation.move_in_date);
  const stayMonths = asNumber(reservation.stay_months);
  const guestCount = asNumber(reservation.guest_count);
  const note = asString(reservation.note);

  const items: Array<{ label: string; value: ReactNode }> = [];
  if (status) {
    items.push({ label: "Durum", value: <StatusBadge status={translateStatus(status)} /> });
  }
  if (moveInDate) {
    items.push({ label: "Giris tarihi", value: moveInDate });
  }
  if (stayMonths !== null) {
    items.push({ label: "Kalis suresi", value: formatStayMonths(stayMonths) });
  }
  if (guestCount !== null) {
    items.push({ label: "Misafir sayisi", value: formatGuestCount(guestCount) });
  }
  if (note) {
    items.push({ label: "Not", value: note });
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <SummaryCard title="Rezervasyon Bilgileri" items={items} />
  );
}

function ContactSummaryCard({
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
  if (fullName) {
    items.push({ label: "Ad soyad", value: fullName });
  }
  if (phone) {
    items.push({ label: "Telefon", value: phone });
  }
  if (email) {
    items.push({ label: "E-posta", value: email });
  }
  const contactMethodLabel = formatContactMethod(preferredMethod, preferredTime);
  if (contactMethodLabel) {
    items.push({ label: "Iletisim tercihi", value: contactMethodLabel });
  }
  if (occupant) {
    items.push({ label: "Kalacak kisi", value: occupant });
  }
  if (documentReadiness) {
    items.push({ label: "Evrak hazirligi", value: formatDocumentReadiness(documentReadiness) });
  }
  if (note) {
    items.push({ label: "Iletisim notu", value: note });
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <SummaryCard title="Iletisim Bilgileri" items={items} />
  );
}

function ListingSummaryCard({
  listingSnapshot,
  reservationSnapshot,
  selectedRow,
}: {
  listingSnapshot: Record<string, unknown> | null;
  reservationSnapshot: Record<string, unknown> | null;
  selectedRow: OperationsOverviewRow | null;
}) {
  const listingFromListingSnapshot = asRecord(listingSnapshot?.listing);
  const listingFromReservationSnapshot = asRecord(reservationSnapshot?.listing);

  const title =
    asString(listingFromListingSnapshot?.title) ??
    asString(listingFromReservationSnapshot?.title) ??
    (selectedRow ? selectedRow.listingTitle : null);
  const city =
    asString(listingFromListingSnapshot?.city) ??
    asString(listingFromReservationSnapshot?.city) ??
    null;
  const district =
    asString(listingFromListingSnapshot?.district) ??
    asString(listingFromReservationSnapshot?.district) ??
    null;
  const status =
    asString(listingFromListingSnapshot?.status) ??
    asString(listingFromReservationSnapshot?.status) ??
    null;

  const locationLabel = [city, district].filter((part): part is string => Boolean(part)).join(" / ")
    || (selectedRow ? selectedRow.locationLabel : "");

  const items: Array<{ label: string; value: ReactNode }> = [];
  if (title) {
    items.push({ label: "Ilan", value: title });
  }
  if (locationLabel) {
    items.push({ label: "Konum", value: locationLabel });
  }
  if (status) {
    items.push({ label: "Durum", value: <StatusBadge status={translateStatus(status)} /> });
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <SummaryCard title="Ilan Bilgileri" items={items} />
  );
}

function SummaryCard({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <div className={styles.summaryCard}>
      <div className={styles.summaryHeader}>
        <h3 className={styles.snapshotTitle}>{title}</h3>
      </div>
      <dl className={styles.summaryList}>
        {items.map((item) => (
          <div key={item.label} className={styles.summaryItem}>
            <dt className={styles.snapshotDt}>{item.label}</dt>
            <dd className={styles.summaryMeta}>
              <span className={styles.summaryValueStrong}>{item.value}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function AdvancedDetailsPanel({
  reservationSnapshot,
  listingSnapshot,
  selectedReservationId,
  selectedListingId,
}: {
  reservationSnapshot: Record<string, unknown> | null;
  listingSnapshot: Record<string, unknown> | null;
  selectedReservationId: string | null;
  selectedListingId: string | null;
}) {
  const order = asRecord(reservationSnapshot?.order);
  const payment = asRecord(reservationSnapshot?.payment);
  const reservationLatest = asRecord(reservationSnapshot?.latestEvent);
  const listingLatest = asRecord(listingSnapshot?.latestEvent);
  const reservationEligibility = asRecord(reservationSnapshot?.eligibility);
  const listingEligibility = asRecord(listingSnapshot?.eligibility);

  const ids: Array<{ label: string; value: string }> = [];
  if (selectedReservationId) {
    ids.push({ label: "Rezervasyon", value: selectedReservationId });
  }
  const orderId = asString(order?.id);
  if (orderId) {
    ids.push({ label: "Siparis", value: orderId });
  }
  const paymentId = asString(payment?.id);
  if (paymentId) {
    ids.push({ label: "Odeme", value: paymentId });
  }
  if (selectedListingId) {
    ids.push({ label: "Ilan", value: selectedListingId });
  }

  const reservationEvent = formatLatestEventLine(reservationLatest);
  const listingEvent = formatLatestEventLine(listingLatest);
  const eligibilityLines = formatEligibilityLines({
    reservationEligibility,
    listingEligibility,
    selectedListingId,
  });

  if (ids.length === 0 && !reservationEvent && !listingEvent && eligibilityLines.length === 0) {
    return null;
  }

  return (
    <details className={styles.advancedDetails}>
      <summary className={styles.advancedSummary}>Gelismis detaylar</summary>
      <dl className={styles.snapshotDl}>
        {ids.length > 0 && (
          <div className={styles.snapshotItem}>
            <dt className={styles.snapshotDt}>Kimlikler</dt>
            <dd className={styles.snapshotDd}>
              <div className={styles.snapshotObject}>
                {ids.map((entry) => (
                  <div key={entry.label} className={styles.snapshotNestedItem}>
                    <span className={styles.snapshotNestedKey}>{entry.label}</span>
                    <span className={`${styles.snapshotNestedValue} ${styles.techId}`}>{entry.value}</span>
                  </div>
                ))}
              </div>
            </dd>
          </div>
        )}
        {reservationEvent && (
          <div className={styles.snapshotItem}>
            <dt className={styles.snapshotDt}>Son rezervasyon islemi</dt>
            <dd className={styles.snapshotDd}>{reservationEvent}</dd>
          </div>
        )}
        {listingEvent && (
          <div className={styles.snapshotItem}>
            <dt className={styles.snapshotDt}>Son ilan islemi</dt>
            <dd className={styles.snapshotDd}>{listingEvent}</dd>
          </div>
        )}
        {eligibilityLines.length > 0 && (
          <div className={styles.snapshotItem}>
            <dt className={styles.snapshotDt}>Backend izinleri</dt>
            <dd className={styles.snapshotDd}>
              <div className={styles.snapshotObject}>
                {eligibilityLines.map((entry) => (
                  <div key={entry.label} className={styles.snapshotNestedItem}>
                    <span className={styles.snapshotNestedKey}>{entry.label}</span>
                    <span className={styles.snapshotNestedValue}>{entry.value}</span>
                  </div>
                ))}
              </div>
            </dd>
          </div>
        )}
      </dl>
    </details>
  );
}

function ActionButton({
  action,
  pending,
  disabled,
  onExecute,
}: {
  action: OperationsActionViewModel;
  pending: boolean;
  disabled: boolean;
  onExecute: (id: OperationsActionId) => void;
}) {
  const classMap: Record<OperationsActionId, string> = {
    cancel: styles.actionCancel,
    confirm: styles.actionConfirm,
    reopen: styles.actionReopen,
  };

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        title={action.disabledReason ?? undefined}
        onClick={() => onExecute(action.id)}
        className={`${styles.actionButton} ${classMap[action.id]}`}
      >
        {pending ? "Isleniyor..." : action.label}
      </button>
      {disabled && action.disabledReason && !pending ? (
        <p className={styles.actionReason}>{action.disabledReason}</p>
      ) : null}
    </div>
  );
}

function safeErrorMessage(err: unknown): string {
  if (err instanceof AdminOperationsClientError) {
    return err.message;
  }

  if (err instanceof AdminOperationsActionValidationError) {
    return err.message;
  }

  return "Beklenmeyen bir hata olustu.";
}

function formatContactMethod(method: string | null, time: string | null): string | null {
  const methodMap: Record<string, string> = {
    phone: "Telefon",
    whatsapp: "WhatsApp",
    sms: "SMS",
    email: "E-posta",
  };

  const label = method ? methodMap[method.toLowerCase()] ?? method : null;
  if (!label && !time) {
    return null;
  }

  if (label && time) {
    return `${label} (${time})`;
  }

  return label ?? time;
}

function formatDocumentReadiness(value: string): string {
  const map: Record<string, string> = {
    ready: "Hazir",
    needs_help: "Yardim gerekiyor",
    later: "Daha sonra",
  };

  return map[value.toLowerCase()] ?? value;
}

function formatStayMonths(value: number): string {
  return `${value} ay`;
}

function formatGuestCount(value: number): string {
  return `${value} kisi`;
}

function formatMoney(amount: number, currency: string | null): string {
  const formattedAmount = amount.toLocaleString("tr-TR");
  return currency ? `${formattedAmount} ${currency}` : formattedAmount;
}

function formatWorkflowName(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const map: Record<string, string> = {
    admin_cancel_reservation: "Rezervasyon iptali",
    admin_cancel_reservation_rejected: "Rezervasyon iptali reddedildi",
    admin_confirm_reservation: "Rezervasyon onayi",
    admin_confirm_reservation_rejected: "Rezervasyon onayi reddedildi",
    admin_reopen_listing: "Ilan yeniden acildi",
    admin_reopen_listing_rejected: "Ilan yeniden acma reddedildi",
  };

  return map[value] ?? value;
}

function formatLatestEventLine(event: Record<string, unknown> | null): string | null {
  if (!event) {
    return null;
  }

  const workflow = formatWorkflowName(asString(event.workflow_name));
  const reason = asString(event.reason);
  const note = asString(event.note);
  const createdAt = asString(event.created_at);

  if (!workflow && !reason && !note && !createdAt) {
    return null;
  }

  const parts: string[] = [];
  if (workflow) {
    parts.push(workflow);
  }
  if (reason) {
    parts.push(`Sebep: ${reason}`);
  }
  if (note) {
    parts.push(`Not: ${note}`);
  }
  if (createdAt) {
    parts.push(createdAt);
  }

  return parts.join(" - ");
}

function formatEligibilityLines(input: {
  reservationEligibility: Record<string, unknown> | null;
  listingEligibility: Record<string, unknown> | null;
  selectedListingId: string | null;
}): Array<{ label: string; value: string }> {
  const lines: Array<{ label: string; value: string }> = [];
  const reservationEligibility = input.reservationEligibility;
  if (reservationEligibility) {
    if (reservationEligibility.can_cancel !== undefined) {
      lines.push({
        label: "Iptal",
        value: reservationEligibility.can_cancel === true ? "Evet" : "Hayir",
      });
    }
    if (reservationEligibility.can_confirm !== undefined) {
      lines.push({
        label: "Onay",
        value: reservationEligibility.can_confirm === true ? "Evet" : "Hayir",
      });
    }
  }

  if (input.selectedListingId && input.listingEligibility) {
    if (input.listingEligibility.can_reopen !== undefined) {
      lines.push({
        label: "Ilan yeniden acma",
        value: input.listingEligibility.can_reopen === true ? "Evet" : "Hayir",
      });
    }
  }

  return lines;
}

function buildEligibilityMessage(actions: OperationsActionViewModel[]): string {
  const enabled = actions.filter((action) => action.enabled).map((action) => action.label);
  if (enabled.length === 0) {
    return "Bu rezervasyon icin su anda manuel aksiyon uygulanamiyor.";
  }

  return `Su anda izin verilen aksiyonlar: ${enabled.join(", ")}.`;
}

function translateStatus(status: string): string {
  const map: Record<string, string> = {
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

  return map[status.toLowerCase()] ?? status;
}

function readPricingBreakdown(reservationSnapshot: Record<string, unknown> | null): {
  totalLabel: string;
  mainItems: Array<{ label: string; amountLabel: string }>;
  serviceItems: Array<{ label: string; amountLabel: string }>;
} | null {
  if (!reservationSnapshot || typeof reservationSnapshot !== "object") {
    return null;
  }

  const order = asRecord(reservationSnapshot.order);
  const orderItemsRaw = reservationSnapshot.orderItems;
  if (!Array.isArray(orderItemsRaw) || orderItemsRaw.length === 0) {
    return null;
  }

  const currency = asString(order?.currency);
  const totalAmount = asNumber(order?.total_amount);
  const items = orderItemsRaw
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object")
    .map((item) => ({
      itemType: asString(item.itemType) ?? "unknown",
      label: asString(item.label) ?? "Isimsiz kalem",
      amount: asNumber(item.amount),
    }))
    .filter((item) => item.amount !== null)
    .map((item) => ({
      ...item,
      amountLabel: formatAmountLabel(item.amount as number, currency),
    }));

  if (items.length === 0) {
    return null;
  }

  return {
    totalLabel: totalAmount === null ? "-" : formatAmountLabel(totalAmount, currency),
    mainItems: items
      .filter((item) => item.itemType === "main_item")
      .map((item) => ({ label: item.label, amountLabel: item.amountLabel })),
    serviceItems: items
      .filter((item) => item.itemType === "service_item")
      .map((item) => ({ label: item.label, amountLabel: item.amountLabel })),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
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

function formatAmountLabel(amount: number, currency: string | null): string {
  return formatMoney(amount, currency);
}
