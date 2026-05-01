import { handleAdminListingsSnapshotGet } from "@/lib/admin/listings-read-route";
import { handleAdminListingsUpdatePatch } from "@/lib/admin/listings-write-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ listingId: string }> },
) {
  const params = await context.params;

  return handleAdminListingsSnapshotGet(
    request,
    { createServerSupabaseClient },
    params,
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ listingId: string }> },
) {
  const params = await context.params;

  return handleAdminListingsUpdatePatch(
    request,
    { createServerSupabaseClient },
    params,
  );
}
