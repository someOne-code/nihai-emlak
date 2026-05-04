// Phase 9A: Consultant photo upload API route.
//
// POST /api/admin/content/uploads/consultant-photo
//
// Thin Next.js route boundary — delegates to content-upload-route.ts
// for auth guard, file validation, and Supabase Storage upload.

import { handleConsultantPhotoUpload } from "@/lib/admin/content-upload-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request): Promise<Response> {
  return handleConsultantPhotoUpload(request, { createServerSupabaseClient });
}
