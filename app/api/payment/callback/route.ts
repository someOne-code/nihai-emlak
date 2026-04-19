import { createClient } from "@supabase/supabase-js";

import { inngest } from "@/lib/inngest/client";
import { handlePaymentCallbackPost } from "@/lib/payments/callback-route";

export async function POST(request: Request): Promise<Response> {
  return handlePaymentCallbackPost(request, {
    createSupabaseClient: createClient,
    sendInngestEvent: async (event) => {
      await inngest.send(event);
    },
  });
}
