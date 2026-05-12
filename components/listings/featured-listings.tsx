import { ListingGrid } from "./listing-grid";
import type { ListingCardData } from "./listing-card";
import type { ApiListingListItem } from "@/types/listing";

const fallbackFeaturedListings: ListingCardData[] = [
  {
    id: "sample-rent-1",
    type: "rent",
    title: "Merkezde Ferah Kiralık Daire",
    city: "Kayseri",
    district: "Melikgazi",
    price: 35000,
    currency: "TRY",
    room_count: 3,
    bathroom_count: 2,
    gross_area_m2: 145,
    is_furnished: true,
    primary_image_url: "/property-nextjs-pro/images/properties/prop-1.jpg",
  },
  {
    id: "sample-sale-1",
    type: "sale",
    title: "Yatırıma Uygun Satılık Konut",
    city: "Kayseri",
    district: "Kocasinan",
    price: 4250000,
    currency: "TRY",
    room_count: 4,
    bathroom_count: 2,
    gross_area_m2: 180,
    is_furnished: false,
    primary_image_url: "/property-nextjs-pro/images/properties/prop-2.jpg",
  },
  {
    id: "sample-rent-2",
    type: "rent",
    title: "Site İçinde Modern Kiralık Daire",
    city: "Kayseri",
    district: "Talas",
    price: 28000,
    currency: "TRY",
    room_count: 2,
    bathroom_count: 1,
    gross_area_m2: 110,
    is_furnished: false,
    primary_image_url: "/property-nextjs-pro/images/properties/prop-3.jpg",
  },
  {
    id: "sample-sale-2",
    type: "sale",
    title: "Geniş Balkonlu Satılık Daire",
    city: "Kayseri",
    district: "Melikgazi",
    price: 5600000,
    currency: "TRY",
    room_count: 5,
    bathroom_count: 3,
    gross_area_m2: 220,
    is_furnished: true,
    primary_image_url: "/property-nextjs-pro/images/properties/prop-4.jpg",
  },
  {
    id: "sample-rent-3",
    type: "rent",
    title: "Ulaşımı Kolay Kiralık Rezidans",
    city: "Kayseri",
    district: "Kocasinan",
    price: 42000,
    currency: "TRY",
    room_count: 3,
    bathroom_count: 2,
    gross_area_m2: 160,
    is_furnished: true,
    primary_image_url: "/property-nextjs-pro/images/properties/prop-5.jpg",
  },
  {
    id: "sample-sale-3",
    type: "sale",
    title: "Aile Yaşamına Uygun Satılık Villa",
    city: "Kayseri",
    district: "Talas",
    price: 9800000,
    currency: "TRY",
    room_count: 6,
    bathroom_count: 4,
    gross_area_m2: 320,
    is_furnished: false,
    primary_image_url: "/property-nextjs-pro/images/properties/prop-6.jpg",
  },
];

export function FeaturedListings({
  listings,
  source,
}: {
  listings: ApiListingListItem[];
  source: "api" | "fallback";
}) {
  const cards = listings.length > 0 ? listings : fallbackFeaturedListings;

  return (
    <section className="flex items-center justify-center bg-[#F0F6FA] py-16 dark:bg-[#0e1624]" data-listings-source={source}>
      <div className="container mx-auto max-w-screen-xl px-4 md:max-w-screen-md lg:max-w-screen-xl">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <h2 className="mb-4 text-4xl font-bold text-[#102D47] dark:text-white" data-aos="fade-up">
            Öne Çıkan İlanlar
          </h2>
          <p className="text-base leading-7 text-[#668199]" data-aos="fade-up" data-aos-delay="100">
            Kayseri ve çevresindeki seçili kiralık ve satılık portföyleri, güncel fiyat ve temel özellikleriyle inceleyin.
          </p>
        </div>

        <ListingGrid listings={cards} />
      </div>
    </section>
  );
}
