import { createAdminClient } from "../supabase/admin.ts";
import {
  readStateChangingJsonRequestPayload,
  validateStateChangingJsonRequestEnvelope,
  type StateChangingJsonRouteConfig,
} from "../http/state-changing-json-route.ts";

type SupabaseError = {
  code?: string | null;
  message?: string | null;
};

type AdminProfileRow = {
  id?: unknown;
  email?: unknown;
  role?: unknown;
  created_at?: unknown;
};

type ProfileSelectResponse = {
  data: unknown;
  error: SupabaseError | null;
};

type AdminUsersSupabaseClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: SupabaseError | null;
    }>;
  };
  from: (table: "profiles") => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle?: () => Promise<ProfileSelectResponse>;
        order?: (
          column: string,
          options?: { ascending?: boolean },
        ) => Promise<ProfileSelectResponse>;
      };
    };
  };
};

type AdminAuthUser = {
  id: string;
  email?: string | null;
};

type AdminServiceClient = {
  auth: {
    admin: {
      inviteUserByEmail: (
        email: string,
        options: { redirectTo: string },
      ) => Promise<{
        data: { user: AdminAuthUser | null };
        error: SupabaseError | null;
      }>;
      listUsers?: (options: { page: number; perPage: number }) => Promise<{
        data: { users?: AdminAuthUser[] } | null;
        error: SupabaseError | null;
      }>;
    };
  };
  from: (table: "profiles") => {
    upsert: (
      row: { id: string; email: string; role: "admin" },
      options?: { onConflict?: string },
    ) => Promise<{ error: SupabaseError | null }>;
  };
};

export type AdminUsersRouteDependencies = {
  createServerSupabaseClient?: () => Promise<unknown>;
  createAdminSupabaseClient?: () => unknown | null;
  siteUrl?: string | null;
  nodeEnv?: string;
};

const ADMIN_USERS_JSON_ROUTE_CONFIG: StateChangingJsonRouteConfig = {
  maxBodyBytes: 4 * 1024,
  routeLabel: "Admin users",
};

export async function handleAdminUsersGet(
  request: Request,
  dependencies: AdminUsersRouteDependencies = {},
): Promise<Response> {
  const guard = await guardAdminUsersRequest(dependencies);
  if (!guard.ok) {
    return guard.response;
  }

  const result = await guard.supabase
    .from("profiles")
    .select("id,email,role,created_at")
    .eq("role", "admin")
    .order?.("created_at", { ascending: true });

  if (!result || result.error || !Array.isArray(result.data)) {
    return jsonError("Admin users list is unavailable", 500);
  }

  return jsonResponse({
    success: true,
    data: {
      items: result.data.map(sanitizeAdminProfile).filter(Boolean),
    },
  });
}

export async function handleAdminUsersInvitePost(
  request: Request,
  dependencies: AdminUsersRouteDependencies = {},
): Promise<Response> {
  const envelope = validateStateChangingJsonRequestEnvelope(
    request,
    ADMIN_USERS_JSON_ROUTE_CONFIG,
    {
      invalidConfigError: "Admin users trusted origin configuration is invalid",
      missingConfigError: "Admin users private SITE_URL must be configured outside development/test",
      strategy: "site-url-only",
    },
  );
  if (!envelope.ok) {
    return jsonError(envelope.error, envelope.status);
  }

  const bodyResult = await readStateChangingJsonRequestPayload(
    request,
    ADMIN_USERS_JSON_ROUTE_CONFIG,
  );
  if (!bodyResult.ok) {
    return jsonError(bodyResult.error, bodyResult.status);
  }

  const guard = await guardAdminUsersRequest(dependencies);
  if (!guard.ok) {
    return guard.response;
  }

  const email = parseInviteEmail(bodyResult.value);
  if (!email) {
    return jsonError("Valid email is required", 400);
  }

  const adminClient = dependencies.createAdminSupabaseClient
    ? dependencies.createAdminSupabaseClient()
    : createAdminClient();
  if (!adminClient) {
    return jsonError("Admin invite service is unavailable", 500);
  }

  const service = adminClient as AdminServiceClient;
  const redirectTo = buildInviteRedirectTo(request, dependencies);
  if (!redirectTo) {
    return jsonError("Admin invite service is unavailable", 500);
  }
  const inviteResult = await service.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  });
  const invited = inviteResult.data.user;
  if (inviteResult.error || !invited?.id) {
    return jsonError("Admin invite failed", 500);
  }

  const upsertResult = await service
    .from("profiles")
    .upsert(
      {
        id: invited.id,
        email,
        role: "admin",
      },
      { onConflict: "id" },
    );
  if (upsertResult.error) {
    return jsonError("Admin invite failed", 500);
  }

  return jsonResponse({
    success: true,
    data: {
      email,
      role: "admin",
    },
  });
}

async function guardAdminUsersRequest(
  dependencies: AdminUsersRouteDependencies,
): Promise<
  | { ok: true; supabase: AdminUsersSupabaseClient }
  | { ok: false; response: Response }
> {
  const createClient =
    dependencies.createServerSupabaseClient ?? defaultCreateServerSupabaseClient;
  const supabase = (await createClient()) as AdminUsersSupabaseClient;

  const userResult = await supabase.auth.getUser();
  if (userResult.error || !userResult.data.user) {
    return { ok: false, response: jsonError("Authentication required", 401) };
  }

  const profileQuery = supabase
    .from("profiles")
    .select("role")
    .eq("id", userResult.data.user.id);
  const profileResult = profileQuery.maybeSingle
    ? await profileQuery.maybeSingle()
    : { data: null, error: { message: "profile lookup unavailable" } };

  if (profileResult.error) {
    return { ok: false, response: jsonError("Admin profile lookup failed", 500) };
  }

  const role = asNonEmptyString(
    (profileResult.data as Record<string, unknown> | null)?.role,
  );
  if (role !== "admin") {
    return { ok: false, response: jsonError("Admin role required", 403) };
  }

  return { ok: true, supabase };
}

async function defaultCreateServerSupabaseClient(): Promise<unknown> {
  const server = await import("../supabase/server.ts");
  return server.createClient();
}

function sanitizeAdminProfile(row: AdminProfileRow) {
  const id = asNonEmptyString(row.id);
  const email = asNonEmptyString(row.email);
  const role = asNonEmptyString(row.role);
  const createdAt = asNonEmptyString(row.created_at);

  if (!id || !email || role !== "admin" || !createdAt) {
    return null;
  }

  return {
    id,
    email,
    role,
    createdAt,
  };
}

function parseInviteEmail(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("email" in body)) {
    return null;
  }

  const email = String(body.email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }

  return email;
}

function buildInviteRedirectTo(
  request: Request,
  dependencies: AdminUsersRouteDependencies,
): string | null {
  const configuredSiteUrl =
    dependencies.siteUrl === undefined ? process.env.SITE_URL : dependencies.siteUrl;
  if (
    (dependencies.nodeEnv ?? process.env.NODE_ENV) === "production" &&
    (!configuredSiteUrl || configuredSiteUrl.trim().length === 0)
  ) {
    return null;
  }

  const origin = trimTrailingSlash(
    configuredSiteUrl && configuredSiteUrl.trim().length > 0
      ? configuredSiteUrl
      : new URL(request.url).origin,
  );
  return `${origin}/auth/update-password?redirect=%2Fadmin`;
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function jsonError(error: string, status: number): Response {
  return jsonResponse({ success: false, error }, status);
}

function jsonResponse(payload: unknown, status = 200): Response {
  return Response.json(payload, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}
