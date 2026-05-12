import { RentPaymentPreviewBox } from "@/components/rent/rent-payment-preview-box";
import { SaleLeadBox } from "@/components/sale/sale-lead-box";
import { createClient } from "@/lib/supabase/server";
import type { ApiListingDetail } from "@/types/listing";

export async function ListingActionBox({ listing }: { listing: ApiListingDetail }) {
  const isAuthenticated = await resolveIsAuthenticated();

  if (listing.type === "rent") {
    return <RentPaymentPreviewBox listing={listing} isAuthenticated={isAuthenticated} />;
  }

  return <SaleLeadBox listing={listing} isAuthenticated={isAuthenticated} />;
}

async function resolveIsAuthenticated(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    return !error && Boolean(data.user);
  } catch {
    return false;
  }
}
