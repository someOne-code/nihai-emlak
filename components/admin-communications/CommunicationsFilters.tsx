"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

import {
  COMMUNICATIONS_INITIAL_FILTER_STATE,
  type CommunicationsFilterState,
  type CommunicationsStatusFilter,
} from "@/lib/admin-ui/communications-filters";

// Re-export pure logic so the rest of the UI can import from a single place.
export {
  applyCommunicationsFilters,
  COMMUNICATIONS_INITIAL_FILTER_STATE,
  type CommunicationsFilterState,
  type CommunicationsStatusFilter,
} from "@/lib/admin-ui/communications-filters";

const STATUS_OPTIONS: ReadonlyArray<{ value: CommunicationsStatusFilter; label: string }> = [
  { value: "issues", label: "Sorunlular" },
  { value: "all", label: "Tümü" },
  { value: "ready", label: "Hazır" },
  { value: "provisioning", label: "Oluşturuluyor" },
  { value: "failed", label: "Başarısız" },
];

export function CommunicationsFilters({
  filters,
  onChange,
}: {
  filters: CommunicationsFilterState;
  onChange: (next: CommunicationsFilterState) => void;
}) {
  const hasActiveFilters =
    filters.search !== "" ||
    filters.status !== COMMUNICATIONS_INITIAL_FILTER_STATE.status;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Input
          placeholder="İlan, kullanıcı veya ID ara..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="h-9"
        />
      </div>
      <Select
        value={filters.status}
        onChange={(e) =>
          onChange({
            ...filters,
            status: e.target.value as CommunicationsStatusFilter,
          })
        }
        className="h-9 w-full sm:w-[180px]"
      >
        {STATUS_OPTIONS.map((opt) => (
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
          onClick={() => onChange(COMMUNICATIONS_INITIAL_FILTER_STATE)}
        >
          Temizle
        </Button>
      )}
    </div>
  );
}
