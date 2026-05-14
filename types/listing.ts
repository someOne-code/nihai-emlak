export type ListingType = "rent" | "sale";
export type ListingHeatingType =
  | "central"
  | "combi"
  | "floor_heating"
  | "stove"
  | "air_conditioning"
  | "none"
  | "other";
export type ListingFuelType =
  | "natural_gas"
  | "electricity"
  | "coal"
  | "fuel_oil"
  | "none"
  | "other";
export type ListingParkingType =
  | "open"
  | "closed"
  | "open_closed"
  | "none"
  | "other";
export type ListingUsageStatus =
  | "empty"
  | "tenant_occupied"
  | "owner_occupied"
  | "unknown";

export type ApiListingListItem = {
  id: string;
  type: ListingType;
  status: "active" | "passive";
  title: string;
  slug: string;
  summary: string | null;
  city: string;
  district: string | null;
  price: number | string;
  currency: string;
  room_count: number | null;
  bathroom_count: number | null;
  gross_area_m2: number | string | null;
  is_furnished: boolean;
  primary_image_url: string | null;
  primary_image_card_url?: string | null;
  primary_image_detail_url?: string | null;
  created_at: string;
};

export type ApiListingImage = {
  id: string;
  image_url: string;
  card_image_url?: string | null;
  detail_image_url?: string | null;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
};

export type ApiListingDetail = ApiListingListItem & {
  description: string | null;
  heating_type: ListingHeatingType | null;
  fuel_type: ListingFuelType | null;
  balcony_count: number | null;
  has_elevator: boolean | null;
  parking_type: ListingParkingType | null;
  in_site: boolean | null;
  building_age: number | null;
  floor_count: number | null;
  floor_number: string | null;
  usage_status: ListingUsageStatus | null;
  facade: string | null;
  images: ApiListingImage[];
  updated_at: string;
};

export type ApiListingListResponse = {
  items: ApiListingListItem[];
  limit: number;
  offset: number;
};

export type ListingGalleryImage = {
  id: string;
  src: string;
  alt: string;
  isPrimary: boolean;
};
