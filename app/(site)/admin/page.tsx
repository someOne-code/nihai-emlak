import { redirect } from "next/navigation";

import AdminDashboardView from "@/components/admin-dashboard/AdminDashboardView";
import { resolveAdminRootAccess } from "@/lib/admin-ui/admin-root-access";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export default async function AdminDashboardPage() {
  const access = await resolveAdminRootAccess({
    createServerSupabaseClient,
  });
  if (!access.ok) {
    redirect(access.redirectTo);
  }

  return <AdminDashboardView />;
}
