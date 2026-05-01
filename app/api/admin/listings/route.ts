import { handleAdminListingsListGet } from "@/lib/admin/listings-read-route";
import { handleAdminListingsCreatePost } from "@/lib/admin/listings-write-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  return handleAdminListingsListGet(request, {
    createServerSupabaseClient,
  });
}

export async function POST(request: Request) {
  return handleAdminListingsCreatePost(request, {
    createServerSupabaseClient,
  });
}
