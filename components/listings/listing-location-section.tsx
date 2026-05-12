import { getListingLocation } from "@/lib/mappers/listing.mapper";
import type { ApiListingDetail } from "@/types/listing";
import { MapPin } from "lucide-react";

export function ListingLocationSection({ listing }: { listing: ApiListingDetail }) {
  const location = getListingLocation(listing);

  return (
    <div className="relative flex aspect-[21/9] w-full flex-col items-center justify-center overflow-hidden rounded-xl bg-[#f8f9fa] border shadow-sm dark:bg-[#1e293b]">
      <MapPin className="mb-2 h-8 w-8 text-muted-foreground opacity-50" />
      <div className="text-center">
        <p className="font-medium text-muted-foreground">Harita görünümü yakında eklenecek</p>
        <p className="text-sm text-muted-foreground/80 mt-1">{location}</p>
      </div>
    </div>
  );
}
