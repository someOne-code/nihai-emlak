import { handleAdminReservationWorkflowSnapshotGet } from "@/lib/admin/workflow-snapshot-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ reservationId: string }> },
) {
  const params = await context.params;

  return handleAdminReservationWorkflowSnapshotGet(request, {
    createServerSupabaseClient,
  }, params);
}
