// Phase 9A: shared helpers for content admin route handlers.
//
// Mirrors lib/admin/listings-shared.ts pattern: typed Supabase client
// surface, profiles.role-based guard, and no-store JSON envelope.
// Payload users auth is not used for custom admin UI route guards.

import {
  validateStateChangingJsonRequestEnvelope,
  validateStateChangingRequestOrigin,
  type StateChangingJsonRouteConfig,
} from "../http/state-changing-json-route.ts";

// ── Content admin route config ──────────────────────────────────────────────

const CONTENT_ADMIN_JSON_ROUTE_CONFIG: StateChangingJsonRouteConfig = {
  maxBodyBytes: 256 * 1024,
  routeLabel: "Content admin",
};

export function validateContentAdminJsonEnvelope(
  request: Request,
): { ok: true } | { ok: false; status: number; error: string } {
  return validateStateChangingJsonRequestEnvelope(request, CONTENT_ADMIN_JSON_ROUTE_CONFIG, {
    invalidConfigError: "Content admin trusted origin configuration is invalid",
    missingConfigError: "Content admin private SITE_URL must be configured outside development/test",
    strategy: "site-url-only",
  });
}

export function validateContentAdminOrigin(
  request: Request,
): { ok: true } | { ok: false; status: number; error: string } {
  return validateStateChangingRequestOrigin(request, CONTENT_ADMIN_JSON_ROUTE_CONFIG, {
    invalidConfigError: "Content admin trusted origin configuration is invalid",
    missingConfigError: "Content admin private SITE_URL must be configured outside development/test",
    strategy: "site-url-only",
  });
}

// ── Supabase types ──────────────────────────────────────────────────────────

export type ContentAdminSupabaseError = {
  code?: string | null;
  message?: string | null;
};

type SupabaseMaybeSingleResponse = {
  data: unknown;
  error: ContentAdminSupabaseError | null;
};

export type ContentAdminSupabaseClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: ContentAdminSupabaseError | null;
    }>;
  };
  from: (table: "profiles") => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<SupabaseMaybeSingleResponse>;
      };
    };
  };
};

export type ContentAdminRouteDependencies = {
  createServerSupabaseClient: () => Promise<unknown>;
};

export type ContentAdminGuardResult =
  | { ok: true; supabase: ContentAdminSupabaseClient }
  | { ok: false; response: Response };

export async function guardContentAdminRequest(
  dependencies: ContentAdminRouteDependencies,
): Promise<ContentAdminGuardResult> {
  const supabase = (await dependencies.createServerSupabaseClient()) as ContentAdminSupabaseClient;
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

export function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return value.trim();
}
