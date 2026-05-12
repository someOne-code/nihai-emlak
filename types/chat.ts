export type ListingConversation = {
  conversation_id: string;
  listing_id: string;
  chatwoot_conversation_id: string;
  status: "ready";
};

export type ChatMessage = {
  id: string;
  content: string | null;
  message_type: "incoming" | "outgoing";
  created_at: number | null;
  private: false;
};

export type ConversationMessagesResponse = {
  conversation_id: string;
  pagination: {
    limit: number;
    offset: number;
  };
  messages: ChatMessage[];
};

export type SendMessageResponse = {
  conversation_id: string;
  message: ChatMessage;
};
