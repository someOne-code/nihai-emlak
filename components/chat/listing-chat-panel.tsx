"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  listConversationMessages,
  openListingConversation,
  sendConversationMessage,
} from "@/lib/api/communications";
import type { ChatMessage } from "@/types/chat";
import type { ApiListingDetail } from "@/types/listing";

const DEFAULT_INITIAL_MESSAGE = "Merhaba, bu ilan hakkında bilgi almak istiyorum.";

export function ListingChatPanel({
  listing,
  onOpenChange,
  open,
}: {
  listing: ApiListingDetail;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [initialMessage, setInitialMessage] = useState(DEFAULT_INITIAL_MESSAGE);
  const [newMessage, setNewMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setStatus(null);
      setError(null);
    }
  }, [open]);

  async function handleStartConversation() {
    const trimmedMessage = initialMessage.trim();
    if (trimmedMessage.length < 1) {
      setError("Mesaj boş olamaz.");
      return;
    }

    setIsBusy(true);
    setError(null);
    setStatus(null);
    try {
      const conversation = await openListingConversation({
        listingId: listing.id,
        initialMessage: trimmedMessage,
      });
      setConversationId(conversation.conversation_id);
      setStatus("Mesajınız gönderildi.");
      const history = await listConversationMessages(conversation.conversation_id).catch(() => null);
      if (history) {
        setMessages(history.messages);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Mesajlaşma başlatılamadı.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSendMessage() {
    if (!conversationId) {
      return;
    }

    const content = newMessage.trim();
    if (content.length < 1) {
      setError("Mesaj boş olamaz.");
      return;
    }

    setIsBusy(true);
    setError(null);
    setStatus(null);
    try {
      const response = await sendConversationMessage({
        conversationId,
        content,
      });
      setMessages((current) => [...current, response.message]);
      setNewMessage("");
      setStatus("Mesajınız gönderildi.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Mesaj gönderilemedi.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Danışmana Sor</DialogTitle>
        <DialogDescription>
          Bu ilan hakkında danışmana mesaj gönderin.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        {!conversationId ? (
          <>
            <Textarea
              value={initialMessage}
              onChange={(event) => setInitialMessage(event.target.value)}
              rows={5}
              aria-label="İlk mesaj"
            />
            <Button type="button" onClick={handleStartConversation} disabled={isBusy}>
              {isBusy ? "Başlatılıyor..." : "Mesajlaşmayı Başlat"}
            </Button>
          </>
        ) : (
          <>
            <div className="max-h-56 overflow-y-auto rounded-md border bg-muted/30 p-3">
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">Henüz mesaj geçmişi yok.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className="rounded-md bg-background px-3 py-2 text-sm"
                    >
                      {message.content}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Textarea
              value={newMessage}
              onChange={(event) => setNewMessage(event.target.value)}
              rows={3}
              placeholder="Mesajınızı yazın"
              aria-label="Yeni mesaj"
            />
            <Button type="button" onClick={handleSendMessage} disabled={isBusy}>
              {isBusy ? "Gönderiliyor..." : "Mesaj Gönder"}
            </Button>
          </>
        )}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Kapat
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
