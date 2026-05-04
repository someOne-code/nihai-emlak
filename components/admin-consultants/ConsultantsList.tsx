import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { adminLayout } from "@/components/admin-content-shared";

type ConsultantsListProps = {
  toolbar?: ReactNode;
  rowsCount: number;
  loading: boolean;
  emptyText?: string;
  emptyTitle?: string;
  loadingText?: string;
  onCreateClick?: () => void;
  children: ReactNode;
};

export default function ConsultantsList({
  toolbar,
  rowsCount,
  loading,
  emptyTitle = "Henüz danışman yok",
  emptyText = "Henüz danışman yok.",
  loadingText = "Güncelleniyor...",
  onCreateClick,
  children,
}: ConsultantsListProps) {
  return (
    <aside className={adminLayout.sidebarPanel} aria-label="Danışman listesi">
      {toolbar ? (
        <div className={adminLayout.sidebarToolbar}>{toolbar}</div>
      ) : null}

      {rowsCount === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
          <div
            className="flex size-11 items-center justify-center rounded-xl border bg-muted text-xl"
            aria-hidden="true"
          >
            👤
          </div>
          <h3 className="text-sm font-semibold">{emptyTitle}</h3>
          <p className="max-w-[260px] text-xs text-muted-foreground">
            {emptyText}
          </p>
          {onCreateClick && (
            <Button size="sm" onClick={onCreateClick}>
              Yeni danışman
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">{children}</div>
      )}

      {loading && <p className={adminLayout.loadingText}>{loadingText}</p>}
    </aside>
  );
}
