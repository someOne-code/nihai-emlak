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

type SnapshotRpcName =
  | "get_admin_reservation_workflow_snapshot"
  | "get_admin_listing_workflow_snapshot";

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
    functionName: SnapshotRpcName,
    args: Record<string, unknown>,
  ) => Promise<SupabaseRpcResponse>;
};

export type AdminWorkflowSnapshotRouteDependencies = {
  createServerSupabaseClient: () => Promise<unknown>;
};

export async function handleAdminReservationWorkflowSnapshotGet(
  _request: Request,
  dependencies: AdminWorkflowSnapshotRouteDependencies,
  params: { reservationId: string },
): Promise<Response> {
  const guard = await guardAdminWorkflowSnapshotRequest(dependencies);
  if (!guard.ok) {
    return guard.response;
  }

  const reservationId = asUuid(params.reservationId);
  if (!reservationId) {
    return jsonError("Invalid reservation id", 400);
  }

  const rpcResult = await guard.supabase.rpc("get_admin_reservation_workflow_snapshot", {
    p_reservation_id: reservationId,
  });
  if (rpcResult.error) {
    return jsonError(...mapAdminWorkflowSnapshotRpcError(rpcResult.error, "Reservation not found"));
  }

  if (!isRecord(rpcResult.data)) {
    return jsonError("Invalid admin workflow snapshot RPC response", 500);
  }

  return jsonSuccess(rpcResult.data);
}

export async function handleAdminListingWorkflowSnapshotGet(
  _request: Request,
  dependencies: AdminWorkflowSnapshotRouteDependencies,
  params: { listingId: string },
): Promise<Response> {
  const guard = await guardAdminWorkflowSnapshotRequest(dependencies);
  if (!guard.ok) {
    return guard.response;
  }

  const listingId = asUuid(params.listingId);
  if (!listingId) {
    return jsonError("Invalid listing id", 400);
  }

  const rpcResult = await guard.supabase.rpc("get_admin_listing_workflow_snapshot", {
    p_listing_id: listingId,
  });
  if (rpcResult.error) {
    return jsonError(...mapAdminWorkflowSnapshotRpcError(rpcResult.error, "Listing not found"));
  }

  if (!isRecord(rpcResult.data)) {
    return jsonError("Invalid admin workflow snapshot RPC response", 500);
  }

  return jsonSuccess(rpcResult.data);
}

async function guardAdminWorkflowSnapshotRequest(
  dependencies: AdminWorkflowSnapshotRouteDependencies,
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

function mapAdminWorkflowSnapshotRpcError(
  error: SupabaseError,
  notFoundError: string,
): [string, number] {
  const code = asNonEmptyString(error.code);

  if (code === "28000") {
    return ["Authentication required", 401];
  }

  if (code === "42501") {
    return ["Admin role required", 403];
  }

  if (code === "22023") {
    return ["Invalid admin workflow request", 400];
  }

  if (code === "P0002") {
    return [notFoundError, 404];
  }

  if (code === "P0004") {
    return ["Admin workflow invariant violation", 500];
  }

  return ["Admin workflow snapshot RPC failed", 500];
}

function jsonSuccess(data: unknown): Response {
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

function asUuid(value: unknown): string | null {
  const normalized = asNonEmptyString(value);
  if (!normalized || !isUuid(normalized)) {
    return null;
  }

  return normalized.toLowerCase();
}

function asNonEmptyString(value: unknown): string | null {
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
