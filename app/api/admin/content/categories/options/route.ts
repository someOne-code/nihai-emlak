// Phase 9A Task 5: Categories options API route — for posts form select dropdown.

import { handleCategoriesOptionsGet } from "@/lib/admin/content-categories-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  return handleCategoriesOptionsGet(request, { createServerSupabaseClient });
}
