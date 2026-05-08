import {
  handleAdminReservationDocumentsGet,
  handleAdminReservationDocumentsPost,
} from "@/lib/admin/workflow-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ reservationId: string }> },
) {
  const params = await context.params;

  return handleAdminReservationDocumentsGet(request, {
    createServerSupabaseClient,
  }, params);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ reservationId: string }> },
) {
  const params = await context.params;

  return handleAdminReservationDocumentsPost(request, {
    createServerSupabaseClient,
  }, params);
}
