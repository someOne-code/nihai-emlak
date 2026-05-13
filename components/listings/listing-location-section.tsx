import type { ApiListingDetail } from "@/types/listing";
import { MapPin } from "lucide-react";

export function ListingLocationSection({ listing }: { listing: ApiListingDetail }) {
  let locationStr = "Konum bilgisi belirtilmemiş.";
  
  if (listing.district && listing.city) {
    locationStr = `${listing.district}, ${listing.city}`;
  } else if (listing.city) {
    locationStr = listing.city;
  } else if (listing.district) {
    locationStr = listing.district;
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-slate-50 p-6 border border-slate-100 dark:bg-[#1F2A37] dark:border-slate-800">
      <div className="flex items-center gap-2">
        <MapPin className="h-5 w-5 text-[#2F73F2]" />
        <span className="font-medium text-[#102D47] dark:text-white text-lg">
          {locationStr}
        </span>
      </div>
      <p className="text-sm text-muted-foreground ml-7">
        Harita görünümü yakında eklenecek.
      </p>
    </div>
  );
}
