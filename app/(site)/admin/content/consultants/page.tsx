// Phase 9A Task 10: Consultants content admin page — full UI surface.
//
// Page-level access guard remains authoritative (Task 3 pattern unchanged).
// Mirrors app/(site)/admin/content/posts/page.tsx.

import { redirect } from "next/navigation";

import AdminConsultantsView from "@/components/admin-consultants/AdminConsultantsView";
import { resolveContentAdminAccess } from "@/lib/admin-ui/content-admin-access";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

import "../../listings/listings.css";
import "../posts/posts.css";

export default async function AdminContentConsultantsPage() {
  const access = await resolveContentAdminAccess({
    redirectPath: "/admin/content/consultants",
    createServerSupabaseClient,
  });
  if (!access.ok) {
    redirect(access.redirectTo);
  }

  return <AdminConsultantsView />;
}
