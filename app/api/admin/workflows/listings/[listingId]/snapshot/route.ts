import { handleAdminListingWorkflowSnapshotGet } from "@/lib/admin/workflow-snapshot-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ listingId: string }> },
) {
  const params = await context.params;

  return handleAdminListingWorkflowSnapshotGet(request, {
    createServerSupabaseClient,
  }, params);
}
