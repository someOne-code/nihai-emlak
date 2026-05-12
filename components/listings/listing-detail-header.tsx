import {
  formatListingPrice,
  getListingBadgeLabel,
  getListingLocation,
} from "@/lib/mappers/listing.mapper";
import type { ApiListingDetail } from "@/types/listing";

export function ListingDetailHeader({ listing }: { listing: ApiListingDetail }) {
  return (
    <div className="py-12 md:py-16 lg:py-20">
      <div className="mx-auto flex max-w-screen-xl items-center justify-center">
        <div className="max-w-[43.75rem] px-4 text-center" data-aos="fade-up">
          <p className="mb-4 inline-block rounded-md bg-white px-4 py-1 text-[#2F73F2] shadow-property">
            {getListingBadgeLabel(listing)}
          </p>
          <h1 className="mb-6 text-3xl font-bold text-[#102D47] sm:text-4xl md:text-5xl lg:text-6xl">
            {listing.title}
          </h1>
          <p className="text-xl text-[#668199]">{getListingLocation(listing)}</p>
          <p className="mt-4 text-3xl font-bold text-[#2F73F2]">{formatListingPrice(listing)}</p>
        </div>
      </div>
    </div>
  );
}
