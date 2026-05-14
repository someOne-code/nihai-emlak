import { RentPaymentPreviewBox } from "@/components/rent/rent-payment-preview-box";
import { SaleLeadPreviewBox } from "@/components/sale/sale-lead-preview-box";
import type { ApiListingDetail } from "@/types/listing";

export function ListingActionBox({
  listing,
  isAuthenticated,
}: {
  listing: ApiListingDetail;
  isAuthenticated: boolean;
}) {
  if (listing.type === "rent") {
    return <RentPaymentPreviewBox listing={listing} isAuthenticated={isAuthenticated} />;
  }

  return <SaleLeadPreviewBox listing={listing} />;
}
