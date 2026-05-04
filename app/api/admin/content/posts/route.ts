// Phase 9A Task 4: Posts content admin API routes (list + create).

import {
  handlePostsCreatePost,
  handlePostsListGet,
} from "@/lib/admin/content-posts-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  return handlePostsListGet(request, {
    createServerSupabaseClient,
  });
}

export async function POST(request: Request) {
  return handlePostsCreatePost(request, {
    createServerSupabaseClient,
  });
}
