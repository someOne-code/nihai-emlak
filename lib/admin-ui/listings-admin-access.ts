// Phase 8.5: server-side admin access guard for /admin/listings.
//
// Mirrors lib/admin-ui/operations-admin-access.ts so the listings page
// uses the same auth + role-check shape as the operations page.

export type ListingsAdminAccessResult =
  | { ok: true }
  | { ok: false; redirectTo: string };

type SupabaseUser = {
  id: string;
};

type SupabaseError = {
  message?: string;
};

type SupabaseProfileResponse = {
  data: { role?: unknown } | null;
  error: SupabaseError | null;
};

type SupabaseClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: SupabaseUser | null };
      error: SupabaseError | null;
    }>;
  };
  from: (table: "profiles") => {
    select: (columns: "role") => {
      eq: (column: "id", value: string) => {
        maybeSingle: () => Promise<SupabaseProfileResponse>;
      };
    };
  };
};

export type ListingsAdminAccessDependencies = {
  createServerSupabaseClient: () => Promise<unknown>;
};

const LISTINGS_PATH = "/admin/listings";

export async function resolveListingsAdminAccess(
  dependencies: ListingsAdminAccessDependencies,
): Promise<ListingsAdminAccessResult> {
  const supabase = (await dependencies.createServerSupabaseClient()) as SupabaseClient;
  const userResult = await supabase.auth.getUser();

  if (userResult.error || !userResult.data.user) {
    return {
      ok: false,
      redirectTo: `/auth/login?redirect=${encodeURIComponent(LISTINGS_PATH)}`,
    };
  }

  const profileResult = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userResult.data.user.id)
    .maybeSingle();

  if (profileResult.error) {
    return errorRedirect("Admin profile lookup failed");
  }

  if (asNonEmptyString(profileResult.data?.role) !== "admin") {
    return errorRedirect("Admin role required");
  }

  return { ok: true };
}

function errorRedirect(message: string): ListingsAdminAccessResult {
  return {
    ok: false,
    redirectTo: `/auth/error?error=${encodeURIComponent(message)}`,
  };
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return value.trim();
}
