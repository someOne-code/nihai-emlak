import type {
  ApiListingDetail,
  ApiListingListItem,
  ListingGalleryImage,
  ListingFuelType,
  ListingHeatingType,
  ListingParkingType,
  ListingUsageStatus,
} from "@/types/listing";

export const LISTING_IMAGE_FALLBACK = "/property-nextjs-pro/placeholder-property.jpg";

export type ListingFeatureRow = {
  label: string;
  value: number | string;
};

export function getListingPrimaryImage(
  listing: Pick<ApiListingListItem, "primary_image_card_url" | "primary_image_url">,
): string {
  const imageUrl = getFirstDisplayableListingImageUrl(
    listing.primary_image_card_url,
    listing.primary_image_url,
  );
  return isDisplayableListingImageUrl(imageUrl) ? imageUrl : LISTING_IMAGE_FALLBACK;
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

export function getListingDetailFeatureRows(listing: ApiListingDetail): ListingFeatureRow[] {
  return [
    { label: "İlan Tipi", value: getListingBadgeLabel(listing) },
    { label: "Şehir", value: listing.city || "Belirtilmemiş" },
    { label: "İlçe", value: listing.district || "Belirtilmemiş" },
    { label: "Oda Sayısı", value: typeof listing.room_count === "number" ? listing.room_count : "Belirtilmemiş" },
    { label: "Banyo Sayısı", value: typeof listing.bathroom_count === "number" ? listing.bathroom_count : "Belirtilmemiş" },
    { label: "Brüt Alan", value: listing.gross_area_m2 ? `${listing.gross_area_m2} m²` : "Belirtilmemiş" },
    { label: "Eşyalı", value: listing.is_furnished ? "Evet" : "Hayır" },
    optionalFeature("Isıtma", listing.heating_type, HEATING_LABELS),
    optionalFeature("Yakıt", listing.fuel_type, FUEL_LABELS),
    optionalNumberFeature("Balkon", listing.balcony_count),
    optionalBooleanFeature("Asansör", listing.has_elevator, "Var", "Yok"),
    optionalFeature("Otopark", listing.parking_type, PARKING_LABELS),
    optionalBooleanFeature("Site İçinde", listing.in_site, "Evet", "Hayır"),
    optionalNumberFeature("Bina Yaşı", listing.building_age),
    optionalNumberFeature("Kat Sayısı", listing.floor_count),
    optionalTextFeature("Bulunduğu Kat", listing.floor_number),
    optionalFeature("Kullanım Durumu", listing.usage_status, USAGE_STATUS_LABELS),
    optionalTextFeature("Cephe", listing.facade),
  ].filter((row): row is ListingFeatureRow => row !== null);
}

export function getListingDetailImages(listing: ApiListingDetail): ListingGalleryImage[] {
  const images = listing.images
    .map((image) => ({
      image,
      src: getFirstDisplayableListingImageUrl(image.detail_image_url, image.image_url),
    }))
    .filter(({ src }) => isDisplayableListingImageUrl(src))
    .map((image) => ({
      id: image.image.id,
      src: image.src,
      alt: image.image.alt_text?.trim() || listing.title,
      isPrimary: image.image.is_primary,
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

const HEATING_LABELS: Record<ListingHeatingType, string> = {
  central: "Merkezi Sistem",
  combi: "Kombi",
  floor_heating: "Yerden Isıtma",
  stove: "Soba",
  air_conditioning: "Klima",
  none: "Yok",
  other: "Diğer",
};

const FUEL_LABELS: Record<ListingFuelType, string> = {
  natural_gas: "Doğalgaz",
  electricity: "Elektrik",
  coal: "Kömür",
  fuel_oil: "Fuel Oil",
  none: "Yok",
  other: "Diğer",
};

const PARKING_LABELS: Record<ListingParkingType, string> = {
  open: "Açık Otopark",
  closed: "Kapalı Otopark",
  open_closed: "Açık ve Kapalı Otopark",
  none: "Yok",
  other: "Diğer",
};

const USAGE_STATUS_LABELS: Record<ListingUsageStatus, string> = {
  empty: "Boş",
  tenant_occupied: "Kiracılı",
  owner_occupied: "Mülk Sahibi Kullanıyor",
  unknown: "Belirtilmemiş",
};

function optionalFeature<T extends string>(
  label: string,
  value: T | null,
  labels: Record<T, string>,
): ListingFeatureRow | null {
  if (!value) {
    return null;
  }

  return {
    label,
    value: labels[value] ?? value,
  };
}

function optionalBooleanFeature(
  label: string,
  value: boolean | null,
  trueLabel: string,
  falseLabel: string,
): ListingFeatureRow | null {
  if (value === null) {
    return null;
  }

  return {
    label,
    value: value ? trueLabel : falseLabel,
  };
}

function optionalNumberFeature(label: string, value: number | null): ListingFeatureRow | null {
  if (value === null) {
    return null;
  }

  return {
    label,
    value,
  };
}

function optionalTextFeature(label: string, value: string | null): ListingFeatureRow | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  return {
    label,
    value: normalized,
  };
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

function getFirstDisplayableListingImageUrl(...values: Array<string | null | undefined>): string {
  return values.find((value) => isDisplayableListingImageUrl(value ?? ""))?.trim() ?? "";
}

function isDisplayableListingImageUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  try {
    return new URL(trimmed).hostname !== "example.com";
  } catch {
    return trimmed.startsWith("/");
  }
}
