import { handlePublicListingsGet } from "@/lib/read-models/read-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  return handlePublicListingsGet(request, {
    createServerSupabaseClient: hasSupabasePublicConfig()
      ? createServerSupabaseClient
      : createDevelopmentPublicListingsFallbackClient,
  });
}

function hasSupabasePublicConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL
      && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

async function createDevelopmentPublicListingsFallbackClient() {
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
    rpc: async (_functionName: string, args: Record<string, unknown>) => ({
      data: {
        items: [],
        limit: args.p_limit,
        offset: args.p_offset,
      },
      error: null,
    }),
  };
}
