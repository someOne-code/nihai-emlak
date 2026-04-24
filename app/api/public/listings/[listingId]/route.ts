import { handlePublicListingDetailGet } from "@/lib/read-models/read-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ listingId: string }> },
) {
  const params = await context.params;

  return handlePublicListingDetailGet(request, {
    createServerSupabaseClient,
  }, params);
}
