// Phase 9B: GET /api/admin/catalog/services
//           POST /api/admin/catalog/services

import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import {
  handleAdminCatalogServiceGet,
  handleAdminCatalogServicePost,
} from "@/lib/admin/catalog-route";

const dependencies = { createServerSupabaseClient };

export async function GET(request: Request): Promise<Response> {
  return handleAdminCatalogServiceGet(request, dependencies);
}

export async function POST(request: Request): Promise<Response> {
  return handleAdminCatalogServicePost(request, dependencies);
}
