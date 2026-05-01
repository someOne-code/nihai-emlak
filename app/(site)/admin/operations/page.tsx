import { redirect } from "next/navigation";

import OperationsView from "@/components/admin-operations/OperationsView";
import { resolveOperationsAdminAccess } from "@/lib/admin-ui/operations-admin-access";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export default async function OperationsPage() {
  const access = await requireOperationsAdminAccess();
  if (!access.ok) {
    redirect(access.redirectTo);
  }

  return <OperationsView />;
}

async function requireOperationsAdminAccess() {
  return resolveOperationsAdminAccess({
    createServerSupabaseClient,
  });
}
