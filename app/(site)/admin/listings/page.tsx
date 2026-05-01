import { redirect } from "next/navigation";

import AdminListingsView from "@/components/admin-listings/AdminListingsView";
import { resolveListingsAdminAccess } from "@/lib/admin-ui/listings-admin-access";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

import "./listings.css";

export default async function AdminListingsPage() {
  const access = await resolveListingsAdminAccess({
    createServerSupabaseClient,
  });
  if (!access.ok) {
    redirect(access.redirectTo);
  }

  return <AdminListingsView />;
}
