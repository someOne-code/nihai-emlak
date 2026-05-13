import { apiFetch } from "./client.ts";
import type {
  ApiListingDetail,
  ApiListingListResponse,
  ListingType,
} from "@/types/listing";
import type { PublicListingFilters } from "@/types/listing-filters";

export type ListPublicListingsInput = {
  type?: ListingType | null;
  city?: string | null;
  district?: string | null;
  min_price?: number | string | null;
  max_price?: number | string | null;
  min_rooms?: number | string | null;
  min_bathrooms?: number | string | null;
  min_area?: number | string | null;
  max_area?: number | string | null;
  is_furnished?: boolean | string | null;
  limit?: number | null;
  offset?: number | null;
};

export async function getPublicListings(
  input: ListPublicListingsInput = {},
): Promise<ApiListingListResponse> {
  const params = new URLSearchParams();
  if (input.type) params.set("type", input.type);
  if (input.city?.trim()) params.set("city", input.city.trim());
  if (input.district?.trim()) params.set("district", input.district.trim());
  setNumberParam(params, "min_price", input.min_price);
  setNumberParam(params, "max_price", input.max_price);
  setNumberParam(params, "min_rooms", input.min_rooms);
  setNumberParam(params, "min_bathrooms", input.min_bathrooms);
  setNumberParam(params, "min_area", input.min_area);
  setNumberParam(params, "max_area", input.max_area);
  if (typeof input.is_furnished === "boolean") {
    params.set("is_furnished", String(input.is_furnished));
  } else if (input.is_furnished === "true" || input.is_furnished === "false") {
    params.set("is_furnished", input.is_furnished);
  }
  if (typeof input.limit === "number") params.set("limit", String(input.limit));
  if (typeof input.offset === "number") params.set("offset", String(input.offset));

  const query = params.toString();
  return apiFetch<ApiListingListResponse>(
    query ? `/api/public/listings?${query}` : "/api/public/listings",
  );
}

export const listPublicListings = getPublicListings;

export async function getPublicListingFilters(): Promise<PublicListingFilters> {
  return apiFetch<PublicListingFilters>("/api/public/listing-filters");
}

export async function getPublicListingDetail(
  listingId: string,
): Promise<ApiListingDetail> {
  return apiFetch<ApiListingDetail>(
    `/api/public/listings/${encodeURIComponent(listingId)}`,
  );
}

function setNumberParam(
  params: URLSearchParams,
  key: string,
  value: number | string | null | undefined,
) {
  if (value === null || value === undefined || value === "") {
    return;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(parsed)) {
    params.set(key, String(parsed));
  }
}
