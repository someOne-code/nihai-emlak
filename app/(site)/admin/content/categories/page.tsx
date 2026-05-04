// Phase 9A Task 9: Categories content admin page — full UI surface.
//
// Page-level access guard remains authoritative (Task 3 pattern unchanged).
// Payload users auth is not used here; Supabase Auth + profiles.role
// is the single identity/role source for custom admin UI.
//
// Mirrors app/(site)/admin/content/posts/page.tsx.

import { redirect } from "next/navigation";

import AdminCategoriesView from "@/components/admin-categories/AdminCategoriesView";
import { resolveContentAdminAccess } from "@/lib/admin-ui/content-admin-access";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

import "../../listings/listings.css";
import "../posts/posts.css";

export default async function AdminContentCategoriesPage() {
  const access = await resolveContentAdminAccess({
    redirectPath: "/admin/content/categories",
    createServerSupabaseClient,
  });
  if (!access.ok) {
    redirect(access.redirectTo);
  }

  return <AdminCategoriesView />;
}
