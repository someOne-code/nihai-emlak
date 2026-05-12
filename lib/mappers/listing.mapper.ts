import type {
  ApiListingDetail,
  ApiListingListItem,
  ListingGalleryImage,
} from "@/types/listing";

export const LISTING_IMAGE_FALLBACK = "/property-nextjs-pro/placeholder-property.jpg";

export function getListingPrimaryImage(listing: Pick<ApiListingListItem, "primary_image_url">): string {
  return listing.primary_image_url?.trim() || LISTING_IMAGE_FALLBACK;
}

export function formatListingPrice(listing: Pick<ApiListingListItem, "currency" | "price" | "type">): string {
  const amount = normalizeAmount(listing.price);
  const symbol = listing.currency.toUpperCase() === "TRY" ? "₺" : `${listing.currency.toUpperCase()} `;
  const formatted = `${symbol}${amount.toLocaleString("tr-TR", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  })}`;

  return listing.type === "rent" ? `${formatted} / ay` : formatted;
}

export function getListingLocation(listing: Pick<ApiListingListItem, "city" | "district">): string {
  return [listing.district, listing.city].filter(Boolean).join(", ");
}

export function getListingFeatures(
  listing: Pick<ApiListingListItem, "bathroom_count" | "gross_area_m2" | "is_furnished" | "room_count">,
): string[] {
  const features: string[] = [];
  if (typeof listing.room_count === "number") {
    features.push(`${listing.room_count} oda`);
  }
  if (typeof listing.bathroom_count === "number") {
    features.push(`${listing.bathroom_count} banyo`);
  }

  const area = normalizeOptionalNumber(listing.gross_area_m2);
  if (area !== null) {
    features.push(`${formatNumber(area)} m²`);
  }
  if (listing.is_furnished) {
    features.push("Eşyalı");
  }

  return features;
}

export function getListingBadgeLabel(listing: Pick<ApiListingListItem, "type">): string {
  return listing.type === "rent" ? "Kiralık" : "Satılık";
}

export function getListingDetailImages(listing: ApiListingDetail): ListingGalleryImage[] {
  const images = listing.images
    .filter((image) => image.image_url.trim().length > 0)
    .map((image) => ({
      id: image.id,
      src: image.image_url,
      alt: image.alt_text?.trim() || listing.title,
      isPrimary: image.is_primary,
    }));

  if (images.length > 0) {
    return images;
  }

  return [
    {
      id: "fallback",
      src: LISTING_IMAGE_FALLBACK,
      alt: listing.title,
      isPrimary: true,
    },
  ];
}

function normalizeAmount(value: number | string): number {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function normalizeOptionalNumber(value: number | string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}
