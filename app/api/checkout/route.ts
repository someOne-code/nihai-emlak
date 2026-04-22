import { handleCheckoutCreatePost } from "@/lib/payments/checkout-create-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  return handleCheckoutCreatePost(request, {
    createServerSupabaseClient,
  });
}
