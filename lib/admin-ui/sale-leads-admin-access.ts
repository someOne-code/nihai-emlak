export type SaleLeadsAdminAccessResult =
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

export type SaleLeadsAdminAccessDependencies = {
  createServerSupabaseClient: () => Promise<unknown>;
};

const ADMIN_SALE_LEADS_PATH = "/admin/sale-leads";

export async function resolveSaleLeadsAdminAccess(
  dependencies: SaleLeadsAdminAccessDependencies,
): Promise<SaleLeadsAdminAccessResult> {
  const supabase = (await dependencies.createServerSupabaseClient()) as SupabaseClient;
  const userResult = await supabase.auth.getUser();

  if (userResult.error || !userResult.data.user) {
    return {
      ok: false,
      redirectTo: `/auth/login?redirect=${encodeURIComponent(ADMIN_SALE_LEADS_PATH)}`,
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

function errorRedirect(message: string): SaleLeadsAdminAccessResult {
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
