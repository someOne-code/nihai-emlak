import { handleAdminConfirmReservationPost } from "@/lib/admin/workflow-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ reservationId: string }> },
) {
  const params = await context.params;

  return handleAdminConfirmReservationPost(request, {
    createServerSupabaseClient,
  }, params);
}
