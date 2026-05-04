"use client";

// Phase 8.6 Task 4: presentational page header for /admin/listings.
//
// Owns no data and never calls Supabase or admin client helpers.
// AdminListingsView remains responsible for data fetching and
// orchestration; this component only renders the page intro and the
// "Yeni ilan" entry point.

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

type ListingsPageHeaderProps = {
  disabled: boolean;
  onCreateClick: () => void;
};

export default function ListingsPageHeader({
  disabled,
  onCreateClick,
}: ListingsPageHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div className="flex flex-col gap-1 max-w-2xl">
        <h1 className="text-2xl font-bold text-balance">İlan Yönetimi</h1>
        <p className="text-sm text-muted-foreground text-pretty">
          İlanları görüntüleyin, düzenleyin ve yeni ilan ekleyin.
        </p>
      </div>
      <Button disabled={disabled} onClick={onCreateClick}>
        <Plus className="h-4 w-4" />
        Yeni İlan
      </Button>
    </header>
  );
}
