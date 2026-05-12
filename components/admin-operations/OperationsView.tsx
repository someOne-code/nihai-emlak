"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock3 } from "lucide-react";

import {
  AdminOperationsClientError,
  loadAdminOperationsOverview,
  type AdminOperationsOverview,
} from "@/lib/admin-ui/operations-client.ts";
import {
  createInitialLoadGuard,
  shouldStartInitialLoad,
} from "@/lib/admin-ui/initial-load-guard.ts";
import {
  createContentRefreshGate,
  refreshContentViews,
  shouldRefreshContentOnResume,
} from "@/lib/admin-ui/content-refresh.ts";
import {
  AdminOperationsActionValidationError,
  executeOperationsAction,
  loadOperationsModel,
  updateOperationsDocumentTracking,
  updateOperationsFinanceOps,
  type OperationsDocumentStatus,
  type OperationsFinanceStatus,
} from "@/lib/admin-ui/operations-controller.ts";
import type {
  OperationsActionId,
  OperationsOverviewRow,
  OperationsViewModel,
} from "@/lib/admin-ui/operations-view-model.ts";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { OperationsStatusBadge } from "./OperationsStatusBadge";
import { OperationsActionPanel } from "./OperationsActionPanel";
import {
  PricingBreakdownCard,
  ReservationDetailsCard,
  ContactSummaryCard,
  ListingSummaryCard,
} from "./OperationsSnapshotCards";
import { OperationsAdvancedDetails } from "./OperationsAdvancedDetails";
import {
  OperationsFilters,
  applyFilters,
  toBackendFilters,
  INITIAL_FILTER_STATE,
  type OperationsFilterState,
} from "./OperationsFilters";
import { createOperationsFilterRefreshController } from "@/lib/admin-ui/operations-filter-refresh.ts";
import { OperationsTimeline } from "./OperationsTimeline";
import { OperationsDocumentTrackingCard } from "./OperationsDocumentTrackingCard";
import { OperationsFinanceOpsCard } from "./OperationsFinanceOpsCard";
import { EmptyState } from "./EmptyState";

const INITIAL_VIEW_MODEL: OperationsViewModel = {
  rows: [],
  selectedReservationId: null,
  selectedListingId: null,
  reservationSnapshot: null,
  documentTracking: null,
  eventHistory: [],
  financeOps: null,
  listingSnapshot: null,
  actions: [],
};

