import { ListingChatButton } from "@/components/chat/listing-chat-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatListingPrice } from "@/lib/mappers/listing.mapper";
import type { ApiListingDetail } from "@/types/listing";

export function SaleLeadBox({
  isAuthenticated,
  listing,
}: {
  isAuthenticated: boolean;
  listing: ApiListingDetail;
}) {
  return (
    <Card className="sticky top-24 rounded-lg shadow-sm">
      <CardHeader>
        <CardTitle>Satılık İlan</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div>
          <div className="text-sm text-muted-foreground">Fiyat</div>
          <div className="mt-1 text-2xl font-semibold">{formatListingPrice(listing)}</div>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          Bu ilan hakkında bilgi almak için danışman ekibimizle iletişime geçebilirsiniz.
        </p>
        
        <div id="sale-lead" className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          Satılık ilan iletişim formu sonraki adımda eklenecek.
        </div>
        
        <Button variant="default" disabled>
          İletişim Talebi Gönder
        </Button>
        
        <ListingChatButton listing={listing} isAuthenticated={isAuthenticated} />
      </CardContent>
    </Card>
  );
}
