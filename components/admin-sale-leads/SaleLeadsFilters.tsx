"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

import {
  SALE_LEADS_INITIAL_FILTER_STATE,
  type SaleLeadStatusFilter,
  type SaleLeadsFilterState,
} from "@/lib/admin-ui/sale-leads-filters";

export {
  SALE_LEADS_INITIAL_FILTER_STATE,
  applySaleLeadFilters,
  buildSaleLeadsBackendFilters,
  hasSaleLeadsBackendFilterChange,
  type SaleLeadStatusFilter,
  type SaleLeadsFilterState,
} from "@/lib/admin-ui/sale-leads-filters";

const STATUS_OPTIONS: ReadonlyArray<{ value: SaleLeadStatusFilter; label: string }> = [
  { value: "actionable", label: "Takip Edilecekler" },
  { value: "all", label: "Tümü" },
  { value: "new", label: "Yeni" },
  { value: "called", label: "Arandı" },
  { value: "meeting_planned", label: "Görüşme Planlandı" },
  { value: "not_interested", label: "İlgilenmiyor" },
  { value: "closed", label: "Kapandı" },
];

export function SaleLeadsFilters({
  filters,
  onChange,
}: {
  filters: SaleLeadsFilterState;
  onChange: (next: SaleLeadsFilterState) => void;
}) {
  const hasActiveFilters =
    filters.search !== "" ||
    filters.status !== SALE_LEADS_INITIAL_FILTER_STATE.status;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Input
          placeholder="İlan, müşteri, telefon veya ID ara..."
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          className="h-9"
        />
      </div>
      <Select
        value={filters.status}
        onChange={(event) =>
          onChange({
            ...filters,
            status: event.target.value as SaleLeadStatusFilter,
          })
        }
        className="h-9 w-full sm:w-[210px]"
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9"
          onClick={() => onChange(SALE_LEADS_INITIAL_FILTER_STATE)}
        >
          Temizle
        </Button>
      )}
    </div>
  );
}
