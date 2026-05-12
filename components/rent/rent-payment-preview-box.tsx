import Link from "next/link";

import { ListingChatButton } from "@/components/chat/listing-chat-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="sticky top-24 rounded-lg shadow-sm">
      <CardHeader>
        <CardTitle>Kiralama Özeti</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="rounded-md bg-muted p-4">
          <div className="text-sm text-muted-foreground">İlk ay kira</div>
          <div className="mt-1 text-2xl font-semibold">{formatListingPrice(listing)}</div>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          Ek hizmetleri ve ödeme notunu sonraki adımda seçebilirsiniz.
        </p>
        {isAuthenticated ? (
          <Button asChild>
            <Link href={`/checkout?listingId=${encodeURIComponent(listing.id)}`}>
              Ödemeye Geç
            </Link>
          </Button>
        ) : (
          <div className="flex flex-col gap-3 rounded-md border bg-muted/40 p-4">
            <p className="text-sm text-muted-foreground">
              Ödemeye geçmek için giriş yapmalısınız.
            </p>
            <Button asChild>
              <Link href={getLoginRedirectUrl(`/listings/${listing.id}`)}>Giriş Yap</Link>
            </Button>
          </div>
        )}
        <ListingChatButton listing={listing} isAuthenticated={isAuthenticated} />
      </CardContent>
    </Card>
  );
}
