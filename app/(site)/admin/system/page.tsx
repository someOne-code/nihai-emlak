import { redirect } from "next/navigation";

import SystemHealthView from "@/components/admin-system/SystemHealthView";
import { resolveAdminRootAccess } from "@/lib/admin-ui/admin-root-access";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export default async function AdminSystemPage() {
  const access = await resolveAdminRootAccess({
    createServerSupabaseClient,
  });
  if (!access.ok) {
    redirect(access.redirectTo);
  }

  return <SystemHealthView />;
}
