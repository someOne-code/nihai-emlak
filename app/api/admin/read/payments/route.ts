import { handleAdminPaymentsGet } from "@/lib/read-models/read-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  return handleAdminPaymentsGet(request, {
    createServerSupabaseClient,
  });
}
