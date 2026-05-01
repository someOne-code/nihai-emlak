import { handleAdminListingsImagesAddPost } from "@/lib/admin/listings-images-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ listingId: string }> },
) {
  const params = await context.params;

  return handleAdminListingsImagesAddPost(
    request,
    { createServerSupabaseClient },
    params,
  );
}
