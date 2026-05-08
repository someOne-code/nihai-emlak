"use client";

import { Inbox, RotateCcw, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

type EmptyStateProps = {
  isEmpty: boolean;
  onClearFilters: () => void;
  onShowPending: () => void;
};

export function EmptyState({ isEmpty, onClearFilters, onShowPending }: EmptyStateProps) {
  if (isEmpty) {
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 ring-4 ring-blue-50 dark:bg-blue-950/40 dark:ring-blue-950/20">
          <Inbox className="h-7 w-7 text-blue-600 dark:text-blue-400" aria-hidden />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Kuyruk boş</p>
          <p className="text-xs text-muted-foreground">
            Şu anda takip edilecek rezervasyon bulunmuyor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 px-4 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 ring-4 ring-amber-50 dark:bg-amber-950/40 dark:ring-amber-950/20">
        <SearchX className="h-7 w-7 text-amber-600 dark:text-amber-400" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Sonuç bulunamadı</p>
        <p className="text-xs text-muted-foreground">
          Seçili filtrelerle eşleşen rezervasyon yok.
        </p>
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        <Button variant="outline" size="sm" onClick={onClearFilters}>
          <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
          Filtreleri temizle
        </Button>
        <Button variant="ghost" size="sm" onClick={onShowPending}>
          Bekleyenleri göster
        </Button>
      </div>
    </div>
  );
}