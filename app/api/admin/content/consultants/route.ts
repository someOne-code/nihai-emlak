// Phase 9A Task 6: Consultants content admin API routes (list + create).

import {
  handleConsultantsListGet,
  handleConsultantsCreatePost,
} from "@/lib/admin/content-consultants-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  return handleConsultantsListGet(request, { createServerSupabaseClient });
}

export async function POST(request: Request) {
  return handleConsultantsCreatePost(request, { createServerSupabaseClient });
}
