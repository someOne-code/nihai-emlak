import { handleAdminUsersGet } from "@/lib/admin/users-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  return handleAdminUsersGet(request, {
    createServerSupabaseClient,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL,
  });
}
