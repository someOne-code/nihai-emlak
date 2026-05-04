// Phase 9A: Blog cover image upload API route.
//
// POST /api/admin/content/uploads/blog-cover
//
// Thin Next.js route boundary — delegates to content-upload-route.ts
// for auth guard, file validation, and Supabase Storage upload.

import { handleBlogCoverUpload } from "@/lib/admin/content-upload-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request): Promise<Response> {
  return handleBlogCoverUpload(request, { createServerSupabaseClient });
}
