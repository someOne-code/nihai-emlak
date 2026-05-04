"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

import { ADMIN_SIDEBAR_ITEMS, type AdminSidebarItem } from "./admin-shell-nav";

type AdminSidebarProps = {
  isMobileOpen: boolean;
  onNavigate?: () => void;
  onCloseMobile?: () => void;
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") {
    return pathname === "/admin";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function renderSidebarItem(
  item: AdminSidebarItem,
  pathname: string,
  onNavigate: (() => void) | undefined,
) {
  if (item.kind === "link") {
    const active = isActive(pathname, item.href);
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
            active
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          {item.label}
        </Link>
      </li>
    );
  }

  return (
    <li key={item.label}>
      <div className="mb-1 mt-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {item.label}
      </div>
      <ul className="flex flex-col gap-1">
        {item.children.map((child) => {
          const active = isActive(pathname, child.href);
          return (
            <li key={child.href}>
              <Link
                href={child.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center rounded-md px-3 py-2 pl-6 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {child.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </li>
  );
}

export default function AdminSidebar({
  isMobileOpen,
  onNavigate,
  onCloseMobile,
}: AdminSidebarProps) {
  const pathname = usePathname() ?? "";

  return (
    <aside
      id="admin-sidebar"
      aria-label="Admin navigation"
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-card text-card-foreground transition-transform duration-200 ease-in-out",
        "lg:translate-x-0 lg:static lg:inset-auto lg:h-screen lg:shrink-0",
        isMobileOpen ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        <Link
          href="/admin"
          className="text-sm font-semibold tracking-tight"
          onClick={onNavigate}
        >
          Nihai Emlak Admin
        </Link>
        <button
          type="button"
          aria-label="Menüyü kapat"
          onClick={onCloseMobile}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground lg:hidden"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-3" aria-label="Admin bölümleri">
        <ul className="flex flex-col gap-1">
          {ADMIN_SIDEBAR_ITEMS.map((item) =>
            renderSidebarItem(item, pathname, onNavigate),
          )}
        </ul>
      </nav>
    </aside>
  );
}
