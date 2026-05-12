import { ListingCard } from "./listing-card";
import type { ListingCardData } from "./listing-card";

export function ListingGrid({ listings }: { listings: ListingCardData[] }) {
  if (listings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 pt-20">
        <img
          src="/property-nextjs-pro/images/not-found/no-results.png"
          alt=""
          width={100}
          height={100}
        />
        <p className="text-[#668199]">Bu kriterlere uygun ilan bulunamadı.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {listings.map((listing, index) => (
        <div key={listing.id} data-aos="fade-up" data-aos-delay={`${index * 100}`}>
          <ListingCard listing={listing} />
        </div>
      ))}
    </div>
  );
}
