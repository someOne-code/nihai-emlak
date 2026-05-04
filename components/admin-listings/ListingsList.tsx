"use client";

import type { ReactNode } from "react";

// Phase 8.6 Task 4: presentational list wrapper for /admin/listings.
//
// Renders the toolbar slot, the list of listing rows passed from the
// parent, the empty state, and the secondary loading hint. The parent
// remains responsible for filter state, list fetching, and per-row
// component construction.

type ListingsListProps = {
  toolbar?: ReactNode;
  rowsCount: number;
  loading: boolean;
  emptyText?: string;
  loadingText?: string;
  children: ReactNode;
};

export default function ListingsList({
  toolbar,
  rowsCount,
  loading,
  emptyText = "İlan bulunamadı.",
  loadingText = "Güncelleniyor...",
  children,
}: ListingsListProps) {
  return (
    <aside
      className="flex flex-col gap-3 rounded-xl border bg-card p-4 sticky top-4"
      aria-label="İlan listesi"
    >
      {toolbar ? <div className="flex flex-col gap-2">{toolbar}</div> : null}

      {rowsCount === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center">{emptyText}</div>
      ) : (
        <div className="flex flex-col gap-2 max-h-[calc(100vh-12rem)] overflow-y-auto pr-1">
          {children}
        </div>
      )}

      {loading && (
        <p className="text-xs text-muted-foreground text-center animate-pulse">{loadingText}</p>
      )}
    </aside>
  );
}
