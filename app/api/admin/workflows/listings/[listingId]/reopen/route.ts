import { handleAdminReopenListingPost } from "@/lib/admin/workflow-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ listingId: string }> },
) {
  const params = await context.params;

  return handleAdminReopenListingPost(request, {
    createServerSupabaseClient,
  }, params);
}
