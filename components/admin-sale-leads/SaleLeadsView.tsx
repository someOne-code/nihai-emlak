"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createContentRefreshGate,
  refreshContentViews,
  shouldRefreshContentOnResume,
} from "@/lib/admin-ui/content-refresh";
import {
  createInitialLoadGuard,
  shouldStartInitialLoad,
} from "@/lib/admin-ui/initial-load-guard";
import {
  loadSaleLeadsModel,
  updateSaleLeadStatusFromController,
} from "@/lib/admin-ui/sale-leads-controller";
import type {
  SaleLeadStatus,
  SaleLeadsOverviewRow,
} from "@/lib/admin-ui/sale-leads-view-model";

import {
  SALE_LEADS_INITIAL_FILTER_STATE,
  SaleLeadsFilters,
  applySaleLeadFilters,
  buildSaleLeadsBackendFilters,
  hasSaleLeadsBackendFilterChange,
  type SaleLeadsFilterState,
} from "./SaleLeadsFilters";
import { SaleLeadStatusBadge } from "./SaleLeadStatusBadge";

export default function SaleLeadsView() {
  const [rows, setRows] = useState<SaleLeadsOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SaleLeadsFilterState>(
    SALE_LEADS_INITIAL_FILTER_STATE,
  );
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const initialLoadGuardRef = useRef(createInitialLoadGuard());
  const resumeRefreshGateRef = useRef(createContentRefreshGate());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadData = useCallback(async (nextFilters: SaleLeadsFilterState = filters) => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadSaleLeadsModel({
        filters: buildSaleLeadsBackendFilters(nextFilters),
      });
      if (!mountedRef.current) return;
      if (!result.ok) {
        setError(result.error);
        setRows([]);
      } else {
        setRows(result.viewModel.rows);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [filters]);

  const handleFiltersChange = useCallback(
    (nextFilters: SaleLeadsFilterState) => {
      const shouldReload = hasSaleLeadsBackendFilterChange(filters, nextFilters);
      setFilters(nextFilters);
      if (shouldReload) {
        void loadData(nextFilters);
      }
    },
    [filters, loadData],
  );

  useEffect(() => {
    if (!shouldStartInitialLoad(initialLoadGuardRef.current)) {
      return;
    }

    void loadData();
  }, [loadData]);

  useEffect(() => {
    const refreshOnResume = () => {
      if (document.visibilityState === "hidden") {
        return;
      }
      if (!shouldRefreshContentOnResume(resumeRefreshGateRef.current)) {
        return;
      }

      void refreshContentViews([() => loadData()]);
    };

    window.addEventListener("focus", refreshOnResume);
    document.addEventListener("visibilitychange", refreshOnResume);
    return () => {
      window.removeEventListener("focus", refreshOnResume);
      document.removeEventListener("visibilitychange", refreshOnResume);
    };
  }, [loadData]);

  const handleStatusUpdate = useCallback(
    async (leadId: string, status: SaleLeadStatus) => {
      setUpdatingId(leadId);
      setUpdateError(null);

      const result = await updateSaleLeadStatusFromController(leadId, status, null);
      if (!mountedRef.current) return;

      setUpdatingId(null);

      if (!result.ok) {
        setUpdateError(result.error);
        return;
      }

      await loadData();
    },
    [loadData],
  );

  const filteredRows = useMemo(
    () => applySaleLeadFilters(rows, filters),
    [rows, filters],
  );

  if (loading && rows.length === 0) {
    return (
      <div className="mx-auto flex max-w-screen-xl flex-col gap-6 p-4 md:p-6">
        <Header />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (error && rows.length === 0) {
    return (
      <div className="mx-auto flex max-w-screen-xl flex-col gap-4 p-4 md:p-6">
        <Header />
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
    <div className="mx-auto flex max-w-screen-xl flex-col gap-6 p-4 md:p-6">
      <Header />
      <SaleLeadsFilters filters={filters} onChange={handleFiltersChange} />

      {updateError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {updateError}
        </div>
      )}

      <div className="grid gap-3 md:hidden">
        {filteredRows.map((row) => (
          <MobileSaleLeadCard
            key={row.leadId}
            row={row}
            updatingId={updatingId}
            onStatusUpdate={handleStatusUpdate}
          />
        ))}
        {filteredRows.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">
            Satış leadi bulunamadı.
          </p>
        )}
      </div>

      <Card className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>İlan</TableHead>
              <TableHead>Müşteri</TableHead>
              <TableHead>Mesaj</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>Güncelleme</TableHead>
              <TableHead className="text-right">İşlem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map((row) => (
              <TableRow key={row.leadId}>
                <TableCell>
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="font-medium">{row.listingTitle}</span>
                    <span className="text-xs text-muted-foreground">
                      {row.locationLabel}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex min-w-0 flex-col gap-1">
                    <span>{row.contactName ?? "-"}</span>
                    <span className="text-xs text-muted-foreground">
                      {row.contactPhone ?? row.contactEmail ?? "-"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="max-w-xs truncate">
                  {row.messagePreview}
                </TableCell>
                <TableCell>
                  <SaleLeadStatusBadge status={row.status} />
                </TableCell>
                <TableCell>{formatDate(row.updatedAt)}</TableCell>
                <TableCell className="text-right">
                  <StatusActions
                    row={row}
                    updatingId={updatingId}
                    onStatusUpdate={handleStatusUpdate}
                  />
                </TableCell>
              </TableRow>
            ))}
            {filteredRows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-muted-foreground"
                >
                  Satış leadi bulunamadı.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Satış Leadleri</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Satılık ilan taleplerini takip et ve durumlarını güncelle.
      </p>
    </div>
  );
}

function MobileSaleLeadCard({
  row,
  updatingId,
  onStatusUpdate,
}: {
  row: SaleLeadsOverviewRow;
  updatingId: string | null;
  onStatusUpdate: (leadId: string, status: SaleLeadStatus) => void;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 text-card-foreground">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold">{row.listingTitle}</h2>
          <p className="text-xs text-muted-foreground">
            {row.locationLabel ?? "Konum yok"}
          </p>
        </div>
        <SaleLeadStatusBadge status={row.status} />
      </div>
      <div className="mt-3 flex flex-col gap-1 text-sm">
        <span>{row.contactName ?? "-"}</span>
        <span className="text-muted-foreground">
          {row.contactPhone ?? row.contactEmail ?? "-"}
        </span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{row.messagePreview}</p>
      <div className="mt-3">
        <StatusActions
          row={row}
          updatingId={updatingId}
          onStatusUpdate={onStatusUpdate}
        />
      </div>
    </div>
  );
}

function StatusActions({
  row,
  updatingId,
  onStatusUpdate,
}: {
  row: SaleLeadsOverviewRow;
  updatingId: string | null;
  onStatusUpdate: (leadId: string, status: SaleLeadStatus) => void;
}) {
  const disabled = updatingId === row.leadId;

  if (row.status === "closed" || row.status === "not_interested") {
    return <span className="text-sm text-muted-foreground">Tamamlandı</span>;
  }

  if (row.status === "new") {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={() => onStatusUpdate(row.leadId, "called")}
      >
        Arandı olarak işaretle
      </Button>
    );
  }

  return (
    <div className="flex justify-end gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={() => onStatusUpdate(row.leadId, "meeting_planned")}
      >
        Görüşme
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={() => onStatusUpdate(row.leadId, "closed")}
      >
        Kapat
      </Button>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
