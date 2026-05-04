// Phase 9A Task 6: Consultants [id] API routes (get + update + delete).

import {
  handleConsultantGet,
  handleConsultantUpdate,
  handleConsultantDelete,
} from "@/lib/admin/content-consultants-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  return handleConsultantGet(_request, { createServerSupabaseClient }, id);
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  return handleConsultantUpdate(request, { createServerSupabaseClient }, id);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  return handleConsultantDelete(_request, { createServerSupabaseClient }, id);
}
