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
  createInitialLoadGuard,
  shouldStartInitialLoad,
} from "@/lib/admin-ui/initial-load-guard";
import {
  createContentRefreshGate,
  refreshContentViews,
  shouldRefreshContentOnResume,
} from "@/lib/admin-ui/content-refresh";
import {
  loadCommunicationsModel,
  retryCommunicationsMapping,
} from "@/lib/admin-ui/communications-controller";
import type { CommunicationsOverviewRow } from "@/lib/admin-ui/communications-view-model";

import {
  applyCommunicationsFilters,
  buildCommunicationsBackendFilters,
  COMMUNICATIONS_INITIAL_FILTER_STATE,
  CommunicationsFilters,
  hasCommunicationsBackendFilterChange,
  type CommunicationsFilterState,
} from "./CommunicationsFilters";
import { ConversationStatusBadge } from "./ConversationStatusBadge";

export default function CommunicationsView() {
  const [rows, setRows] = useState<CommunicationsOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CommunicationsFilterState>(
    COMMUNICATIONS_INITIAL_FILTER_STATE,
  );
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const initialLoadGuardRef = useRef(createInitialLoadGuard());
  const resumeRefreshGateRef = useRef(createContentRefreshGate());
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadData = useCallback(async (nextFilters: CommunicationsFilterState = filters) => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadCommunicationsModel({
        filters: buildCommunicationsBackendFilters(nextFilters),
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
    (nextFilters: CommunicationsFilterState) => {
      const shouldReload = hasCommunicationsBackendFilterChange(filters, nextFilters);
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

  const handleRetry = useCallback(
    async (conversationId: string) => {
      setRetryingId(conversationId);
      setRetryError(null);

      const result = await retryCommunicationsMapping(conversationId);
      if (!mountedRef.current) return;

      setRetryingId(null);

      if (!result.ok) {
        setRetryError(result.error);
        return;
      }

      // Refresh list to reflect new provisioning state.
      await loadData();
    },
    [loadData],
  );

  const filteredRows = useMemo(
    () => applyCommunicationsFilters(rows, filters),
    [rows, filters],
  );

  if (loading && rows.length === 0) {
    return (
      <div className="mx-auto max-w-screen-xl space-y-6 p-4 md:p-6">
        <Header />
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (error && rows.length === 0) {
    return (
      <div className="mx-auto max-w-screen-xl space-y-4 p-4 md:p-6">
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
    <div className="mx-auto max-w-screen-xl space-y-6 p-4 md:p-6">
      <Header />

      <CommunicationsFilters filters={filters} onChange={handleFiltersChange} />

      {retryError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {retryError}
        </div>
      )}

      {/* Mobile cards */}
      <div className="grid gap-3 md:hidden">
        {filteredRows.map((row) => (
          <MobileConversationCard
            key={row.conversationId}
            row={row}
            onRetry={handleRetry}
            isRetrying={retryingId === row.conversationId}
          />
        ))}
        {filteredRows.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">
            Konuşma bulunamadı.
          </p>
        )}
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>İlan</TableHead>
              <TableHead>Konum</TableHead>
              <TableHead>Kullanıcı</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>Hata</TableHead>
              <TableHead>Güncelleme</TableHead>
              <TableHead className="text-right">İşlem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map((row) => (
              <TableRow key={row.conversationId}>
                <TableCell className="font-medium">{row.listingTitle}</TableCell>
                <TableCell>{row.locationLabel ?? "-"}</TableCell>
                <TableCell>{row.userName ?? row.userEmail ?? "-"}</TableCell>
                <TableCell>
                  <ConversationStatusBadge status={row.status} />
                </TableCell>
                <TableCell className="max-w-xs truncate">
                  {row.failureReason ?? "-"}
                </TableCell>
                <TableCell>{formatDate(row.updatedAt)}</TableCell>
                <TableCell className="text-right">
                  {row.chatwootOpenHref && (
                    <Button size="sm" variant="outline" asChild>
                      <a
                        href={row.chatwootOpenHref}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {"Chatwoot'ta aç"}
                      </a>
                    </Button>
                  )}
                  {row.status === "failed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={retryingId === row.conversationId}
                      onClick={() => handleRetry(row.conversationId)}
                    >
                      {retryingId === row.conversationId
                        ? "Deneniyor..."
                        : "Tekrar dene"}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filteredRows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-muted-foreground"
                >
                  Konuşma bulunamadı.
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
      <h1 className="text-2xl font-bold tracking-tight">İletişim Yönetimi</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Chatwoot konuşmalarını ve kurulum durumlarını yönet.
      </p>
    </div>
  );
}

function MobileConversationCard({
  row,
  onRetry,
  isRetrying,
}: {
  row: CommunicationsOverviewRow;
  onRetry: (id: string) => void;
  isRetrying: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold">{row.listingTitle}</h2>
          <p className="text-xs text-muted-foreground">
            {row.locationLabel ?? "Konum yok"}
          </p>
        </div>
        <ConversationStatusBadge status={row.status} />
      </div>
      <div className="mt-3 text-sm">
        <span className="text-muted-foreground">Kullanıcı:</span>{" "}
        {row.userName ?? row.userEmail ?? "-"}
      </div>
      {row.failureReason && (
        <div className="mt-2 text-xs text-destructive">{row.failureReason}</div>
      )}
      {row.status === "failed" && (
        <div className="mt-3">
          <Button
            size="sm"
            variant="outline"
            disabled={isRetrying}
            onClick={() => onRetry(row.conversationId)}
          >
            {isRetrying ? "Deneniyor..." : "Tekrar dene"}
          </Button>
        </div>
      )}
      {row.chatwootOpenHref && (
        <div className="mt-3">
          <Button size="sm" variant="outline" asChild>
            <a href={row.chatwootOpenHref} target="_blank" rel="noopener noreferrer">
              {"Chatwoot'ta aç"}
            </a>
          </Button>
        </div>
      )}
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
