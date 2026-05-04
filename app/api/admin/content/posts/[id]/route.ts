// Phase 9A Task 4: Posts content admin API routes (get/update/delete by id).

import {
  handlePostDelete,
  handlePostGet,
  handlePostUpdate,
} from "@/lib/admin/content-posts-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handlePostGet(request, { createServerSupabaseClient }, id);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handlePostUpdate(request, { createServerSupabaseClient }, id);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handlePostDelete(request, { createServerSupabaseClient }, id);
}
