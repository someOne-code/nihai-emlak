// Listing image upload API route.
//
// POST /api/admin/content/uploads/listing-image
//
// Thin Next.js route boundary — delegates to content-upload-route.ts
// for auth guard, file validation, and Supabase Storage upload.

import { handleListingImageUpload } from "@/lib/admin/content-upload-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request): Promise<Response> {
  return handleListingImageUpload(request, { createServerSupabaseClient });
}
