import { handleAdminPaymentEventsGet } from "@/lib/read-models/read-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  return handleAdminPaymentEventsGet(request, {
    createServerSupabaseClient,
  });
}
