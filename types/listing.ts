export type ListingType = "rent" | "sale";

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
  created_at: string;
};

export type ApiListingImage = {
  id: string;
  image_url: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
};

export type ApiListingDetail = ApiListingListItem & {
  description: string | null;
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
