"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import type { ListingType } from "@/types/listing";
import type { PublicListingFilters } from "@/types/listing-filters";

type ListingFiltersProps = {
  filters: PublicListingFilters;
  values: ListingFilterValues;
  onApplied?: () => void;
};

export type ListingFilterValues = {
  city: string;
  district: string;
  isFurnished: "" | "true" | "false";
  maxArea: string;
  maxPrice: string;
  minArea: string;
  minBathrooms: string;
  minPrice: string;
  minRooms: string;
  type: ListingType | null;
};

const EMPTY_FILTER_METADATA: PublicListingFilters = {
  areaRange: { min: null, max: null },
  cities: [],
  districts: [],
  priceRange: { min: null, max: null },
};

const EMPTY_FILTER_VALUES: ListingFilterValues = {
  city: "",
  district: "",
  isFurnished: "",
  maxArea: "",
  maxPrice: "",
  minArea: "",
  minBathrooms: "",
  minPrice: "",
  minRooms: "",
  type: null,
};

export function ListingFilters({
  filters,
  values,
  onApplied,
  ...legacyValues
}: ListingFiltersProps & Partial<ListingFilterValues>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const safeFilters = filters ?? EMPTY_FILTER_METADATA;
  const safeValues = normalizeFilterValues(values, legacyValues);

  const [selectedType, setSelectedType] = useState<ListingType | "">(safeValues.type ?? "");
  const [selectedCity, setSelectedCity] = useState(safeValues.city);
  const [selectedDistrict, setSelectedDistrict] = useState(safeValues.district);
  const [minPrice, setMinPrice] = useState(safeValues.minPrice);
  const [maxPrice, setMaxPrice] = useState(safeValues.maxPrice);
  const [minRooms, setMinRooms] = useState(safeValues.minRooms);
  const [minBathrooms, setMinBathrooms] = useState(safeValues.minBathrooms);
  const [minArea, setMinArea] = useState(safeValues.minArea);
  const [maxArea, setMaxArea] = useState(safeValues.maxArea);
  const [furnished, setFurnished] = useState<"" | "true" | "false">(safeValues.isFurnished);

  const cityOptions = safeFilters.cities;
  const districtOptions = useMemo(
    () => safeFilters.districts.filter((district) => district.city === selectedCity),
    [safeFilters.districts, selectedCity],
  );

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const search = new URLSearchParams(searchParams.toString());
    const type = selectedType;
    const city = selectedCity;
    const district = selectedDistrict;

    search.delete("offset");
    setOptionalParam(search, "type", type);
    setOptionalParam(search, "city", city);
    setOptionalParam(search, "district", district);
    setOptionalParam(search, "min_price", minPrice);
    setOptionalParam(search, "max_price", maxPrice);
    setOptionalParam(search, "min_rooms", minRooms);
    setOptionalParam(search, "min_bathrooms", minBathrooms);
    setOptionalParam(search, "min_area", minArea);
    setOptionalParam(search, "max_area", maxArea);

    if (furnished) {
      search.set("is_furnished", furnished);
    } else {
      search.delete("is_furnished");
    }

    const query = search.toString();
    router.push(query ? `/listings?${query}` : "/listings");
    onApplied?.();
  }

  function clearFilters() {
    setSelectedType("");
    setSelectedCity("");
    setSelectedDistrict("");
    setMinPrice("");
    setMaxPrice("");
    setMinRooms("");
    setMinBathrooms("");
    setMinArea("");
    setMaxArea("");
    setFurnished("");
    router.push("/listings");
    onApplied?.();
  }

  return (
    <form onSubmit={applyFilters} className="rounded-lg bg-white px-6 py-8 shadow-property dark:bg-[#0e1624] sm:px-8 lg:py-12">
      <p className="mb-6 text-2xl font-semibold text-[#102D47] dark:text-white">Gelişmiş Filtre</p>
      <div className="flex flex-col gap-5">
        <label className="flex flex-col gap-2 text-sm font-semibold text-[#102D47] dark:text-white">
          İlan Tipi
          <select
            name="type"
            value={selectedType}
            onChange={(event) => setSelectedType(event.target.value as ListingType | "")}
            className={inputClassName}
            aria-label="İlan tipi"
          >
            <option value="">Tümü</option>
            <option value="rent">Kiralık</option>
            <option value="sale">Satılık</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm font-semibold text-[#102D47] dark:text-white">
          Şehir
          <select
            name="city"
            value={selectedCity}
            onChange={(event) => {
              setSelectedCity(event.target.value);
              setSelectedDistrict("");
            }}
            className={inputClassName}
          >
            <option value="">Tüm Şehirler</option>
            {cityOptions.map((city) => (
              <option key={city.value} value={city.value}>
                {city.label} ({city.count})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm font-semibold text-[#102D47] dark:text-white">
          İlçe
          <select
            name="district"
            value={selectedDistrict}
            disabled={!selectedCity}
            onChange={(event) => setSelectedDistrict(event.target.value)}
            className={inputClassName}
          >
            <option value="">Tüm İlçeler</option>
            {districtOptions.map((district) => (
              <option key={`${district.city}-${district.value}`} value={district.value}>
                {district.label} ({district.count})
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-semibold text-[#102D47] dark:text-white">
            Minimum Fiyat
            <input
              name="min_price"
              inputMode="numeric"
              type="number"
              min={0}
              value={minPrice}
              onChange={(event) => setMinPrice(event.target.value)}
              placeholder={formatPlaceholder(safeFilters.priceRange.min)}
              className={inputClassName}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold text-[#102D47] dark:text-white">
            Maksimum Fiyat
            <input
              name="max_price"
              inputMode="numeric"
              type="number"
              min={0}
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
              placeholder={formatPlaceholder(safeFilters.priceRange.max)}
              className={inputClassName}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-semibold text-[#102D47] dark:text-white">
            Oda Sayısı
            <select name="min_rooms" value={minRooms} onChange={(event) => setMinRooms(event.target.value)} className={inputClassName}>
              <option value="">Fark etmez</option>
              {[1, 2, 3, 4, 5].map((room) => (
                <option key={room} value={room}>{room}+</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold text-[#102D47] dark:text-white">
            Banyo Sayısı
            <select name="min_bathrooms" value={minBathrooms} onChange={(event) => setMinBathrooms(event.target.value)} className={inputClassName}>
              <option value="">Fark etmez</option>
              {[1, 2, 3, 4].map((bathroom) => (
                <option key={bathroom} value={bathroom}>{bathroom}+</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-semibold text-[#102D47] dark:text-white">
            Minimum m²
            <input
              name="min_area"
              inputMode="numeric"
              type="number"
              min={0}
              value={minArea}
              onChange={(event) => setMinArea(event.target.value)}
              placeholder={formatPlaceholder(safeFilters.areaRange.min)}
              className={inputClassName}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold text-[#102D47] dark:text-white">
            Maksimum m²
            <input
              name="max_area"
              inputMode="numeric"
              type="number"
              min={0}
              value={maxArea}
              onChange={(event) => setMaxArea(event.target.value)}
              placeholder={formatPlaceholder(safeFilters.areaRange.max)}
              className={inputClassName}
            />
          </label>
        </div>

        <label className="flex flex-col gap-2 text-sm font-semibold text-[#102D47] dark:text-white">
          Eşyalı / Eşyasız
          <select
            name="is_furnished"
            value={furnished}
            onChange={(event) => setFurnished(event.target.value as "" | "true" | "false")}
            className={inputClassName}
          >
            <option value="">Fark etmez</option>
            <option value="true">Eşyalı</option>
            <option value="false">Eşyasız</option>
          </select>
        </label>

        <Button type="submit" className="w-full rounded-lg bg-[#2F73F2] py-3 text-base text-white hover:bg-blue-700">
          İlanları Bul
        </Button>
        <button type="button" onClick={clearFilters} className="text-sm font-semibold text-[#2F73F2] hover:underline">
          Filtreleri Temizle
        </button>
      </div>
    </form>
  );
}

export function MobileFilterButton({ filters, values }: Omit<ListingFiltersProps, "onApplied">) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <Button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-[#2F73F2] px-5 py-3 text-white hover:bg-blue-700"
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        Filtrele
      </Button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filtre paneli">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/50"
            aria-label="Filtre panelini kapat"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-[min(88vw,390px)] overflow-y-auto bg-white p-4 shadow-2xl dark:bg-[#0c121e]">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="mb-4 ml-auto flex rounded-lg border border-[#6bc5f94d] p-2 text-[#102D47] dark:border-[#224767] dark:text-white"
              aria-label="Filtre panelini kapat"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <ListingFilters filters={filters} values={values} onApplied={() => setIsOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

const inputClassName = "w-full rounded-lg border border-[#6bc5f94d] bg-white px-3 py-3 text-[#102D47] outline-none focus:border-[#2F73F2] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-[#224767] dark:bg-[#0e1624] dark:text-white dark:disabled:bg-[#111827] dark:disabled:text-slate-500";

function setOptionalParam(search: URLSearchParams, key: string, value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (trimmed) {
    search.set(key, trimmed);
  } else {
    search.delete(key);
  }
}

function formatPlaceholder(value: number | null): string | undefined {
  return value === null ? undefined : String(value);
}

function normalizeFilterValues(
  values: Partial<ListingFilterValues> | undefined,
  fallbackValues: Partial<ListingFilterValues>,
): ListingFilterValues {
  const merged = { ...EMPTY_FILTER_VALUES, ...fallbackValues, ...values };

  return {
    ...merged,
    isFurnished: normalizeFurnished(merged.isFurnished),
    type: normalizeListingType(merged.type),
  };
}

function normalizeListingType(value: ListingFilterValues["type"] | undefined): ListingType | null {
  return value === "rent" || value === "sale" ? value : null;
}

function normalizeFurnished(value: ListingFilterValues["isFurnished"] | undefined): "" | "true" | "false" {
  return value === "true" || value === "false" ? value : "";
}
