// Phase 9A Task 5: Categories [id] API routes (get + update + delete).

import {
  handleCategoryGet,
  handleCategoryUpdate,
  handleCategoryDelete,
} from "@/lib/admin/content-categories-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  return handleCategoryGet(_request, { createServerSupabaseClient }, id);
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  return handleCategoryUpdate(request, { createServerSupabaseClient }, id);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  return handleCategoryDelete(_request, { createServerSupabaseClient }, id);
}
