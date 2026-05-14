import "server-only";

import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import type { ApiListingDetail, ApiListingListResponse, ListingType } from "@/types/listing";
import type { PublicListingFilters } from "@/types/listing-filters";

type SupabaseRpcResponse = {
  data: unknown;
  error: { message?: string | null } | null;
};

type PublicListingsServerClient = {
  rpc: (
    functionName: "list_public_listings" | "get_public_listing_filters" | "get_public_listing_detail",
    args: Record<string, unknown>,
  ) => Promise<SupabaseRpcResponse>;
};

export type ListPublicListingsForServerPageInput = {
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

export async function listPublicListingsForServerPage(
  input: ListPublicListingsForServerPageInput = {},
): Promise<ApiListingListResponse> {
  const limit = input.limit ?? 20;
  const offset = input.offset ?? 0;

  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("Invalid query parameter: limit");
  }

  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new Error("Invalid query parameter: offset");
  }

  const supabase = (await (createServerSupabaseClient as () => Promise<unknown>)()) as PublicListingsServerClient;
  const result = await supabase.rpc("list_public_listings", {
    p_type: input.type ?? null,
    p_city: input.city?.trim() || null,
    p_district: input.district?.trim() || null,
    p_min_price: toNonNegativeNumber(input.min_price),
    p_max_price: toNonNegativeNumber(input.max_price),
    p_min_rooms: toNonNegativeNumber(input.min_rooms),
    p_min_bathrooms: toNonNegativeNumber(input.min_bathrooms),
    p_min_area: toNonNegativeNumber(input.min_area),
    p_max_area: toNonNegativeNumber(input.max_area),
    p_is_furnished: toBooleanOrNull(input.is_furnished),
    p_limit: limit,
    p_offset: offset,
  });

  if (result.error) {
    throw new Error("Public listings read failed");
  }

  return result.data as ApiListingListResponse;
}

export async function getPublicListingFiltersForServerPage(): Promise<PublicListingFilters> {
  const supabase = (await (createServerSupabaseClient as () => Promise<unknown>)()) as PublicListingsServerClient;
  const result = await supabase.rpc("get_public_listing_filters", {});

  if (result.error) {
    throw new Error("Public listing filters read failed");
  }

  return result.data as PublicListingFilters;
}

export async function getPublicListingDetailForServerPage(
  listingId: string,
): Promise<ApiListingDetail> {
  const supabase = (await (createServerSupabaseClient as () => Promise<unknown>)()) as PublicListingsServerClient;
  const result = await supabase.rpc("get_public_listing_detail", {
    p_listing_id: listingId,
  });

  if (result.error) {
    throw new Error("Public listing detail read failed");
  }

  return result.data as ApiListingDetail;
}

function toNonNegativeNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function toBooleanOrNull(value: boolean | string | null | undefined): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
}
