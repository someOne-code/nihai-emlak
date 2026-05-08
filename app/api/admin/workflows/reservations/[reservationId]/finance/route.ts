import {
  handleAdminReservationFinanceOpsGet,
  handleAdminReservationFinanceOpsPost,
} from "@/lib/admin/workflow-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ reservationId: string }> },
) {
  const params = await context.params;

  return handleAdminReservationFinanceOpsGet(request, {
    createServerSupabaseClient,
  }, params);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ reservationId: string }> },
) {
  const params = await context.params;

  return handleAdminReservationFinanceOpsPost(request, {
    createServerSupabaseClient,
  }, params);
}
