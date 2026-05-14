import { apiFetch } from "./client.ts";
import type {
  ConversationMessagesResponse,
  ListingConversation,
  SendMessageResponse,
} from "@/types/chat";

export async function getListingConversation(
  listingId: string,
): Promise<ListingConversation> {
  return apiFetch<ListingConversation>(
    `/api/communications/listings/${encodeURIComponent(listingId)}/conversation`,
  );
}

export async function createListingConversation(
  listingId: string,
  initialMessage?: string,
): Promise<ListingConversation> {
  const trimmedMessage = initialMessage?.trim();
  const body = trimmedMessage ? { initial_message: trimmedMessage } : {};

  return apiFetch<ListingConversation>(
    `/api/communications/listings/${encodeURIComponent(listingId)}/conversation`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export async function getConversationMessages(
  conversationId: string,
): Promise<ConversationMessagesResponse> {
  return apiFetch<ConversationMessagesResponse>(
    `/api/communications/conversations/${encodeURIComponent(conversationId)}/messages`,
  );
}

export async function sendConversationMessage(
  conversationIdOrInput: string | {
    conversationId: string;
    content: string;
  },
  content?: string,
): Promise<SendMessageResponse> {
  const input = typeof conversationIdOrInput === "string"
    ? { conversationId: conversationIdOrInput, content: content ?? "" }
    : conversationIdOrInput;

  return apiFetch<SendMessageResponse>(
    `/api/communications/conversations/${encodeURIComponent(input.conversationId)}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        content: input.content.trim(),
      }),
    },
  );
}

export async function openListingConversation(input: {
  listingId: string;
  initialMessage?: string;
}): Promise<ListingConversation> {
  return createListingConversation(input.listingId, input.initialMessage);
}

export async function listConversationMessages(
  conversationId: string,
): Promise<ConversationMessagesResponse> {
  return getConversationMessages(conversationId);
}
