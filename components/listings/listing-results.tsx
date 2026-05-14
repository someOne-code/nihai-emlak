"use client";

import { ArrowDownUp, Grid2X2, List } from "lucide-react";
import { useMemo, useState } from "react";

import { ListingCard } from "./listing-card";
import { ListingEmptyState } from "./listing-empty-state";
import type { ListingCardData } from "./listing-card";

export type ListingSort = "default" | "price_asc" | "price_desc" | "title_asc";
type ListingViewMode = "grid" | "list";

export function ListingResults({
  listings,
  initialSort,
}: {
  listings: ListingCardData[];
  initialSort: ListingSort;
}) {
  const [sort, setSort] = useState<ListingSort>(initialSort);
  const [viewMode, setViewMode] = useState<ListingViewMode>("grid");

  const sortedListings = useMemo(() => sortListings(listings, sort), [listings, sort]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-lg bg-white px-4 py-5 shadow-property dark:bg-[#0e1624] sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold text-[#102D47] dark:text-white">
          {listings.length} ilan bulundu
        </h2>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-sm font-semibold text-[#668199]">
            <ArrowDownUp className="h-4 w-4" aria-hidden="true" />
            Sıralama
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as ListingSort)}
              className="rounded-lg border border-[#6bc5f94d] bg-white p-3 text-[#102D47] outline-none focus:border-[#2F73F2] dark:border-[#224767] dark:bg-[#0e1624] dark:text-white"
            >
              <option value="default">Varsayılan</option>
              <option value="price_asc">Fiyat artan</option>
              <option value="price_desc">Fiyat azalan</option>
              <option value="title_asc">Başlık A-Z</option>
            </select>
          </label>

          <div className="flex gap-2" aria-label="Görünüm seçimi">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={viewButtonClass(viewMode === "grid")}
              aria-label="Grid görünümü"
              aria-pressed={viewMode === "grid"}
            >
              <Grid2X2 className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={viewButtonClass(viewMode === "list")}
              aria-label="Liste görünümü"
              aria-pressed={viewMode === "list"}
            >
              <List className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {sortedListings.length > 0 ? (
        <div className={viewMode === "grid" ? "grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3" : "flex flex-col gap-6"}>
          {sortedListings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} viewMode={viewMode} />
          ))}
        </div>
      ) : (
        <ListingEmptyState />
      )}
    </div>
  );
}

function sortListings(listings: ListingCardData[], sort: ListingSort): ListingCardData[] {
  const nextListings = [...listings];

  if (sort === "price_asc") {
    return nextListings.sort((a, b) => normalizePrice(a.price) - normalizePrice(b.price));
  }

  if (sort === "price_desc") {
    return nextListings.sort((a, b) => normalizePrice(b.price) - normalizePrice(a.price));
  }

  if (sort === "title_asc") {
    return nextListings.sort((a, b) => a.title.localeCompare(b.title, "tr"));
  }

  return nextListings;
}

function normalizePrice(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function viewButtonClass(isActive: boolean): string {
  return [
    "inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#2F73F2] transition-colors",
    isActive
      ? "bg-[#2F73F2] text-white"
      : "bg-transparent text-[#2F73F2] hover:bg-[#2F73F2] hover:text-white",
  ].join(" ");
}
