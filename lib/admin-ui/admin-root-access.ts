// Phase 8.6 Task 2: server-side admin access guard for /admin (root).
//
// Mirrors lib/admin-ui/listings-admin-access.ts and
// lib/admin-ui/operations-admin-access.ts so the dashboard root page
// enforces the same auth + role-check shape as the other admin routes.
// The shell never enforces auth; page-level guards remain the
// authoritative gate.

export type AdminRootAccessResult =
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

export type AdminRootAccessDependencies = {
  createServerSupabaseClient: () => Promise<unknown>;
};

const ADMIN_ROOT_PATH = "/admin";

export async function resolveAdminRootAccess(
  dependencies: AdminRootAccessDependencies,
): Promise<AdminRootAccessResult> {
  const supabase = (await dependencies.createServerSupabaseClient()) as SupabaseClient;
  const userResult = await supabase.auth.getUser();

  if (userResult.error || !userResult.data.user) {
    return {
      ok: false,
      redirectTo: `/auth/login?redirect=${encodeURIComponent(ADMIN_ROOT_PATH)}`,
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

function errorRedirect(message: string): AdminRootAccessResult {
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
