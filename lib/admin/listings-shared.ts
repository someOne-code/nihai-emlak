// Shared helpers for the Phase 8 admin listing config routes (8.1 read,
// 8.2 lifecycle writes, and reserved for 8.3 image / 8.4 pricing).
//
// Mirrors the existing admin/workflow-route.ts pattern: typed Supabase
// client surface, profiles.role-based guard, RPC error code mapping,
// and a no-store JSON envelope.

export type AdminListingsSupabaseError = {
  code?: string | null;
  message?: string | null;
};

type SupabaseMaybeSingleResponse = {
  data: unknown;
  error: AdminListingsSupabaseError | null;
};

export type AdminListingsRpcResponse = {
  data: unknown;
  error: AdminListingsSupabaseError | null;
};

export type AdminListingsRpcName =
  | "admin_list_listings"
  | "admin_get_listing"
  | "admin_create_listing"
  | "admin_update_listing"
  | "admin_set_listing_status"
  | "admin_add_listing_image"
  | "admin_reorder_listing_images"
  | "admin_delete_listing_image"
  | "admin_configure_listing_main_item"
  | "admin_configure_listing_service";

export type AdminListingsSupabaseClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: AdminListingsSupabaseError | null;
    }>;
  };
  from: (table: "profiles") => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<SupabaseMaybeSingleResponse>;
      };
    };
  };
  rpc: (
    functionName: AdminListingsRpcName,
    args: Record<string, unknown>,
  ) => Promise<AdminListingsRpcResponse>;
};

export type AdminListingsRouteDependencies = {
  createServerSupabaseClient: () => Promise<unknown>;
};

export type AdminGuardResult =
  | { ok: true; supabase: AdminListingsSupabaseClient }
  | { ok: false; response: Response };

export async function guardAdminListingsRequest(
  dependencies: AdminListingsRouteDependencies,
): Promise<AdminGuardResult> {
  const supabase = (await dependencies.createServerSupabaseClient()) as AdminListingsSupabaseClient;
  const userResult = await supabase.auth.getUser();
  if (userResult.error || !userResult.data.user) {
    return {
      ok: false,
      response: jsonError("Authentication required", 401),
    };
  }

  const profileResult = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userResult.data.user.id)
    .maybeSingle();

  if (profileResult.error) {
    return {
      ok: false,
      response: jsonError("Admin profile lookup failed", 500),
    };
  }

  const role = asNonEmptyString((profileResult.data as Record<string, unknown> | null)?.role ?? null);
  if (role !== "admin") {
    return {
      ok: false,
      response: jsonError("Admin role required", 403),
    };
  }

  return {
    ok: true,
    supabase,
  };
}

// Map an RPC error code to the canonical admin listings (status, message)
// pair documented in docs/ADMIN_LISTING_CONFIG_CONTRACT.md.
export function mapAdminListingRpcError(
  error: AdminListingsSupabaseError,
  notFoundError: string,
): [string, number] {
  const code = asNonEmptyString(error.code);

  if (code === "28000") {
    return ["Authentication required", 401];
  }

  if (code === "42501") {
    return ["Admin role required", 403];
  }

  if (code === "P0002") {
    return [notFoundError, 404];
  }

  if (code === "23505") {
    return ["Listing slug is already used", 409];
  }

  if (code === "P0004") {
    return ["Rent listing is not checkout-ready", 422];
  }

  if (code === "22023") {
    return ["Invalid admin listing request", 400];
  }

  return ["Admin listing RPC failed", 500];
}

export function jsonError(error: string, status: number): Response {
  return jsonResponse(
    {
      success: false,
      error,
    },
    status,
  );
}

export function jsonResponse(payload: unknown, status: number): Response {
  return Response.json(payload, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}

export function asUuid(value: unknown): string | null {
  const normalized = asNonEmptyString(value);
  if (!normalized || !isUuid(normalized)) {
    return null;
  }

  return normalized.toLowerCase();
}

export function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return value.trim();
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
