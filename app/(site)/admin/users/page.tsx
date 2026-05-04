import { redirect } from "next/navigation";

import AdminUsersView from "@/components/admin-users/AdminUsersView";
import { resolveAdminRootAccess } from "@/lib/admin-ui/admin-root-access";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export default async function AdminUsersPage() {
  const access = await resolveAdminRootAccess({
    createServerSupabaseClient,
  });
  if (!access.ok) {
    redirect(access.redirectTo);
  }

  return <AdminUsersView />;
}
