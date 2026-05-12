import { handleAdminUsersInvitePost } from "@/lib/admin/users-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  return handleAdminUsersInvitePost(request, {
    createServerSupabaseClient,
    siteUrl: process.env.SITE_URL,
  });
}
