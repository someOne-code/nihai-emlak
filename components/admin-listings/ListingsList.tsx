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
    <aside className="lstSidebar" aria-label="İlan listesi">
      {toolbar ? <div className="lstToolbar">{toolbar}</div> : null}

      {rowsCount === 0 ? (
        <div className="lstEmpty">{emptyText}</div>
      ) : (
        <div className="flex flex-col gap-2">{children}</div>
      )}

      {loading && <p className="opsLoadingText">{loadingText}</p>}
    </aside>
  );
}
