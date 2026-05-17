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

const DEV_FALLBACK_LISTINGS: ApiListingListResponse["items"] = [
  {
    id: "dddddddd-1111-4111-8111-111111111111",
    type: "rent",
    status: "active",
    title: "Kadikoy Merkezi Kiralik Daire",
    slug: "kadikoy-merkezi-kiralik-daire",
    summary: "Metroya yakin, esyali ve kullanima hazir kiralik daire.",
    city: "Istanbul",
    district: "Kadikoy",
    price: 42000,
    currency: "TRY",
    room_count: 3,
    bathroom_count: 2,
    gross_area_m2: 125,
    is_furnished: true,
    primary_image_url: "/property-nextjs-pro/images/properties/prop-1.jpg",
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "dddddddd-2222-4222-8222-222222222222",
    type: "sale",
    status: "active",
    title: "Besiktas Manzarali Satilik Daire",
    slug: "besiktas-manzarali-satilik-daire",
    summary: "Genis cepheli, otoparkli satilik daire.",
    city: "Istanbul",
    district: "Besiktas",
    price: 8750000,
    currency: "TRY",
    room_count: 4,
    bathroom_count: 2,
    gross_area_m2: 165,
    is_furnished: false,
    primary_image_url: "/property-nextjs-pro/images/properties/prop-2.jpg",
    created_at: "2026-01-02T00:00:00.000Z",
  },
  {
    id: "dddddddd-3333-4333-8333-333333333333",
    type: "rent",
    status: "active",
    title: "Sisli Site Icinde Kiralik Residence",
    slug: "sisli-site-icinde-kiralik-residence",
    summary: "Site icinde, kapali otoparkli modern residence.",
    city: "Istanbul",
    district: "Sisli",
    price: 58000,
    currency: "TRY",
    room_count: 2,
    bathroom_count: 1,
    gross_area_m2: 92,
    is_furnished: false,
    primary_image_url: "/property-nextjs-pro/images/properties/prop-3.jpg",
    created_at: "2026-01-03T00:00:00.000Z",
  },
];

const DEV_FALLBACK_FILTERS: PublicListingFilters = {
  cities: [{ value: "Istanbul", label: "Istanbul", count: 3 }],
  districts: [
    { value: "Kadikoy", label: "Kadikoy", count: 1, city: "Istanbul" },
    { value: "Besiktas", label: "Besiktas", count: 1, city: "Istanbul" },
    { value: "Sisli", label: "Sisli", count: 1, city: "Istanbul" },
  ],
  priceRange: { min: 42000, max: 8750000 },
  areaRange: { min: 92, max: 165 },
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

  try {
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
      if (shouldUseDevFallbackPublicListings()) {
        return buildDevFallbackPublicListingsResponse({
          ...input,
          limit,
          offset,
        });
      }

      throw new Error("Public listings read failed");
    }

    return result.data as ApiListingListResponse;
  } catch {
    if (shouldUseDevFallbackPublicListings()) {
      return buildDevFallbackPublicListingsResponse({
        ...input,
        limit,
        offset,
      });
    }

    throw new Error("Public listings read failed");
  }
}

export async function getPublicListingFiltersForServerPage(): Promise<PublicListingFilters> {
  try {
    const supabase = (await (createServerSupabaseClient as () => Promise<unknown>)()) as PublicListingsServerClient;
    const result = await supabase.rpc("get_public_listing_filters", {});

    if (result.error) {
      if (shouldUseDevFallbackPublicListings()) {
        return DEV_FALLBACK_FILTERS;
      }

      throw new Error("Public listing filters read failed");
    }

    return result.data as PublicListingFilters;
  } catch {
    if (shouldUseDevFallbackPublicListings()) {
      return DEV_FALLBACK_FILTERS;
    }

    throw new Error("Public listing filters read failed");
  }
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

function shouldUseDevFallbackPublicListings(): boolean {
  return process.env.NODE_ENV !== "production";
}

function buildDevFallbackPublicListingsResponse(
  input: ListPublicListingsForServerPageInput & { limit: number; offset: number },
): ApiListingListResponse {
  const minPrice = toNonNegativeNumber(input.min_price);
  const maxPrice = toNonNegativeNumber(input.max_price);
  const minRooms = toNonNegativeNumber(input.min_rooms);
  const minBathrooms = toNonNegativeNumber(input.min_bathrooms);
  const minArea = toNonNegativeNumber(input.min_area);
  const maxArea = toNonNegativeNumber(input.max_area);
  const isFurnished = toBooleanOrNull(input.is_furnished);

  const items = DEV_FALLBACK_LISTINGS.filter((listing) => {
    const price = Number(listing.price);
    const area = listing.gross_area_m2 === null ? null : Number(listing.gross_area_m2);

    return (
      (!input.type || listing.type === input.type)
      && (!input.city || listing.city === input.city.trim())
      && (!input.district || listing.district === input.district.trim())
      && (minPrice === null || price >= minPrice)
      && (maxPrice === null || price <= maxPrice)
      && (minRooms === null || (listing.room_count ?? 0) >= minRooms)
      && (minBathrooms === null || (listing.bathroom_count ?? 0) >= minBathrooms)
      && (minArea === null || (area ?? 0) >= minArea)
      && (maxArea === null || (area ?? 0) <= maxArea)
      && (isFurnished === null || listing.is_furnished === isFurnished)
    );
  });

  return {
    items: items.slice(input.offset, input.offset + input.limit),
    limit: input.limit,
    offset: input.offset,
  };
}
