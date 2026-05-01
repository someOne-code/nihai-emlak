import {
  handleConversationMessagesGet,
  handleConversationMessagesPost,
} from "@/lib/communications/conversation-read-messages-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  const params = await context.params;

  return handleConversationMessagesGet(request, {
    createServerSupabaseClient,
  }, params);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  const params = await context.params;

  return handleConversationMessagesPost(request, {
    createServerSupabaseClient,
  }, params);
}
