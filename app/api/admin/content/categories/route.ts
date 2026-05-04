// Phase 9A Task 5: Categories content admin API routes (list + create).

import {
  handleCategoriesListGet,
  handleCategoriesCreatePost,
} from "@/lib/admin/content-categories-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  return handleCategoriesListGet(request, {
    createServerSupabaseClient,
  });
}

export async function POST(request: Request) {
  return handleCategoriesCreatePost(request, {
    createServerSupabaseClient,
  });
}
