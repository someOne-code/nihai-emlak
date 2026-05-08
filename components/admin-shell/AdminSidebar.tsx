"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  FolderTree,
  Home,
  Inbox,
  Landmark,
  LayoutDashboard,
  ListChecks,
  MessageSquareText,
  Newspaper,
  ShieldCheck,
  Tags,
  UserRound,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import {
  ADMIN_SIDEBAR_ITEMS,
  type AdminSidebarIcon,
  type AdminSidebarItem,
  type AdminSidebarSectionLink,
} from "./admin-shell-nav";

type AdminSidebarProps = {
  isMobileOpen: boolean;
  onNavigate?: () => void;
  onCloseMobile?: () => void;
};

const SIDEBAR_ICON_MAP: Record<AdminSidebarIcon, LucideIcon> = {
  "bar-chart": BarChart3,
  building: Building2,
  catalog: Landmark,
  dashboard: LayoutDashboard,
  inbox: Inbox,
  newspaper: Newspaper,
  operations: ListChecks,
  "sale-leads": MessageSquareText,
  "section-content": FolderTree,
  "section-general": Home,
  "section-management": UsersRound,
  shield: ShieldCheck,
  tags: Tags,
  user: UserRound,
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") {
    return pathname === "/admin";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function iconFor(name: AdminSidebarIcon): LucideIcon {
  return SIDEBAR_ICON_MAP[name];
}

function renderSidebarLink(
  link: AdminSidebarSectionLink,
  pathname: string,
  onNavigate: (() => void) | undefined,
) {
  const active = isActive(pathname, link.href);
  const Icon = iconFor(link.icon);

  return (
    <li key={link.href}>
      <Link
        href={link.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative flex min-h-10 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-accent text-accent-foreground shadow-sm"
            : "text-muted-foreground hover:bg-accent/70 hover:text-accent-foreground",
        )}
      >
        {active && (
          <span
            aria-label="Aktif sayfa"
            className="absolute -left-3 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-primary"
          />
        )}
        <Icon aria-hidden="true" className="size-4 shrink-0" />
        <span className="truncate">{link.label}</span>
      </Link>
    </li>
  );
}

function renderSidebarSection(
  item: AdminSidebarItem,
  pathname: string,
  onNavigate: (() => void) | undefined,
) {
  const SectionIcon = iconFor(item.icon);

  return (
    <li key={item.label} className="rounded-lg px-1 py-2">
      <div className="flex items-center gap-2 px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <SectionIcon aria-hidden="true" className="size-3.5 shrink-0" />
        <span>{item.label}</span>
      </div>
      <ul className="ml-3 flex flex-col gap-1 border-l border-border/80 pl-3">
        {item.children.map((child) =>
          renderSidebarLink(child, pathname, onNavigate),
        )}
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
      <div className="flex h-16 items-center justify-between px-4">
        <Link
          href="/admin"
          className="text-sm font-semibold tracking-tight"
          onClick={onNavigate}
        >
          Nihai Emlak Admin
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Menüyü kapat"
          onClick={onCloseMobile}
          className="lg:hidden"
        >
          <X aria-hidden="true" data-icon="inline-start" />
        </Button>
      </div>

      <Separator />

      <nav className="flex-1 overflow-y-auto p-3" aria-label="Admin bölümleri">
        <ul className="flex flex-col gap-2">
          {ADMIN_SIDEBAR_ITEMS.map((item) =>
            renderSidebarSection(item, pathname, onNavigate),
          )}
        </ul>
      </nav>
    </aside>
  );
}
