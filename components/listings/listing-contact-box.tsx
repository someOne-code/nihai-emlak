"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { ListingChatPanel } from "@/components/chat/listing-chat-panel";
import { Button } from "@/components/ui/button";
import { getLoginRedirectUrl } from "@/lib/auth/redirect";

export function ListingContactBox({
  listingId,
  isAuthenticated,
}: {
  listingId: string;
  isAuthenticated: boolean;
}) {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div id="listing-contact" className="rounded-xl bg-white p-8 shadow-sm border border-slate-100 dark:bg-[#1F2A37] dark:border-slate-800">
      <div className="flex flex-col gap-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Bu İlan Hakkında Bilgi Al
        </h3>

        {isAuthenticated ? (
          <>
            <p className="text-sm leading-6 text-muted-foreground">
              Bu ilanla ilgili sorularınızı ofisimize iletebilirsiniz. Mesaj geçmişiniz hesabınızda saklanır.
            </p>
            <Button
              type="button"
              onClick={() => setChatOpen(true)}
              className="w-full gap-2 bg-[#2F73F2] text-white hover:bg-blue-600"
            >
              <MessageCircle className="h-4 w-4" />
              Mesaj Gönder
            </Button>
            <ListingChatPanel
              listingId={listingId}
              open={chatOpen}
              onOpenChange={setChatOpen}
            />
          </>
        ) : (
          <>
            <p className="text-sm leading-6 text-muted-foreground">
              Bu ilanla ilgili mesajlaşmak için giriş yapmanız gerekir. Giriş yaptıktan sonra konuşmanız hesabınıza kaydedilir ve kaldığınız yerden devam edebilirsiniz.
            </p>
            <Button asChild className="w-full gap-2 bg-[#2F73F2] text-white hover:bg-blue-600">
              <Link href={getLoginRedirectUrl(`/listings/${listingId}`)}>
                <MessageCircle className="h-4 w-4" />
                Giriş Yap ve Mesaj Gönder
              </Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
