// Phase 9B: GET /api/admin/catalog/main-items
//           POST /api/admin/catalog/main-items

import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import {
  handleAdminCatalogMainItemGet,
  handleAdminCatalogMainItemPost,
} from "@/lib/admin/catalog-route";

const dependencies = { createServerSupabaseClient };

export async function GET(request: Request): Promise<Response> {
  return handleAdminCatalogMainItemGet(request, dependencies);
}

export async function POST(request: Request): Promise<Response> {
  return handleAdminCatalogMainItemPost(request, dependencies);
}
