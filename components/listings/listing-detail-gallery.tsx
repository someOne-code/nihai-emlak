"use client";

import { useState } from "react";
import { getListingDetailImages } from "@/lib/mappers/listing.mapper";
import type { ApiListingDetail } from "@/types/listing";

export function ListingDetailGallery({ listing }: { listing: ApiListingDetail }) {
  const images = getListingDetailImages(listing);
  const [activeImage, setActiveImage] = useState(images[0]);

  return (
    <div className="flex flex-col gap-4">
      {/* Main Image */}
      <div className="relative aspect-[4/3] md:aspect-[16/9] w-full max-h-[500px] overflow-hidden rounded-xl bg-slate-100 shadow-property dark:bg-slate-800">
        <img
          src={activeImage.src}
          alt={activeImage.alt}
          className="h-full w-full object-cover transition-opacity duration-300"
        />
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {images.map((img) => (
            <button
              key={img.id}
              onClick={() => setActiveImage(img)}
              className={`relative h-20 w-32 shrink-0 overflow-hidden rounded-lg transition-all ${
                activeImage.id === img.id
                  ? "ring-2 ring-[#2F73F2] ring-offset-2 opacity-100"
                  : "border border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              <img
                src={img.src}
                alt={img.alt}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
