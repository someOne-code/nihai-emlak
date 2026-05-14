import { handlePublicListingFiltersGet } from "@/lib/read-models/read-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

const EMPTY_FILTER_METADATA = {
  cities: [],
  districts: [],
  priceRange: {
    min: null,
    max: null,
  },
  areaRange: {
    min: null,
    max: null,
  },
};

export async function GET(request: Request) {
  return handlePublicListingFiltersGet(request, {
    createServerSupabaseClient: hasSupabasePublicConfig()
      ? createServerSupabaseClient
      : createDevelopmentPublicListingFiltersFallbackClient,
  });
}

function hasSupabasePublicConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL
      && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

async function createDevelopmentPublicListingFiltersFallbackClient() {
  if (process.env.NODE_ENV === "production") {
    return createServerSupabaseClient();
  }

  return {
    auth: {
      getUser: async () => ({
        data: { user: null },
        error: null,
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: null,
            error: null,
          }),
        }),
      }),
    }),
    rpc: async () => ({
      data: EMPTY_FILTER_METADATA,
      error: null,
    }),
  };
}
