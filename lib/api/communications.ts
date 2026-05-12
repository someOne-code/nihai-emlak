import { apiFetch } from "./client.ts";
import type {
  ConversationMessagesResponse,
  ListingConversation,
  SendMessageResponse,
} from "@/types/chat";

export async function openListingConversation(input: {
  listingId: string;
  initialMessage: string;
}): Promise<ListingConversation> {
  return apiFetch<ListingConversation>(
    `/api/communications/listings/${encodeURIComponent(input.listingId)}/conversation`,
    {
      method: "POST",
      body: JSON.stringify({
        initial_message: input.initialMessage,
      }),
    },
  );
}

export async function listConversationMessages(
  conversationId: string,
): Promise<ConversationMessagesResponse> {
  return apiFetch<ConversationMessagesResponse>(
    `/api/communications/conversations/${encodeURIComponent(conversationId)}/messages`,
  );
}

export async function sendConversationMessage(input: {
  conversationId: string;
  content: string;
}): Promise<SendMessageResponse> {
  return apiFetch<SendMessageResponse>(
    `/api/communications/conversations/${encodeURIComponent(input.conversationId)}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        content: input.content,
      }),
    },
  );
}
