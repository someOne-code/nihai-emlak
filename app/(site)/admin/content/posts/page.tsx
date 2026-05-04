// Phase 9A Task 8: Posts content admin page — full UI surface.
//
// Page-level access guard remains authoritative (Task 3 pattern unchanged).
// Payload users auth is not used here; Supabase Auth + profiles.role
// is the single identity/role source for custom admin UI.
//
// Mirrors app/(site)/admin/listings/page.tsx exactly.

import { redirect } from "next/navigation";

import AdminPostsView from "@/components/admin-posts/AdminPostsView";
import { resolveContentAdminAccess } from "@/lib/admin-ui/content-admin-access";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

import "../../listings/listings.css";
import "./posts.css";

export default async function AdminContentPostsPage() {
  const access = await resolveContentAdminAccess({
    redirectPath: "/admin/content/posts",
    createServerSupabaseClient,
  });
  if (!access.ok) {
    redirect(access.redirectTo);
  }

  return <AdminPostsView />;
}
