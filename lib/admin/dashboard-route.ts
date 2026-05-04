import type { AdminDashboardSummaryDto } from "../admin-ui/dashboard-summary-view-model.ts";

type SupabaseError = {
  code?: string | null;
  message?: string | null;
};

type SupabaseMaybeSingleResponse = {
  data: unknown;
  error: SupabaseError | null;
};

type SupabaseRpcResponse = {
  data: unknown;
  error: SupabaseError | null;
};

type DashboardRpcName = "admin_dashboard_summary";

type SupabaseClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: SupabaseError | null;
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
    functionName: DashboardRpcName,
    args: Record<string, unknown>,
  ) => Promise<SupabaseRpcResponse>;
};

export type AdminDashboardRouteDependencies = {
  createServerSupabaseClient: () => Promise<unknown>;
};

export async function handleAdminDashboardSummaryGet(
  _request: Request,
  dependencies: AdminDashboardRouteDependencies,
): Promise<Response> {
  const guard = await guardAdminDashboardRequest(dependencies);
  if (!guard.ok) {
    return guard.response;
  }

  const rpcResult = await guard.supabase.rpc("admin_dashboard_summary", {});
  if (rpcResult.error) {
    return jsonError(...mapDashboardRpcError(rpcResult.error));
  }

  if (!isRecord(rpcResult.data)) {
    return jsonError("Admin dashboard summary is unavailable", 500);
  }

  return jsonSuccess(sanitizeDashboardSummary(rpcResult.data));
}

async function guardAdminDashboardRequest(
  dependencies: AdminDashboardRouteDependencies,
): Promise<
  | { ok: true; supabase: SupabaseClient }
  | { ok: false; response: Response }
> {
  const supabase = (await dependencies.createServerSupabaseClient()) as SupabaseClient;
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

function sanitizeDashboardSummary(value: Record<string, unknown>): AdminDashboardSummaryDto {
  return {
    listingTotal: readCount(value.listing_total),
    listingActive: readCount(value.listing_active),
    listingPassive: readCount(value.listing_passive),
    listingWithoutImages: readCount(value.listing_without_images),
    rentListingsNotCheckoutReady: readCount(value.rent_listings_not_checkout_ready),
    pendingReservations: readCount(value.pending_reservations),
    failedOrConflictPayments: readCount(value.failed_or_conflict_payments),
    manualResolutionRequired: readCount(value.manual_resolution_required),
    communicationItems: readCount(value.communication_items),
  };
}

function readCount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return Math.trunc(value);
}

function mapDashboardRpcError(error: SupabaseError): [string, number] {
  const code = asNonEmptyString(error.code);

  if (code === "28000") {
    return ["Authentication required", 401];
  }

  if (code === "42501") {
    return ["Admin role required", 403];
  }

  return ["Admin dashboard summary is unavailable", 500];
}

function jsonSuccess(data: AdminDashboardSummaryDto): Response {
  return jsonResponse(
    {
      success: true,
      data,
    },
    200,
  );
}

function jsonError(error: string, status: number): Response {
  return jsonResponse(
    {
      success: false,
      error,
    },
    status,
  );
}

function jsonResponse(payload: unknown, status: number): Response {
  return Response.json(payload, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return value.trim();
}
