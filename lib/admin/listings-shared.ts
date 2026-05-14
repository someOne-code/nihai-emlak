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
  | "admin_configure_listing_service"
  // Phase 9B: global catalog management
  | "admin_list_main_item_catalog"
  | "admin_create_main_item_catalog"
  | "admin_update_main_item_catalog"
  | "admin_list_service_catalog"
  | "admin_create_service_catalog"
  | "admin_update_service_catalog";

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
  genericError: string = "İlan işlemi başarısız oldu",
): [string, number] {
  const code = asNonEmptyString(error.code);

  if (code === "28000") {
    return ["Oturum açmanız gerekiyor", 401];
  }

  if (code === "42501") {
    return ["Yönetici yetkisi gerekli", 403];
  }

  if (code === "P0002") {
    return [notFoundError, 404];
  }

  if (code === "23505") {
    return ["Bu URL adresi (slug) zaten kullanılıyor", 409];
  }

  if (code === "P0004") {
    return [translateP0004(asNonEmptyString(error.message)), 422];
  }

  if (code === "22023") {
    return ["Geçersiz ilan isteği", 400];
  }

  // 42883 = undefined_function: migration not applied to this database.
  if (code === "42883") {
    return [
      "Gerekli veritaban\u0131 fonksiyonu bulunamad\u0131. Migrasyonlar\u0131n uyguland\u0131\u011f\u0131ndan emin olun.",
      500,
    ];
  }

  return [genericError, 500];
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

const PUBLISH_MISSING_LABELS: Record<string, string> = {
  description: "Açıklama",
  district: "İlçe",
  image: "Görsel",
};

function translateP0004(raw: string | null): string {
  if (!raw) {
    return "İlan yayına alınamıyor";
  }

  if (raw === "checkout-not-ready") {
    return "Kiralık ilan için ana ödeme kalemi gerekli";
  }

  if (raw.startsWith("publish-guard:")) {
    const keys = raw.replace("publish-guard:", "").trim().split(/,\s*/);
    const labels = keys.map((k) => PUBLISH_MISSING_LABELS[k] ?? k);
    return `Yayına alınamıyor: eksik alanlar — ${labels.join(", ")}`;
  }

  return "İlan yayına alınamıyor";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
