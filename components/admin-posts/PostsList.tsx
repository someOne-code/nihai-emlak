import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { adminLayout } from "@/components/admin-content-shared";

type PostsListProps = {
  toolbar?: ReactNode;
  rowsCount: number;
  loading: boolean;
  emptyText?: string;
  emptyTitle?: string;
  loadingText?: string;
  onCreateClick?: () => void;
  children: ReactNode;
};

export default function PostsList({
  toolbar,
  rowsCount,
  loading,
  emptyTitle = "Henüz yazı yok",
  emptyText = "Henüz blog yazısı yok.",
  loadingText = "Güncelleniyor...",
  onCreateClick,
  children,
}: PostsListProps) {
  return (
    <aside
      className={adminLayout.sidebarPanel}
      aria-label="Blog yazısı listesi"
    >
      {toolbar ? (
        <div className={adminLayout.sidebarToolbar}>{toolbar}</div>
      ) : null}

      {rowsCount === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
          <div
            className="flex size-11 items-center justify-center rounded-xl border bg-muted text-xl"
            aria-hidden="true"
          >
            📝
          </div>
          <h3 className="text-sm font-semibold">{emptyTitle}</h3>
          <p className="max-w-[260px] text-xs text-muted-foreground">
            {emptyText}
          </p>
          {onCreateClick && (
            <Button size="sm" onClick={onCreateClick}>
              Yeni yazı
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
