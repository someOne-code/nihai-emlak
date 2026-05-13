import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { getLoginRedirectUrl } from "@/lib/auth/redirect";

export function ListingContactBox({
  listingId,
  isAuthenticated,
}: {
  listingId: string;
  isAuthenticated: boolean;
}) {
  return (
    <div id="listing-contact" className="rounded-xl bg-white p-8 shadow-sm border border-slate-100 dark:bg-[#1F2A37] dark:border-slate-800">
      <div className="flex flex-col gap-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Bu İlan Hakkında Bilgi Al
        </h3>
        
        <p className="text-sm leading-6 text-muted-foreground">
          Bu ilanla ilgili sorularınız için ofisimizle iletişime geçebilir veya ilan bazlı mesajlaşma başlatabilirsiniz.
        </p>

        {isAuthenticated ? (
          <Button disabled className="w-full gap-2 bg-[#2F73F2] hover:bg-blue-600 text-white">
            <MessageCircle className="h-4 w-4" />
            Mesaj Gönder
          </Button>
        ) : (
          <Button asChild className="w-full gap-2 bg-[#2F73F2] hover:bg-blue-600 text-white">
            <Link href={getLoginRedirectUrl(`/listings/${listingId}`)}>
              <MessageCircle className="h-4 w-4" />
              Giriş Yap ve Mesaj Gönder
            </Link>
          </Button>
        )}
        
        <p className="text-center text-[11px] text-muted-foreground/70">
          Mesajlaşma özelliği sonraki adımda eklenecek.
        </p>
      </div>
    </div>
  );
}
