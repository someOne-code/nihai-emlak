// Phase 9B: PATCH /api/admin/catalog/main-items/:code

import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { handleAdminCatalogMainItemPatch } from "@/lib/admin/catalog-route";

const dependencies = { createServerSupabaseClient };

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<Response> {
  const { code } = await params;
  return handleAdminCatalogMainItemPatch(request, dependencies, { code });
}
