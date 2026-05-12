import { getListingBadgeLabel } from "@/lib/mappers/listing.mapper";
import type { ApiListingListItem } from "@/types/listing";
import { Check } from "lucide-react";

export function ListingFeatureList({
  listing,
}: {
  listing: ApiListingListItem;
}) {
  const features = [
    { label: "İlan Tipi", value: getListingBadgeLabel(listing) },
    { label: "Şehir", value: listing.city || "Belirtilmemiş" },
    { label: "İlçe", value: listing.district || "Belirtilmemiş" },
    { label: "Oda Sayısı", value: typeof listing.room_count === "number" ? listing.room_count : "Belirtilmemiş" },
    { label: "Banyo Sayısı", value: typeof listing.bathroom_count === "number" ? listing.bathroom_count : "Belirtilmemiş" },
    { label: "Brüt Alan", value: listing.gross_area_m2 ? `${listing.gross_area_m2} m²` : "Belirtilmemiş" },
    { label: "Eşyalı", value: listing.is_furnished ? "Evet" : "Hayır" },
  ];

  return (
    <div className="grid gap-y-4 gap-x-8 sm:grid-cols-2 md:grid-cols-3">
      {features.map((feature) => (
        <div key={feature.label} className="flex items-center gap-3">
          <Check className="h-5 w-5 text-[#2F73F2] shrink-0" strokeWidth={2} />
          <span className="text-[15px] text-muted-foreground dark:text-[#94a3b8]">
            {feature.label}: <span className="font-medium text-[#102D47] dark:text-white">{feature.value}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
