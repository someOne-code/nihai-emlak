type SupabaseError = {
  code?: string | null;
  message?: string | null;
};

type SupabaseMaybeSingleResponse = {
  data: unknown;
  error: SupabaseError | null;
};

type SupabaseCountResponse = {
  count: number | null;
  data: unknown;
  error: SupabaseError | null;
};

type SupabaseQueryBuilder = {
  eq: (column: string, value: unknown) => SupabaseQueryBuilder;
  neq: (column: string, value: unknown) => SupabaseQueryBuilder;
  is: (column: string, value: unknown) => SupabaseQueryBuilder;
  not: (column: string, operator: string, value: unknown) => SupabaseQueryBuilder;
  in: (column: string, values: unknown[]) => SupabaseQueryBuilder;
  maybeSingle: () => Promise<SupabaseMaybeSingleResponse>;
  then: PromiseLike<SupabaseCountResponse>["then"];
};

type SupabaseClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: SupabaseError | null;
    }>;
  };
  from: (table: string) => {
    select: (columns: string, options?: { count?: "exact"; head?: boolean }) => SupabaseQueryBuilder;
  };
};

export type ReadModelRouteDependencies = {
  createServerSupabaseClient: () => Promise<unknown>;
};

export async function handleAdminDashboardSummaryGet(
  _request: Request,
  dependencies: ReadModelRouteDependencies,
): Promise<Response> {
  const supabase = (await dependencies.createServerSupabaseClient()) as SupabaseClient;

  // Auth guard
  const userResult = await supabase.auth.getUser();
  if (userResult.error || !userResult.data.user) {
    return jsonError("Authentication required", 401);
  }

  const profileResult = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userResult.data.user.id)
    .maybeSingle();

  if (profileResult.error) {
    return jsonError("Admin profile lookup failed", 500);
  }

  const role = asNonEmptyString((profileResult.data as Record<string, unknown> | null)?.role ?? null);
  if (role !== "admin") {
    return jsonError("Admin role required", 403);
  }

  // Aggregate queries — each metric is fetched independently so a failure
  // in one does not leak into the others and the route can safely return
  // null for unavailable metrics instead of faking numbers.
  const listingTotal = await safeCount(supabase.from("listings").select("*", { count: "exact", head: true }));
  const listingActive = await safeCount(supabase.from("listings").select("*", { count: "exact", head: true }).eq("status", "active"));
  const listingPassive = await safeCount(supabase.from("listings").select("*", { count: "exact", head: true }).eq("status", "passive"));

  // Listings without images — Supabase count with outer join is unreliable,
  // so we fetch the id list and count in memory.  This is acceptable for
  // admin dashboard aggregate traffic.
  const listingWithoutImages = await safeCountWithoutImages(supabase);

  // Rent listings not checkout ready: rent listings that have no enabled
  // main-item option linked to an active main-item-catalog entry.
  const rentListingsNotCheckoutReady = await safeCountRentNotCheckoutReady(supabase);

  const pendingReservations = await safeCount(
    supabase.from("reservations").select("*", { count: "exact", head: true }).eq("status", "pending"),
  );

  const failedOrConflictPayments = await safeCount(
    supabase
      .from("payments")
      .select("*", { count: "exact", head: true })
      .not("status", "in", "(succeeded,pending,cancelled,refunded)"),
  );

  // Manual resolution required: orders stuck in conflict status.
  const manualResolutionRequired = await safeCount(
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "conflict"),
  );

  // Communication/leads: no backend read model exists yet; return null.
  const communicationItems: number | null = null;

  return jsonSuccess({
    listingTotal,
    listingActive,
    listingPassive,
    listingWithoutImages,
    rentListingsNotCheckoutReady,
    pendingReservations,
    failedOrConflictPayments,
    manualResolutionRequired,
    communicationItems,
  });
}

async function safeCount(queryPromise: PromiseLike<SupabaseCountResponse>): Promise<number | null> {
  try {
    const result = await queryPromise;
    if (result.error) {
      return null;
    }
    if (typeof result.count === "number") {
      return result.count;
    }
    return null;
  } catch {
    return null;
  }
}

async function safeCountWithoutImages(supabase: SupabaseClient): Promise<number | null> {
  try {
    // Fetch listing IDs that do NOT have any image rows.
    // We request the listing id together with a left-joined image id,
    // then filter where the image id is null.
    const response = await supabase
      .from("listings")
      .select("id, listing_images!left(id)")
      .is("listing_images.id", null);

    if (response.error) {
      return null;
    }

    if (Array.isArray(response.data)) {
      return response.data.length;
    }

    return null;
  } catch {
    return null;
  }
}

async function safeCountRentNotCheckoutReady(supabase: SupabaseClient): Promise<number | null> {
  try {
    // Step 1: get rent listing ids that DO have at least one enabled
    // main-item option.
    const enabledResponse = await supabase
      .from("listing_main_item_options")
      .select("listing_id")
      .eq("is_enabled", true);

    if (enabledResponse.error) {
      return null;
    }

    const enabledIds = Array.isArray(enabledResponse.data)
      ? enabledResponse.data.map((row: unknown) => (row as Record<string, unknown>).listing_id).filter((id): id is string => typeof id === "string")
      : [];

    // Step 2: count rent listings whose id is NOT in that set.
    const allRentResponse = await supabase
      .from("listings")
      .select("*", { count: "exact", head: true })
      .eq("type", "rent");

    if (allRentResponse.error || typeof allRentResponse.count !== "number") {
      return null;
    }

    // Edge case: every rent listing has an enabled option.
    if (enabledIds.length === 0) {
      return allRentResponse.count;
    }

    const readyResponse = await supabase
      .from("listings")
      .select("*", { count: "exact", head: true })
      .eq("type", "rent")
      .in("id", enabledIds);

    if (readyResponse.error || typeof readyResponse.count !== "number") {
      return null;
    }

    return allRentResponse.count - readyResponse.count;
  } catch {
    return null;
  }
}

function jsonSuccess(data: unknown): Response {
  return Response.json({ success: true, data }, { status: 200, headers: { "cache-control": "no-store" } });
}

function jsonError(error: string, status: number): Response {
  return Response.json({ success: false, error }, { status, headers: { "cache-control": "no-store" } });
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  return value.trim();
}
