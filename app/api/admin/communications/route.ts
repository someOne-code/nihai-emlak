// Phase D admin communications API route.
import {
  handleAdminCommunicationsGet,
  handleAdminCommunicationsPost,
} from "@/lib/admin/communications-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  return handleAdminCommunicationsGet(request, {
    createServerSupabaseClient,
  });
}

export async function POST(request: Request) {
  return handleAdminCommunicationsPost(request, {
    createServerSupabaseClient,
  });
}
