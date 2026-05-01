export type OperationsAdminAccessResult =
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

export type OperationsAdminAccessDependencies = {
  createServerSupabaseClient: () => Promise<unknown>;
};

const OPERATIONS_PATH = "/admin/operations";

export async function resolveOperationsAdminAccess(
  dependencies: OperationsAdminAccessDependencies,
): Promise<OperationsAdminAccessResult> {
  const supabase = (await dependencies.createServerSupabaseClient()) as SupabaseClient;
  const userResult = await supabase.auth.getUser();

  if (userResult.error || !userResult.data.user) {
    return {
      ok: false,
      redirectTo: `/auth/login?redirect=${encodeURIComponent(OPERATIONS_PATH)}`,
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

function errorRedirect(message: string): OperationsAdminAccessResult {
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
