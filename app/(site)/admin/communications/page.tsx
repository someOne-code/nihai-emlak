import { redirect } from "next/navigation";

import CommunicationsView from "@/components/admin-communications/CommunicationsView";
import { resolveAdminRootAccess } from "@/lib/admin-ui/admin-root-access";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export default async function AdminCommunicationsPage() {
  const access = await resolveAdminRootAccess({
    createServerSupabaseClient,
  });
  if (!access.ok) {
    redirect(access.redirectTo);
  }

  return <CommunicationsView />;
}
