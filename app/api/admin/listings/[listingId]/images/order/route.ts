import { handleAdminListingsImagesReorderPatch } from "@/lib/admin/listings-images-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ listingId: string }> },
) {
  const params = await context.params;

  return handleAdminListingsImagesReorderPatch(
    request,
    { createServerSupabaseClient },
    params,
  );
}
