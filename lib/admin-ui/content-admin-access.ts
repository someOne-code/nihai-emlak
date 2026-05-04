// Phase 9A Task 3: server-side admin access guard for /admin/content/*.
//
// Mirrors lib/admin-ui/listings-admin-access.ts and
// lib/admin-ui/operations-admin-access.ts so content admin pages
// enforce the same auth + role-check shape as the other admin routes.
// The shell never enforces auth; page-level guards remain the
// authoritative gate.
//
// Payload users auth is not used here; Supabase Auth + profiles.role
// is the single identity/role source for custom admin UI.

export type ContentAdminAccessResult =
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

export type ContentAdminAccessDependencies = {
  redirectPath?: string;
  createServerSupabaseClient: () => Promise<unknown>;
};

const CONTENT_PATH = "/admin/content";

export async function resolveContentAdminAccess(
  dependencies: ContentAdminAccessDependencies,
): Promise<ContentAdminAccessResult> {
  const supabase = (await dependencies.createServerSupabaseClient()) as SupabaseClient;
  const userResult = await supabase.auth.getUser();
  const redirectPath = resolveRedirectPath(dependencies.redirectPath);

  if (userResult.error || !userResult.data.user) {
    return {
      ok: false,
      redirectTo: `/auth/login?redirect=${encodeURIComponent(redirectPath)}`,
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

function errorRedirect(message: string): ContentAdminAccessResult {
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

function resolveRedirectPath(input: string | undefined): string {
  const value = asNonEmptyString(input);
  if (!value) {
    return CONTENT_PATH;
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return CONTENT_PATH;
  }

  return value;
}
