import { handleListingConversationPost } from "@/lib/communications/conversation-open-route";
import { handleListingConversationGet } from "@/lib/communications/conversation-read-messages-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ listingId: string }> },
) {
  const params = await context.params;

  return handleListingConversationPost(request, {
    createServerSupabaseClient,
  }, params);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ listingId: string }> },
) {
  const params = await context.params;

  return handleListingConversationGet(request, {
    createServerSupabaseClient,
  }, params);
}
