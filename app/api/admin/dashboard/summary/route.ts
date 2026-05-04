import { handleAdminDashboardSummaryGet } from "@/lib/admin/dashboard-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  return handleAdminDashboardSummaryGet(request, {
    createServerSupabaseClient,
  });
}
