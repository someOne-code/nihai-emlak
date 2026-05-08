import { redirect } from "next/navigation";

import SaleLeadsView from "@/components/admin-sale-leads/SaleLeadsView";
import { resolveSaleLeadsAdminAccess } from "@/lib/admin-ui/sale-leads-admin-access";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export default async function AdminSaleLeadsPage() {
  const access = await resolveSaleLeadsAdminAccess({
    createServerSupabaseClient,
  });
  if (!access.ok) {
    redirect(access.redirectTo);
  }

  return <SaleLeadsView />;
}
