import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

import { handleCheckoutInitPost } from "@/lib/payments/checkout-init-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  return handleCheckoutInitPost(request, {
    createServerSupabaseClient,
    createServiceRoleSupabaseClient: async () =>
      createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        },
      ),
    createRandomValue: randomUUID,
  });
}
