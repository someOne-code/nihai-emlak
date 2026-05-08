import { handleAdminSystemGet } from "@/lib/admin/system-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  return handleAdminSystemGet(request, {
    createServerSupabaseClient,
  });
}
