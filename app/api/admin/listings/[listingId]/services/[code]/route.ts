import { handleAdminListingsServicePatch } from "@/lib/admin/listings-pricing-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ listingId: string; code: string }> },
) {
  const params = await context.params;

  return handleAdminListingsServicePatch(
    request,
    { createServerSupabaseClient },
    params,
  );
}
