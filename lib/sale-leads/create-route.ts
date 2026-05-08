import {
  readStateChangingJsonRequestPayload,
  validateStateChangingJsonRequestEnvelope,
  type StateChangingJsonRouteConfig,
} from "../http/state-changing-json-route.ts";

type SupabaseError = {
  code?: string | null;
  message?: string | null;
};

type SupabaseRpcResponse = {
  data: unknown;
  error: SupabaseError | null;
};

type SupabaseClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: SupabaseError | null;
    }>;
  };
  rpc: (
    functionName: "create_sale_lead",
    args: Record<string, unknown>,
  ) => Promise<SupabaseRpcResponse>;
};

export type SaleLeadCreateRouteDependencies = {
  createServerSupabaseClient: () => Promise<unknown>;
};

const POST_ROUTE_CONFIG: StateChangingJsonRouteConfig = {
  maxBodyBytes: 8 * 1024,
  routeLabel: "Sale lead create",
};

export async function handleSaleLeadCreatePost(
  request: Request,
  dependencies: SaleLeadCreateRouteDependencies,
): Promise<Response> {
  const envelopeResult = validateStateChangingJsonRequestEnvelope(
    request,
    POST_ROUTE_CONFIG,
  );
  if (!envelopeResult.ok) {
    return jsonError(envelopeResult.error, envelopeResult.status);
  }

  const payloadResult = await readStateChangingJsonRequestPayload(
    request,
    POST_ROUTE_CONFIG,
  );
  if (!payloadResult.ok) {
    return jsonError(payloadResult.error, payloadResult.status);
  }

  const parsedPayload = parseCreateSaleLeadPayload(payloadResult.value);
  if (!parsedPayload.ok) {
    return jsonError(parsedPayload.error, 400);
  }

  const supabase = (await dependencies.createServerSupabaseClient()) as SupabaseClient;
  const userResult = await supabase.auth.getUser();
  if (userResult.error || !userResult.data.user) {
    return jsonError("Authentication required", 401);
  }

  const rpcResult = await supabase.rpc("create_sale_lead", parsedPayload.args);
  if (rpcResult.error) {
    const mapped = mapCreateSaleLeadRpcError(rpcResult.error);
    return jsonError(mapped.error, mapped.status);
  }

  const summary = parseCreateSaleLeadRpcResult(rpcResult.data);
  if (!summary) {
    return jsonError("Invalid sale lead create RPC response", 500);
  }

  return jsonResponse(
    {
      success: true,
      data: {
        lead: {
          id: summary.leadId,
          listingId: summary.listingId,
          status: summary.status,
        },
      },
    },
    201,
  );
}

function parseCreateSaleLeadPayload(
  value: unknown,
): { ok: true; args: Record<string, unknown> } | { ok: false; error: string } {
  if (!isRecord(value)) {
    return { ok: false, error: "Sale lead payload must be an object" };
  }

  const listingId = asUuid(value.listing_id);
  if (!listingId) {
    return { ok: false, error: "listing_id must be a valid UUID" };
  }

  const contactName = normalizeBoundedText(value.contact_name, 2, 120);
  if (!contactName) {
    return { ok: false, error: "contact_name must be between 2 and 120 characters" };
  }

  const message = normalizeBoundedText(value.message, 5, 2000);
  if (!message) {
    return { ok: false, error: "message must be between 5 and 2000 characters" };
  }

  const contactEmail = normalizeOptionalEmail(value.contact_email);
  if (contactEmail === false) {
    return { ok: false, error: "contact_email must be a valid email address" };
  }

  const contactPhone = normalizeOptionalText(value.contact_phone, 40);

  return {
    ok: true,
    args: {
      p_listing_id: listingId,
      p_contact_name: contactName,
      p_contact_email: contactEmail,
      p_contact_phone: contactPhone,
      p_message: message,
    },
  };
}

function mapCreateSaleLeadRpcError(error: SupabaseError): { status: number; error: string } {
  const code = asNonEmptyString(error.code);
  const message = asNonEmptyString(error.message)?.toLowerCase() ?? "";

  if (code === "28000") {
    return { status: 401, error: "Authentication required" };
  }
  if (code === "P0001" || message.includes("listing is not sale")) {
    return { status: 409, error: "Sale leads are only available for sale listings" };
  }
  if (code === "P0002") {
    return { status: 404, error: "Listing not found" };
  }
  if (code === "22023") {
    return { status: 400, error: "Invalid sale lead create request" };
  }

  return { status: 500, error: "Sale lead create RPC failed" };
}

function parseCreateSaleLeadRpcResult(
  value: unknown,
): { leadId: string; listingId: string; status: string } | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!isRecord(row)) {
    return null;
  }

  const result = asNonEmptyString(row.result);
  const leadId = asUuid(row.lead_id);
  const listingId = asUuid(row.listing_id);
  const status = asNonEmptyString(row.status);

  if (result !== "created" || !leadId || !listingId || status !== "new") {
    return null;
  }

  return { leadId, listingId, status };
}

function jsonError(error: string, status: number): Response {
  return jsonResponse({ success: false, error }, status);
}

function jsonResponse(payload: unknown, status: number): Response {
  return Response.json(payload, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function normalizeBoundedText(value: unknown, min: number, max: number): string | null {
  const normalized = asNonEmptyString(value);
  if (!normalized || normalized.length < min || normalized.length > max) {
    return null;
  }
  return normalized;
}

function normalizeOptionalEmail(value: unknown): string | null | false {
  const normalized = normalizeOptionalText(value, 254);
  if (!normalized) {
    return null;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return false;
  }
  return normalized.toLowerCase();
}

function normalizeOptionalText(value: unknown, max: number): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= max ? normalized : null;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
