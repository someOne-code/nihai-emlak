import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

export function ListingContactBox() {
  return (
    <div id="listing-contact" className="rounded-xl bg-white p-8 shadow-sm border border-slate-100 dark:bg-[#1F2A37] dark:border-slate-800">
      <div className="flex flex-col gap-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Bu İlan Hakkında Bilgi Al
        </h3>
        <p className="text-sm leading-6 text-muted-foreground">
          Sorularınız için ofisimizle iletişime geçebilir veya ilan bazlı mesajlaşma başlatabilirsiniz.
        </p>

        <Button disabled variant="outline" className="w-full gap-2 border-slate-200">
          <MessageCircle className="h-4 w-4" />
          Mesaj Gönder
        </Button>
        <p className="text-center text-[11px] text-muted-foreground/70">
          Mesajlaşma özelliği sonraki adımda eklenecek.
        </p>
      </div>
    </div>
  );
}
