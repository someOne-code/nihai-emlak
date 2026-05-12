import { ListingChatButton } from "@/components/chat/listing-chat-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SaleLeadForm } from "./sale-lead-form";
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
          Bu ilan hakkında bilgi almak için formu doldurun.
        </p>
        <SaleLeadForm listing={listing} isAuthenticated={isAuthenticated} />
        <ListingChatButton listing={listing} isAuthenticated={isAuthenticated} />
      </CardContent>
    </Card>
  );
}
