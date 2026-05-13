import { BedDouble, Bath, Maximize, Building2, MapPin } from "lucide-react";
import {
  getListingLocation,
} from "@/lib/mappers/listing.mapper";
import type { ApiListingDetail } from "@/types/listing";

export function ListingDetailHeader({ listing }: { listing: ApiListingDetail }) {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold text-[#102D47] dark:text-white sm:text-3xl md:text-4xl">
        {listing.title}
      </h1>
      
      <div className="flex items-center text-[#668199] dark:text-[#94a3b8] gap-1.5">
        <MapPin className="h-5 w-5" />
        <span className="text-[17px]">{getListingLocation(listing)}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-6 text-[15px] font-medium text-[#668199] dark:text-gray-400">
        {typeof listing.room_count === "number" && (
          <div className="flex items-center gap-2">
            <BedDouble className="h-5 w-5 opacity-70" />
            <span>{listing.room_count} Oda</span>
          </div>
        )}
        
        {typeof listing.bathroom_count === "number" && (
          <div className="flex items-center gap-2">
            <Bath className="h-5 w-5 opacity-70" />
            <span>{listing.bathroom_count} Banyo</span>
          </div>
        )}

        {listing.gross_area_m2 && (
          <div className="flex items-center gap-2">
            <Maximize className="h-5 w-5 opacity-70" />
            <span>{listing.gross_area_m2} m²</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 opacity-70" />
          <span>{listing.is_furnished ? "Eşyalı" : "Eşyasız"}</span>
        </div>
      </div>
    </div>
  );
}