export default function OperationsView() {
  const [viewModel, setViewModel] = useState<OperationsViewModel>(INITIAL_VIEW_MODEL);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<OperationsActionId | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [documentPending, setDocumentPending] = useState<OperationsDocumentStatus | null>(null);
  const [documentNoteText, setDocumentNoteText] = useState("");
  const [documentNoteError, setDocumentNoteError] = useState<string | null>(null);
  const [financePending, setFinancePending] = useState<OperationsFinanceStatus | null>(null);
  const [financeNoteText, setFinanceNoteText] = useState("");
  const [financeNoteError, setFinanceNoteError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [refundDecision, setRefundDecision] = useState<"manual_refund" | "no_refund">("manual_refund");
  const [expiredDepositConfirmOpen, setExpiredDepositConfirmOpen] = useState(false);
  const [filters, setFilters] = useState<OperationsFilterState>(INITIAL_FILTER_STATE);

  const mountedRef = useRef(true);
  const initialLoadGuardRef = useRef(createInitialLoadGuard());
  const resumeRefreshGateRef = useRef(createContentRefreshGate());
  const loadRequestSeqRef = useRef(0);
  const overviewRef = useRef<AdminOperationsOverview | null>(null);
  const detailStartRef = useRef<HTMLDivElement | null>(null);
  const filterRefreshControllerRef = useRef<ReturnType<typeof createOperationsFilterRefreshController> | null>(null);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      filterRefreshControllerRef.current?.cancelPending();
    };
  }, []);

  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const clearFieldErrors = useCallback(() => {
    setDocumentNoteError(null);
    setFinanceNoteError(null);
    setNoteError(null);
  }, []);

  const setScopedNoteError = useCallback((scope: "action" | "document" | "finance", err: unknown) => {
    if (!(err instanceof AdminOperationsActionValidationError)) {
      return false;
    }

    const message = safeErrorMessage(err);
    if (scope === "document") {
      setDocumentNoteError(message);
    } else if (scope === "finance") {
      setFinanceNoteError(message);
    } else {
      setNoteError(message);
    }
    return true;
  }, []);

  const loadData = useCallback(async (selectedReservationId?: string | null, useOverviewCache = false) => {
    const requestSeq = loadRequestSeqRef.current + 1;
    loadRequestSeqRef.current = requestSeq;
    setLoading(true);
    setError(null);

    try {
      const backendFilters = toBackendFilters(filtersRef.current);
      let overview: AdminOperationsOverview | undefined;
      if (useOverviewCache && overviewRef.current) {
        overview = overviewRef.current;
      } else {
        overview = await loadAdminOperationsOverview(undefined, backendFilters);
        overviewRef.current = overview;
      }
      const nextViewModel = await loadOperationsModel(undefined, selectedReservationId, backendFilters, overview);
      if (loadRequestSeqRef.current !== requestSeq) return;
      if (!mountedRef.current) return;
      setViewModel(nextViewModel);
    } catch (err) {
      if (loadRequestSeqRef.current !== requestSeq) return;
      if (!mountedRef.current) return;
      if (handleAdminAuthError(err)) return;
      setError(safeErrorMessage(err));
    } finally {
      if (mountedRef.current && loadRequestSeqRef.current === requestSeq) {
        setLoading(false);
        setActionPending(null);
        setDocumentPending(null);
        setFinancePending(null);
      }
    }
  }, []);

  if (!filterRefreshControllerRef.current) {
    filterRefreshControllerRef.current = createOperationsFilterRefreshController({
      delayMs: 250,
      loadData: (selectedReservationId) => {
        void loadData(selectedReservationId);
      },
    });
  }

  useEffect(() => {
    if (!shouldStartInitialLoad(initialLoadGuardRef.current)) {
      return;
    }

    loadData();
  }, [clearFieldErrors, loadData]);

  useEffect(() => {
    const refreshOnResume = () => {
      if (document.visibilityState === "hidden") {
        return;
      }
      if (!shouldRefreshContentOnResume(resumeRefreshGateRef.current)) {
        return;
      }

      void refreshContentViews([
        () => loadData(viewModel.selectedReservationId),
      ]);
    };

    window.addEventListener("focus", refreshOnResume);
    document.addEventListener("visibilitychange", refreshOnResume);
    return () => {
      window.removeEventListener("focus", refreshOnResume);
      document.removeEventListener("visibilitychange", refreshOnResume);
    };
  }, [loadData, viewModel.selectedReservationId]);

  const handleFilterChange = useCallback((next: OperationsFilterState) => {
    setActionError(null);
    clearFieldErrors();
    setActionSuccess(null);
    const prev = filtersRef.current;
    setFilters(next);
    filtersRef.current = next;
    filterRefreshControllerRef.current?.applyFilterChange(next, prev);
  }, [clearFieldErrors]);

  const handleClearFilters = useCallback(() => {
    setActionError(null);
    clearFieldErrors();
    setActionSuccess(null);
    setFilters(INITIAL_FILTER_STATE);
    filtersRef.current = INITIAL_FILTER_STATE;
    loadData();
  }, [clearFieldErrors, loadData]);

  const handleShowPending = useCallback(() => {
    const next: OperationsFilterState = { ...INITIAL_FILTER_STATE, queue: "payment_waiting" };
    setActionError(null);
    clearFieldErrors();
    setActionSuccess(null);
    setFilters(next);
    filtersRef.current = next;
    loadData();
  }, [clearFieldErrors, loadData]);

  const handleRowSelect = useCallback((row: OperationsOverviewRow) => {
    setActionError(null);
    clearFieldErrors();
    setActionSuccess(null);
    setDocumentPending(null);
    setDocumentNoteText("");
    setDocumentNoteError(null);
    setFinancePending(null);
    setFinanceNoteText("");
    setFinanceNoteError(null);
    setNoteText("");
    setNoteError(null);
    setRefundDecision("manual_refund");
    setExpiredDepositConfirmOpen(false);
    const currentFilters = filtersRef.current;
    if (currentFilters.queue === "all" && row.queue !== "all") {
      const nextFilters: OperationsFilterState = { ...currentFilters, queue: row.queue };
      setFilters(nextFilters);
      filtersRef.current = nextFilters;
    }
    detailStartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    loadData(row.reservationId, true);
  }, [clearFieldErrors, loadData]);

  const handleAction = useCallback(async (actionId: OperationsActionId) => {
    const selectedReservationId = viewModel.selectedReservationId;
    const selectedListingId = viewModel.selectedListingId;

    setActionPending(actionId);
    setActionError(null);
    setNoteError(null);
    setActionSuccess(null);

    try {
      const result = await executeOperationsAction(undefined, {
        actionId,
        refundDecision,
        noteText,
        reasonText: noteText,
        selectedListingId,
        selectedReservationId,
      });

      if (!mountedRef.current) return;
      setActionSuccess(result.message);
      setNoteText("");
      setRefundDecision("manual_refund");
      await loadData(result.refreshReservationId);
    } catch (err) {
      if (!mountedRef.current) return;
      if (handleAdminAuthError(err)) return;
      if (setScopedNoteError("action", err)) {
        setActionPending(null);
        return;
      }
      setActionError(safeErrorMessage(err));
      setActionPending(null);
    }
  }, [loadData, noteText, refundDecision, setScopedNoteError, viewModel.selectedListingId, viewModel.selectedReservationId]);

  const handleDocumentUpdate = useCallback(async (status: OperationsDocumentStatus) => {
    const selectedReservationId = viewModel.selectedReservationId;

    setDocumentPending(status);
    setActionError(null);
    setDocumentNoteError(null);
    setActionSuccess(null);

    try {
      const result = await updateOperationsDocumentTracking(undefined, {
        selectedReservationId,
        status,
        noteText: documentNoteText,
      });

      if (!mountedRef.current) return;
      setActionSuccess(result.message);
      setDocumentNoteText("");
      if (status === "completed") {
        const nextFilters: OperationsFilterState = { ...INITIAL_FILTER_STATE, queue: "completed" };
        setFilters(nextFilters);
        filtersRef.current = nextFilters;
      }
      await loadData(result.refreshReservationId);
    } catch (err) {
      if (!mountedRef.current) return;
      if (handleAdminAuthError(err)) return;
      if (setScopedNoteError("document", err)) {
        setDocumentPending(null);
        return;
      }
      setActionError(safeErrorMessage(err));
      setDocumentPending(null);
    }
  }, [documentNoteText, loadData, setScopedNoteError, viewModel.selectedReservationId]);

  const handleFinanceUpdate = useCallback(async (status: OperationsFinanceStatus) => {
    const selectedReservationId = viewModel.selectedReservationId;

    setFinancePending(status);
    setActionError(null);
    setFinanceNoteError(null);
    setActionSuccess(null);

    try {
      const result = await updateOperationsFinanceOps(undefined, {
        selectedReservationId,
        status,
        noteText: financeNoteText,
      });

      if (!mountedRef.current) return;
      setFinanceNoteText("");
      if (status === "issue_resolved") {
        setActionSuccess(null);
        const nextFilters: OperationsFilterState = { ...INITIAL_FILTER_STATE, queue: "document_waiting" };
        setFilters(nextFilters);
        filtersRef.current = nextFilters;
      } else if (status === "payment_not_received") {
        setActionSuccess(null);
        const nextFilters: OperationsFilterState = { ...INITIAL_FILTER_STATE, queue: "all" };
        setFilters(nextFilters);
        filtersRef.current = nextFilters;
      } else if (status === "refund_completed" || status === "deposit_forfeited") {
        setActionSuccess(result.message);
        const nextFilters: OperationsFilterState = { ...INITIAL_FILTER_STATE, queue: "all" };
        setFilters(nextFilters);
        filtersRef.current = nextFilters;
      } else {
        setActionSuccess(result.message);
      }
      await loadData(result.refreshReservationId);
    } catch (err) {
      if (!mountedRef.current) return;
      if (handleAdminAuthError(err)) return;
      if (setScopedNoteError("finance", err)) {
        setFinancePending(null);
        return;
      }
      setActionError(safeErrorMessage(err));
      setFinancePending(null);
    }
  }, [financeNoteText, loadData, setScopedNoteError, viewModel.selectedReservationId]);

  const handleRefundRequestApprove = useCallback(async () => {
    const selectedReservationId = viewModel.selectedReservationId;
    const selectedListingId = viewModel.selectedListingId;

    if (
      !expiredDepositConfirmOpen &&
      financeNoteText.trim().length > 0 &&
      isExpiredDepositRefundCandidate(viewModel.reservationSnapshot)
    ) {
      setFinanceNoteError(null);
      setActionError(null);
      setExpiredDepositConfirmOpen(true);
      return;
    }

    setFinancePending("refund_requested");
    setActionError(null);
    setFinanceNoteError(null);
    setActionSuccess(null);
    setExpiredDepositConfirmOpen(false);

    try {
      const result = await executeOperationsAction(undefined, {
        actionId: "cancel",
        refundDecision: "manual_refund",
        noteText: financeNoteText,
        reasonText: financeNoteText,
        selectedListingId,
        selectedReservationId,
      });

      if (!mountedRef.current) return;
      setActionSuccess("İptal talebi onaylandı. Rezervasyon iptal edildi ve kayıt manuel iade kuyruğuna alındı.");
      setFinanceNoteText("");
      const nextFilters: OperationsFilterState = { ...INITIAL_FILTER_STATE, queue: "manual_refunds" };
      setFilters(nextFilters);
      filtersRef.current = nextFilters;
      await loadData(result.refreshReservationId);
    } catch (err) {
      if (!mountedRef.current) return;
      if (handleAdminAuthError(err)) return;
      if (setScopedNoteError("finance", err)) {
        setFinancePending(null);
        return;
      }
      setActionError(safeErrorMessage(err));
      setFinancePending(null);
    }
  }, [expiredDepositConfirmOpen, financeNoteText, loadData, setScopedNoteError, viewModel.reservationSnapshot, viewModel.selectedListingId, viewModel.selectedReservationId]);

  const filteredRows = useMemo(
    () => applyFilters(viewModel.rows, filters),
    [viewModel.rows, filters],
  );

  const hasActiveFilters =
    filters.search !== "" ||
    filters.queue !== "all" ||
    filters.reservationStatus !== "all" ||
    filters.paymentStatus !== "all";

  const selectedRow =
    filteredRows.find((r) => r.reservationId === viewModel.selectedReservationId) ?? null;
  const effectiveSelectedReservationId = selectedRow?.reservationId ?? null;
  const isAllQueue = filters.queue === "all";
  const shouldRenderDetailPanels = !isAllQueue && !!effectiveSelectedReservationId;
  const isReservationAlreadyConfirmed = getNestedStatus(viewModel.reservationSnapshot, "reservation") === "confirmed";
  const hasActiveFinanceActions = (viewModel.financeOps?.allowedStatuses.length ?? 0) > 0;
  const hasActiveDocumentActions =
    !hasActiveFinanceActions && (viewModel.documentTracking?.allowedStatuses.length ?? 0) > 0;
  const shouldShowDocumentTracking =
    shouldRenderDetailPanels &&
    filters.queue === "document_waiting" &&
    !hasActiveFinanceActions;

  // Loading skeleton
  if (loading && viewModel.rows.length === 0) {
    return (
      <div className="mx-auto max-w-screen-xl space-y-6 p-4 md:p-6">
        <h1 className="text-2xl font-bold tracking-tight">Operasyon Yönetimi</h1>
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  // Error state
  if (error && viewModel.rows.length === 0) {
    return (
      <div className="mx-auto max-w-screen-xl space-y-4 p-4 md:p-6">
        <h1 className="text-2xl font-bold tracking-tight">Operasyon Yönetimi</h1>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
        <Button variant="outline" onClick={() => loadData()}>
          Tekrar dene
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Operasyon Yönetimi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Rezervasyonları seç, özetleri incele ve izin verilen aksiyonları bu ekrandan yönet.
        </p>
      </div>

      {/* Banners */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {actionError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div className="rounded-lg border border-emerald-500/50 bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
          {actionSuccess}
        </div>
      )}

      {/* Filters */}
      <OperationsFilters filters={filters} onChange={handleFilterChange} />

      <div className="grid gap-5 xl:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
        <Card className="min-w-0 xl:sticky xl:top-20 xl:max-h-[calc(100vh-7rem)] xl:self-start">
          <CardHeader className="gap-1 p-4 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-base">Operasyon kuyruğu</CardTitle>
                <CardDescription>
                  {filteredRows.length} kayıt gösteriliyor
                </CardDescription>
              </div>
              {loading && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  Güncelleniyor
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {filteredRows.length === 0 ? (
              <div className="py-6">
                <EmptyState
                  isEmpty={!hasActiveFilters && viewModel.rows.length === 0}
                  onClearFilters={handleClearFilters}
                  onShowPending={handleShowPending}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-2 overflow-y-auto pr-1 xl:max-h-[calc(100vh-13rem)]">
                {filteredRows.map((row) => (
                  <MobileOverviewCard
                    key={row.reservationId}
                    row={row}
                    selected={row.reservationId === viewModel.selectedReservationId}
                    onSelect={handleRowSelect}
                  />
                ))}
              </div>
            )}
          </CardContent>

        </Card>

        <div ref={detailStartRef} className="min-w-0 scroll-mt-24 space-y-4">

      {/* Empty selection state - only when there are visible rows but none selected */}
      {!shouldRenderDetailPanels && !isAllQueue && filteredRows.length > 0 && (
        <Card className="flex flex-col items-center gap-2 p-6 text-center">
          <Clock3 className="h-6 w-6 text-muted-foreground/60" aria-hidden />
          <p className="text-sm font-medium text-foreground">Bir rezervasyon seçin</p>
          <p className="text-xs text-muted-foreground">
            Detayları, ödeme bilgilerini ve aksiyonları görmek için listeden bir kayıt seçin.
          </p>
        </Card>
      )}

      {/* Core hierarchy */}
      {shouldRenderDetailPanels && (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          <ReservationDetailsCard reservationSnapshot={viewModel.reservationSnapshot} />
          <ListingSummaryCard
            listingSnapshot={viewModel.listingSnapshot}
            reservationSnapshot={viewModel.reservationSnapshot}
            selectedRow={selectedRow}
          />
          <PricingBreakdownCard
            reservationSnapshot={viewModel.reservationSnapshot}
            actions={viewModel.actions}
            documentTracking={viewModel.documentTracking}
            financeOps={viewModel.financeOps}
            listingSnapshot={viewModel.listingSnapshot}
          />
        </div>
      )}

      {shouldRenderDetailPanels && (
        <ContactSummaryCard reservationSnapshot={viewModel.reservationSnapshot} />
      )}

      {shouldShowDocumentTracking && (
        <OperationsDocumentTrackingCard
          documentTracking={viewModel.documentTracking}
          disabled={loading}
          noteText={documentNoteText}
          noteError={documentNoteError}
          pendingStatus={documentPending}
          onNoteChange={(value) => {
            setDocumentNoteText(value);
            setDocumentNoteError(null);
          }}
          onUpdate={handleDocumentUpdate}
        />
      )}

      {shouldRenderDetailPanels && viewModel.financeOps?.hasVisibleWork && (
        <OperationsFinanceOpsCard
          financeOps={viewModel.financeOps}
          disabled={loading}
          noteText={financeNoteText}
          noteError={financeNoteError}
          pendingStatus={financePending}
          onApproveRefundRequest={handleRefundRequestApprove}
          onNoteChange={(value) => {
            setFinanceNoteText(value);
            setFinanceNoteError(null);
          }}
          onUpdate={handleFinanceUpdate}
        />
      )}

      {/* Timeline */}
      {shouldRenderDetailPanels && (
        <OperationsTimeline
          reservationSnapshot={viewModel.reservationSnapshot}
          listingSnapshot={viewModel.listingSnapshot}
          documentTracking={viewModel.documentTracking}
          eventHistory={viewModel.eventHistory}
          financeOps={viewModel.financeOps}
        />
      )}

      {/* Advanced details */}
      {shouldRenderDetailPanels && (
        <OperationsAdvancedDetails
          reservationSnapshot={viewModel.reservationSnapshot}
          listingSnapshot={viewModel.listingSnapshot}
          selectedReservationId={viewModel.selectedReservationId}
          selectedListingId={viewModel.selectedListingId}
        />
      )}

      {/* Actions */}
      {shouldRenderDetailPanels && !isReservationAlreadyConfirmed && !hasActiveFinanceActions && !hasActiveDocumentActions && viewModel.actions.length > 0 && (
        <OperationsActionPanel
          actions={viewModel.actions}
          actionPending={actionPending}
          noteText={noteText}
          noteError={noteError}
          refundDecision={refundDecision}
          onRefundDecisionChange={setRefundDecision}
          onNoteChange={(value) => {
            setNoteText(value);
            setNoteError(null);
          }}
          onExecute={handleAction}
        />
      )}

      {loading && (
        <p className="text-sm italic text-muted-foreground">Güncelleniyor...</p>
      )}
        </div>
      </div>
      <AlertDialog open={expiredDepositConfirmOpen} onOpenChange={setExpiredDepositConfirmOpen}>
        <AlertDialogHeader>
          <AlertDialogTitle>Kapora iade süresi dolmuş</AlertDialogTitle>
          <AlertDialogDescription>
            Bu kapora ödemesinin üzerinden 14 günden fazla geçmiş. Normal kurala göre iade süresi dolmuş görünüyor. Yine de manuel iade sürecini başlatmak istiyor musunuz?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button type="button" variant="outline" onClick={() => setExpiredDepositConfirmOpen(false)}>
            Vazgeç
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={financePending !== null}
            onClick={() => void handleRefundRequestApprove()}
          >
            Evet, manuel iade başlat
          </Button>
        </AlertDialogFooter>
      </AlertDialog>
    </div>
  );
}

function formatAdminOperationsClientError(err: AdminOperationsClientError): string {
  if (err.status === 401 || err.message === "Authentication required") {
    return "Oturumunuz sona erdi. Giriş sayfasına yönlendiriliyorsunuz.";
  }

  if (err.status === 403 || err.message === "Admin role required") {
    return "Bu sayfayı görüntülemek için admin yetkisi gerekiyor.";
  }

  return "Operasyon bilgileri alınamadı. Lütfen tekrar deneyin.";
}

// Mobile card

function MobileOverviewCard({
  row,
  selected,
  onSelect,
}: {
  row: OperationsOverviewRow;
  selected: boolean;
  onSelect: (row: OperationsOverviewRow) => void;
}) {
  return (
    <button
      type="button"
      className={`w-full rounded-xl border p-4 text-left transition-colors ${
        selected
          ? "border-primary bg-primary/5"
          : "bg-card hover:bg-muted/50"
      }`}
      onClick={() => onSelect(row)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-xs font-medium text-muted-foreground">
            {row.locationLabel || "Konum yok"}
          </span>
          <h2 className="truncate text-sm font-bold">{row.listingTitle}</h2>
        </div>
        <OperationsStatusBadge status={row.primaryStatus} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <MobileMetaItem label="Operasyon"><span className="sr-only">Operasyon</span><OperationsStatusBadge status={row.primaryStatus} /></MobileMetaItem>
        <MobileMetaItem label={row.orderRecordLabel}><span className="sr-only">{row.orderRecordLabel}</span><OperationsStatusBadge status={row.orderStatus} /></MobileMetaItem>
        <MobileMetaItem label="Banka ödemesi"><span className="sr-only">Banka ödemesi</span><OperationsStatusBadge status={row.paymentStatus} /></MobileMetaItem>
        <MobileMetaItem label="Tutar"><strong>{row.amountLabel}</strong></MobileMetaItem>
        <MobileMetaItem label="Giriş"><strong>{row.moveInDate}</strong></MobileMetaItem>
        <MobileMetaItem label="Süre"><strong>{row.stayMonthsLabel}</strong></MobileMetaItem>
      </div>
    </button>
  );
}

function MobileMetaItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div>{children}</div>
    </div>
  );
}

// Helpers

function isExpiredDepositRefundCandidate(snapshot: Record<string, unknown> | null): boolean {
  if (!snapshot) return false;

  const payment = asRecord(snapshot.payment);
  const paymentStatus = asString(payment?.status)?.toLowerCase();
  if (paymentStatus !== "succeeded") return false;

  const paymentDate = asString(payment?.updated_at) ?? asString(payment?.created_at);
  const elapsedDays = paymentDate ? daysSince(paymentDate) : null;
  if (elapsedDays === null || elapsedDays <= 14) return false;

  const orderItems = Array.isArray(snapshot.orderItems) ? snapshot.orderItems : [];
  return orderItems.some((item) => {
    const record = asRecord(item);
    if (!record) return false;
    const itemType = asString(record.itemType);
    if (itemType !== "main_item") return false;
    const code = asString(record.code)?.toLowerCase() ?? "";
    const label = asString(record.label)?.toLocaleLowerCase("tr-TR") ?? "";
    return code === "deposit" || label.includes("kapora");
  });
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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  return value.trim();
}

function getNestedStatus(snapshot: Record<string, unknown> | null, key: string): string | null {
  const record = asRecord(snapshot?.[key]);
  return asString(record?.status);
}

function safeErrorMessage(err: unknown): string {
  if (err instanceof AdminOperationsClientError) {
    if (err.status === 409 || err.message === "Admin workflow conflict") {
      return "Bu işlem mevcut kayıt durumunda yapılamaz. Sayfayı yenileyip izin verilen aksiyonları kontrol edin.";
    }
    return formatAdminOperationsClientError(err);
  }
  if (err instanceof AdminOperationsActionValidationError) return err.message;
  return "Beklenmeyen bir hata oluştu.";
}

function handleAdminAuthError(err: unknown): boolean {
  if (!(err instanceof AdminOperationsClientError)) {
    return false;
  }

  if (err.status !== 401 && err.message !== "Authentication required") {
    return false;
  }

  if (typeof window === "undefined") {
    return true;
  }

  const redirect = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/auth/login?redirect=${encodeURIComponent(redirect)}`);
  return true;
}
