import { handleAdminListingsImagesDelete } from "@/lib/admin/listings-images-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ listingId: string; imageId: string }> },
) {
  const params = await context.params;

  return handleAdminListingsImagesDelete(
    request,
    { createServerSupabaseClient },
    params,
  );
}
