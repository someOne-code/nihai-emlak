import Link from "next/link";

import {
  formatListingPrice,
  getListingBadgeLabel,
  getListingLocation,
  getListingPrimaryImage,
} from "@/lib/mappers/listing.mapper";
import type { ApiListingListItem } from "@/types/listing";

export type ListingCardData = Pick<
  ApiListingListItem,
  | "bathroom_count"
  | "city"
  | "currency"
  | "district"
  | "gross_area_m2"
  | "id"
  | "is_furnished"
  | "price"
  | "primary_image_url"
  | "room_count"
  | "title"
  | "type"
>;

export function ListingCard({
  listing,
  viewMode,
}: {
  listing: ListingCardData;
  viewMode?: "grid" | "list";
}) {
  const isList = viewMode === "list";

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-property dark:bg-[#1F2A37]" data-aos="fade-up">
      <Link href={`/listings/${listing.id}`} className={`group ${isList ? "flex" : ""}`}>
        <div className={`relative ${isList ? "w-[30%]" : ""}`}>
          <div className={`imageContainer h-[250px] w-full ${isList ? "h-full md:h-52" : ""}`}>
            <img
              src={getListingPrimaryImage(listing)}
              alt={`Image of ${listing.title}`}
              width={400}
              height={250}
              className="h-full w-full object-cover duration-500 group-hover:scale-125"
            />
          </div>
          <p className="absolute left-[10px] top-[10px] items-center rounded-md bg-white px-4 py-1 text-[#2F73F2]">
            {getListingBadgeLabel(listing)}
          </p>
        </div>
        <div className={`p-5 text-opacity-50 sm:p-8 ${isList ? "flex w-[70%] flex-col justify-center" : ""}`}>
          <div className="mb-6 flex flex-col gap-1 border-b border-[#6bc5f94d] dark:border-[#224767]">
            <p className="text-base text-[#668199]">{listing.title}</p>
            <div className="flex items-center justify-between gap-4 pb-4">
              <div className="text-2xl font-bold text-[#102D47] duration-300 group-hover:text-[#2F73F2] dark:text-white dark:group-hover:text-[#2F73F2]">
                {formatListingPrice(listing)}
              </div>
              <div className="rounded-lg bg-[#DAE7FF] px-2 py-1 text-xs font-bold text-[#102D47] dark:bg-white dark:text-[#2F73F2]">
                {getListingLocation(listing)}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-between gap-2">
            <PropertyStat icon="/property-nextjs-pro/images/svgs/icon-bed.svg" label="Oda" value={listing.room_count ?? "-"} />
            <PropertyStat icon="/property-nextjs-pro/images/svgs/icon-tub.svg" label="Banyo" value={listing.bathroom_count ?? "-"} />
            <PropertyStat icon="/property-nextjs-pro/images/svgs/icon-layout.svg" label="Alan" value={listing.gross_area_m2 ? `${listing.gross_area_m2} m²` : "-"} />
          </div>
        </div>
      </Link>
    </div>
  );
}

function PropertyStat({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: number | string;
}) {
  return (
    <div className="flex flex-col">
      <p className="flex gap-2 text-lg font-bold text-[#102D47] dark:text-white md:text-xl">
        <img src={icon} alt="" width={18} height={18} className="h-auto w-auto" />
        {value}
      </p>
      <p className="text-sm text-[#668199]">{label}</p>
    </div>
  );
}
