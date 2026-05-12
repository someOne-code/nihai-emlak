import { Bath, BedDouble, Ruler, Sofa } from "lucide-react";

import { getListingFeatures } from "@/lib/mappers/listing.mapper";
import type { ApiListingListItem } from "@/types/listing";

const icons = [BedDouble, Bath, Ruler, Sofa];

export function ListingFeatureList({
  listing,
  compact = false,
}: {
  listing: ApiListingListItem;
  compact?: boolean;
}) {
  const features = getListingFeatures(listing);

  if (features.length === 0) {
    return null;
  }

  return (
    <ul className={compact ? "flex flex-wrap gap-2" : "grid gap-3 sm:grid-cols-2"}>
      {features.map((feature, index) => {
        const Icon = icons[index] ?? BedDouble;

        return (
          <li
            key={feature}
            className={
              compact
                ? "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs text-muted-foreground"
                : "flex items-center gap-3 rounded-md border bg-card px-3 py-3 text-sm"
            }
          >
            <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>{feature}</span>
          </li>
        );
      })}
    </ul>
  );
}
