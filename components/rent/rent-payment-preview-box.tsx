import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getLoginRedirectUrl } from "@/lib/auth/redirect";
import { formatListingPrice } from "@/lib/mappers/listing.mapper";
import type { ApiListingDetail } from "@/types/listing";

export function RentPaymentPreviewBox({
  isAuthenticated,
  listing,
}: {
  isAuthenticated: boolean;
  listing: ApiListingDetail;
}) {
  return (
    <div className="rounded-xl bg-white p-8 shadow-property dark:bg-[#1F2A37] dark:shadow-none">
      <div className="flex flex-col gap-6">
        <div>
          <div className="text-sm text-[#668199] dark:text-[#94a3b8] mb-1">Kira Bedeli</div>
          <div className="text-3xl font-bold text-[#2F73F2]">{formatListingPrice(listing)}</div>
        </div>

        <div className="rounded-xl border border-primary/15 bg-primary/5 px-4 py-5 text-center">
          <div className="mb-1 text-xs uppercase tracking-wider text-primary/80">Süreç</div>
          <div className="font-medium text-primary">Kiralama Talebi</div>
        </div>

        <p className="text-sm leading-6 text-[#668199] dark:text-[#94a3b8] text-center px-2">
          Bu ilan için kiralama sürecini başlatabilirsiniz. Ödeme kalemleri ve ek hizmetler sonraki adımda net olarak gösterilir.
        </p>

        {isAuthenticated ? (
          <Button asChild className="h-12 w-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90">
            <Link href={`/checkout?listingId=${encodeURIComponent(listing.id)}`}>
              Kiralamayı Başlat
            </Link>
          </Button>
        ) : (
          <>
            <p className="text-sm leading-6 text-[#668199] dark:text-[#94a3b8] text-center px-2">
              Kiralama sürecine devam etmek için giriş yapmanız gerekir.
            </p>
            <Button asChild className="h-12 w-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90">
              <Link href={getLoginRedirectUrl(`/checkout?listingId=${encodeURIComponent(listing.id)}`)}>
                Giriş Yaparak Başlat
              </Link>
            </Button>
          </>
        )}
        
        <Button asChild variant="outline" className="h-11 w-full rounded-lg border border-primary/35 bg-primary/5 font-medium text-primary transition hover:bg-primary/10 hover:border-primary/40">
          <Link href="#listing-contact">İletişime Geç</Link>
        </Button>
      </div>
    </div>
  );
}
