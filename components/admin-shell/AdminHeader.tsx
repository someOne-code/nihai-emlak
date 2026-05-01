"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { resolveAdminHeaderTitle } from "./admin-shell-nav";

type AdminHeaderProps = {
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
};

export default function AdminHeader({
  onToggleSidebar,
  isSidebarOpen,
}: AdminHeaderProps) {
  const pathname = usePathname() ?? "";
  const title = resolveAdminHeaderTitle(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background px-4 lg:px-6">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label="Menüyü aç"
        aria-controls="admin-sidebar"
        aria-expanded={isSidebarOpen}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground lg:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>
      <h1 className="text-base font-semibold tracking-tight lg:text-lg">
        {title}
      </h1>
    </header>
  );
}
