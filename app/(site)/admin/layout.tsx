import type { ReactNode } from "react";

import AdminShell from "@/components/admin-shell/AdminShell";

// Phase 8.6 Task 2: shared admin shell wrapper.
//
// This layout is a presentational shell only. Page-level access guards
// in /admin/page.tsx, /admin/listings/page.tsx, and
// /admin/operations/page.tsx remain authoritative. The shell never
// invokes Supabase auth, profile lookup, or role checks.

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
