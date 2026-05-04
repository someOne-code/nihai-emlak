// Shared utilities and presentational components for Posts, Categories,
// and Consultants admin views.
//
// Eliminates the duplicated `styles` object, `Field`, `safeErrorMessage`,
// and `readIdFromMutation` that were copy-pasted into each view file.

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ContentAdminClientError } from "@/lib/admin-ui/content-client";

// ── Layout tokens ──────────────────────────────────────────────────────────────
// Single source of truth for the two-column sidebar + detail shell used by
// all three content admin views.

export const adminLayout = {
  // Page wrapper
  container: "flex flex-col gap-4",
  // Two-column split: narrow sidebar list | wide detail panel
  workspace: "grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]",
  // Left sidebar
  sidebarPanel: "flex flex-col gap-2",
  sidebarToolbar: "flex flex-wrap items-center gap-2",
  // Right detail area
  detailPanel: "min-w-0 flex-1",
  // Card shells
  cardPadded: "rounded-xl border bg-card text-card-foreground shadow p-5 overflow-y-auto",
  cardHeader: "flex items-center justify-between gap-2 mb-4",
  cardTitle: "text-base font-semibold",
  // Form layout
  formGrid: "grid grid-cols-1 gap-4 sm:grid-cols-2",
  formGridFullCol: "sm:col-span-2",
  buttonRow: "col-span-full flex flex-wrap items-center gap-2 pt-2",
  // List items (sidebar rows)
  listItem:
    "w-full rounded-lg border bg-card p-3 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
  listItemSelected:
    "w-full rounded-lg border border-primary/20 bg-accent p-3 text-left text-sm text-accent-foreground",
  listItemHeader: "flex items-start justify-between gap-2",
  listItemTitle: "font-medium truncate",
  listItemMeta: "mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground",
  // Banners
  errorBanner:
    "rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive",
  successBanner:
    "rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400",
  // Misc
  loadingText: "text-sm italic text-muted-foreground",
} as const;

// ── AdminField ─────────────────────────────────────────────────────────────────
// Wraps label + input + optional hint text in a consistent vertical stack.
// `fullWidth` spans both grid columns in a sm:grid-cols-2 form layout.

type AdminFieldProps = {
  label: string;
  hint?: string;
  fullWidth?: boolean;
  children: ReactNode;
};

export function AdminField({ label, hint, fullWidth, children }: AdminFieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", fullWidth && adminLayout.formGridFullCol)}>
      <span className="text-xs font-medium leading-none text-muted-foreground">{label}</span>
      {children}
      {hint && (
        <p className="text-[0.72rem] leading-snug text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

// ── AdminFormSection ───────────────────────────────────────────────────────────
// Horizontal divider with a label — replaces the `postsFieldGroupLabel` and
// `cnSectionDivider` CSS classes used in the forms.

type AdminFormSectionProps = {
  label: string;
  icon?: ReactNode;
};

export function AdminFormSection({ label, icon }: AdminFormSectionProps) {
  return (
    <div className="col-span-full flex items-center gap-1.5 border-b pb-1.5 text-[0.72rem] font-semibold uppercase tracking-wider text-muted-foreground">
      {icon && <span className="opacity-70" aria-hidden="true">{icon}</span>}
      {label}
    </div>
  );
}

// ── Shared utilities ───────────────────────────────────────────────────────────

export function safeErrorMessage(err: unknown): string {
  if (err instanceof ContentAdminClientError) return err.message;
  if (err instanceof Error) return err.message;
  return "Beklenmeyen bir hata oluştu.";
}

export function readIdFromMutation(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  if (typeof rec.id === "string" && rec.id.length > 0) return rec.id;
  return null;
}
