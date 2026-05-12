import { getListingDetailImages } from "@/lib/mappers/listing.mapper";
import type { ApiListingDetail } from "@/types/listing";

export function ListingGallery({ listing }: { listing: ApiListingDetail }) {
  const images = getListingDetailImages(listing);
  const [primary, ...secondary] = images;

  return (
    <section className="px-4">
      <div className="mx-auto max-w-screen-xl" data-aos="fade-up">
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="imageContainer h-[520px] rounded-lg shadow-deatail">
            <img
              src={primary.src}
              alt={primary.alt}
              className="h-full w-full rounded-lg object-cover duration-500 hover:scale-110"
            />
          </div>
          <div className="grid gap-4">
            {(secondary.length > 0 ? secondary.slice(0, 2) : images.slice(0, 2)).map((image) => (
              <div key={image.id} className="imageContainer h-[252px] rounded-lg shadow-property">
                <img
                  src={image.src}
                  alt={image.alt}
                  className="h-full w-full rounded-lg object-cover duration-500 hover:scale-110"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
