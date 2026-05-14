"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ApiFetchError } from "@/lib/api/client";
import {
  createListingConversation,
  getConversationMessages,
  getListingConversation,
  sendConversationMessage,
} from "@/lib/api/communications";
import { getLoginRedirectUrl } from "@/lib/auth/redirect";
import type { ChatMessage } from "@/types/chat";

const START_ERROR = "Mesajlaşma başlatılırken bir sorun oluştu. Lütfen tekrar deneyin.";
const SEND_ERROR = "Mesaj gönderilemedi. Lütfen tekrar deneyin.";
const MAX_MESSAGE_LENGTH = 2000;

export function ListingChatPanel({
  listingId,
  onOpenChange,
  open,
}: {
  listingId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSendError(null);
      return;
    }

    let cancelled = false;

    async function loadConversation() {
      setIsLoading(true);
      setLoadError(null);
      setSendError(null);
      setAuthRequired(false);

      try {
        let conversation;
        try {
          conversation = await getListingConversation(listingId);
        } catch (error) {
          if (error instanceof ApiFetchError && error.status === 404) {
            conversation = await createListingConversation(listingId);
          } else {
            throw error;
          }
        }

        const history = await getConversationMessages(conversation.conversation_id);
        if (!cancelled) {
          setConversationId(conversation.conversation_id);
          setMessages(history.messages);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (error instanceof ApiFetchError && error.status === 401) {
          setAuthRequired(true);
        } else {
          setLoadError(START_ERROR);
        }
        setConversationId(null);
        setMessages([]);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadConversation();

    return () => {
      cancelled = true;
    };
  }, [listingId, open]);

  async function handleSendMessage() {
    const content = draft.trim();
    if (!conversationId || content.length < 1) {
      setSendError("Mesaj boş olamaz.");
      return;
    }

    setIsSending(true);
    setSendError(null);
    try {
      const response = await sendConversationMessage(conversationId, content);
      setMessages((current) => [...current, response.message]);
      setDraft("");
    } catch (error) {
      if (error instanceof ApiFetchError && error.status === 401) {
        setAuthRequired(true);
      } else {
        setSendError(SEND_ERROR);
      }
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>İlan Mesajlaşması</DialogTitle>
        <DialogDescription>
          Bu ilanla ilgili sorularınızı ekibimize iletebilirsiniz.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        {isLoading ? (
          <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
            Mesajlaşma hazırlanıyor...
          </div>
        ) : null}

        {authRequired ? (
          <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">
              Bu ilanla ilgili mesajlaşmak için giriş yapmanız gerekir. Giriş yaptıktan sonra konuşmanız hesabınıza kaydedilir ve kaldığınız yerden devam edebilirsiniz.
            </p>
            <Button asChild className="w-full bg-[#2F73F2] text-white hover:bg-blue-600">
              <Link href={getLoginRedirectUrl(`/listings/${listingId}`)}>
                Giriş Yap ve Mesaj Gönder
              </Link>
            </Button>
          </div>
        ) : null}

        {loadError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {loadError}
          </div>
        ) : null}

        {!isLoading && !authRequired && !loadError ? (
          <>
            <div className="h-72 overflow-y-auto rounded-md border bg-muted/20 p-3">
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">Henüz mesaj geçmişi yok.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={4}
                maxLength={MAX_MESSAGE_LENGTH}
                placeholder="Mesajınızı yazın..."
                aria-label="Yeni mesaj"
                disabled={!conversationId || isSending}
              />
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  {draft.length}/{MAX_MESSAGE_LENGTH}
                </span>
                <Button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={!conversationId || isSending || draft.trim().length < 1}
                  className="bg-[#2F73F2] text-white hover:bg-blue-600"
                >
                  <Send className="h-4 w-4" />
                  {isSending ? "Gönderiliyor..." : "Gönder"}
                </Button>
              </div>
            </div>
          </>
        ) : null}

        {sendError ? <p className="text-sm text-destructive">{sendError}</p> : null}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Kapat
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUserMessage = message.message_type === "incoming";
  const timestamp = formatMessageTime(message.created_at);

  return (
    <div className={isUserMessage ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUserMessage
            ? "max-w-[82%] rounded-lg bg-[#2F73F2] px-3 py-2 text-sm text-white"
            : "max-w-[82%] rounded-lg bg-background px-3 py-2 text-sm text-foreground"
        }
      >
        <p className="whitespace-pre-wrap break-words">
          {message.content ?? ""}
        </p>
        {timestamp ? (
          <p className={isUserMessage ? "mt-1 text-[11px] text-white/70" : "mt-1 text-[11px] text-muted-foreground"}>
            {timestamp}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function formatMessageTime(value: number | null): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value * 1000));
}
