"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  INITIAL_FILTER_STATE,
  type OperationsFilterState,
} from "@/lib/admin-ui/operations-filters";

export { INITIAL_FILTER_STATE, type OperationsFilterState };
export { applyFilters, toBackendFilters } from "@/lib/admin-ui/operations-filters";

const RESERVATION_STATUS_OPTIONS = [
  { value: "all", label: "Tüm durumlar" },
  { value: "pending", label: "Beklemede" },
  { value: "confirmed", label: "Onaylandı" },
  { value: "cancelled", label: "İptal edildi" },
  { value: "expired", label: "Süresi doldu" },
];

const QUEUE_OPTIONS = [
  { value: "all", label: "Tümü" },
  { value: "document_waiting", label: "Belge Bekleyenler" },
  { value: "refund_requests", label: "İptal / İade Talepleri" },
  { value: "manual_refunds", label: "Manuel İade Bekleyenler" },
  { value: "payment_issues", label: "Ödeme Sorunları" },
  { value: "completed", label: "Tamamlananlar" },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: "all", label: "Tüm ödemeler" },
  { value: "pending", label: "Beklemede" },
  { value: "succeeded", label: "Başarılı" },
  { value: "failed", label: "Başarısız" },
  { value: "cancelled", label: "İptal edildi" },
  { value: "refunded", label: "İade edildi" },
  { value: "conflict", label: "Uyuşmazlık" },
];

export function OperationsFilters({
  filters,
  onChange,
}: {
  filters: OperationsFilterState;
  onChange: (next: OperationsFilterState) => void;
}) {
  const hasActiveFilters =
    filters.search !== "" ||
    filters.queue !== "all" ||
    filters.reservationStatus !== "all" ||
    filters.paymentStatus !== "all";

  return (
    <div className="grid gap-3 rounded-xl border bg-card p-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {QUEUE_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            type="button"
            variant={filters.queue === opt.value ? "default" : "outline"}
            size="sm"
            className="shrink-0"
            onClick={() => onChange({ ...filters, queue: opt.value as OperationsFilterState["queue"] })}
          >
            {opt.label}
          </Button>
        ))}
      </div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
      <div className="min-w-0 flex-1">
        <Input
          placeholder="İlan, müşteri, telefon, e-posta veya rezervasyon no ara..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="h-9"
        />
      </div>
      <Select
        value={filters.reservationStatus}
        onChange={(e) => onChange({ ...filters, reservationStatus: e.target.value })}
        className="h-9 w-full lg:w-[180px]"
      >
        {RESERVATION_STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>
      <Select
        value={filters.paymentStatus}
        onChange={(e) => onChange({ ...filters, paymentStatus: e.target.value })}
        className="h-9 w-full lg:w-[180px]"
      >
        {PAYMENT_STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9"
          onClick={() => onChange(INITIAL_FILTER_STATE)}
        >
          Temizle
        </Button>
      )}
      </div>
    </div>
  );
}
