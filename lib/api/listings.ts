import { apiFetch } from "./client.ts";
import type {
  ApiListingDetail,
  ApiListingListResponse,
  ListingType,
} from "@/types/listing";

export type ListPublicListingsInput = {
  type?: ListingType | null;
  city?: string | null;
  limit?: number | null;
  offset?: number | null;
};

export async function listPublicListings(
  input: ListPublicListingsInput = {},
): Promise<ApiListingListResponse> {
  const params = new URLSearchParams();
  if (input.type) params.set("type", input.type);
  if (input.city?.trim()) params.set("city", input.city.trim());
  if (typeof input.limit === "number") params.set("limit", String(input.limit));
  if (typeof input.offset === "number") params.set("offset", String(input.offset));

  const query = params.toString();
  return apiFetch<ApiListingListResponse>(
    query ? `/api/public/listings?${query}` : "/api/public/listings",
  );
}

export async function getPublicListingDetail(
  listingId: string,
): Promise<ApiListingDetail> {
  return apiFetch<ApiListingDetail>(
    `/api/public/listings/${encodeURIComponent(listingId)}`,
  );
}
