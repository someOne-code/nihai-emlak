import { handleSaleLeadCreatePost } from "@/lib/sale-leads/create-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  return handleSaleLeadCreatePost(request, {
    createServerSupabaseClient,
  });
}
