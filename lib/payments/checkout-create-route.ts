import {
  parseCheckoutCreateRequestBody,
  type CheckoutCreateRequestBody,
} from "./checkout-create.ts";

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
    functionName: "create_checkout",
    args: Record<string, unknown>,
  ) => Promise<SupabaseRpcResponse>;
};

export type CheckoutCreateRouteDependencies = {
  createServerSupabaseClient: () => Promise<unknown>;
};

type CheckoutCreateRpcSummary = {
  currency: string;
  listingId: string;
  orderId: string;
  paymentId: string;
  reservationId: string;
  totalAmount: number;
};

const MAX_CHECKOUT_CREATE_BODY_BYTES = 16 * 1024;

export async function handleCheckoutCreatePost(
  request: Request,
  dependencies: CheckoutCreateRouteDependencies,
): Promise<Response> {
  const trustedRequestResult = validateCheckoutCreateRequestEnvelope(request);
  if (!trustedRequestResult.ok) {
    return jsonError(trustedRequestResult.error, trustedRequestResult.status);
  }

  const bodyResult = await readCheckoutCreateRequestBody(request);
  if (!bodyResult.ok) {
    return jsonError(bodyResult.error, bodyResult.status);
  }

  const supabase = (await dependencies.createServerSupabaseClient()) as SupabaseClient;
  const userResult = await supabase.auth.getUser();
  if (userResult.error || !userResult.data.user) {
    return jsonError("Authentication required", 401);
  }

  const checkoutCreateResult = await supabase.rpc(
    "create_checkout",
    buildCreateCheckoutRpcArgs(bodyResult.body),
  );

  if (checkoutCreateResult.error) {
    const mappedError = mapCheckoutCreateRpcError(checkoutCreateResult.error);
    return jsonError(mappedError.error, mappedError.status);
  }

  const summary = parseCheckoutCreateRpcSummary(checkoutCreateResult.data);
  if (!summary) {
    return jsonError("Invalid checkout create RPC response", 500);
  }

  return jsonResponse(
    {
      success: true,
      data: {
        reservation: {
          id: summary.reservationId,
        },
        order: {
          id: summary.orderId,
          totalAmount: summary.totalAmount,
          currency: summary.currency,
        },
        payment: {
          id: summary.paymentId,
          status: "pending",
        },
        listing: {
          id: summary.listingId,
        },
      },
    },
    201,
  );
}

function validateCheckoutCreateRequestEnvelope(
  request: Request,
): { ok: true } | { ok: false; status: number; error: string } {
  if (!isJsonContentType(request.headers.get("content-type"))) {
    return {
      ok: false,
      status: 415,
      error: "Checkout create requires application/json",
    };
  }

  const trustedOriginsResult = resolveTrustedCheckoutOriginsFromEnvironment();
  if (!trustedOriginsResult.ok) {
    return trustedOriginsResult;
  }

  const originHeader = request.headers.get("origin");
  if (!originHeader || originHeader.trim().length === 0) {
    return {
      ok: false,
      status: 403,
      error: "Checkout create Origin header is required",
    };
  }

  const requestOrigin = normalizeHttpOrigin(originHeader);
  if (!requestOrigin) {
    return {
      ok: false,
      status: 403,
      error: "Checkout create Origin is not trusted",
    };
  }

  if (!trustedOriginsResult.origins.includes(requestOrigin)) {
    return {
      ok: false,
      status: 403,
      error: "Checkout create Origin is not trusted",
    };
  }

  return { ok: true };
}

function resolveTrustedCheckoutOriginsFromEnvironment():
  | { ok: true; origins: string[] }
  | { ok: false; status: number; error: string } {
  const nodeEnv = typeof process.env.NODE_ENV === "string" ? process.env.NODE_ENV.toLowerCase() : "";
  const isNonDevEnvironment = nodeEnv !== "development" && nodeEnv !== "test";
  const configuredOrigins = [
    asNonEmptyString(process.env.SITE_URL),
    asNonEmptyString(process.env.NEXT_PUBLIC_SITE_URL),
    normalizeVercelUrl(process.env.VERCEL_URL),
  ].filter((value): value is string => value !== null);

  if (configuredOrigins.length === 0) {
    if (isNonDevEnvironment) {
      return {
        ok: false,
        status: 500,
        error: "SITE_URL or NEXT_PUBLIC_SITE_URL must be configured outside development/test",
      };
    }

    return {
      ok: true,
      origins: ["http://localhost:3000"],
    };
  }

  const trustedOrigins: string[] = [];
  for (const configuredOrigin of configuredOrigins) {
    const normalizedOrigin = normalizeHttpOrigin(configuredOrigin);
    if (!normalizedOrigin) {
      return {
        ok: false,
        status: 500,
        error: "Checkout trusted origin configuration is invalid",
      };
    }

    if (!trustedOrigins.includes(normalizedOrigin)) {
      trustedOrigins.push(normalizedOrigin);
    }
  }

  return {
    ok: true,
    origins: trustedOrigins,
  };
}

async function readCheckoutCreateRequestBody(
  request: Request,
): Promise<
  | { ok: true; body: CheckoutCreateRequestBody }
  | { ok: false; status: number; error: string }
> {
  const rawBodyResult = await readCheckoutCreateRawBody(request);
  if (!rawBodyResult.ok) {
    return rawBodyResult;
  }

  try {
    const payload = JSON.parse(rawBodyResult.rawBody) as unknown;
    return parseCheckoutCreateRequestBody(payload);
  } catch {
    return {
      ok: false,
      status: 400,
      error: "Invalid JSON request body",
    };
  }
}

async function readCheckoutCreateRawBody(
  request: Request,
): Promise<
  | { ok: true; rawBody: string }
  | { ok: false; status: number; error: string }
> {
  if (!request.body) {
    return {
      ok: true,
      rawBody: "",
    };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  try {
    while (true) {
      const readResult = await reader.read();
      if (readResult.done) {
        break;
      }

      byteLength += readResult.value.byteLength;
      if (byteLength > MAX_CHECKOUT_CREATE_BODY_BYTES) {
        await reader.cancel();
        return {
          ok: false,
          status: 413,
          error: "Checkout create payload is too large",
        };
      }

      chunks.push(readResult.value);
    }
  } catch {
    return {
      ok: false,
      status: 400,
      error: "Invalid JSON request body",
    };
  } finally {
    reader.releaseLock();
  }

  return {
    ok: true,
    rawBody: new TextDecoder().decode(concatUint8Arrays(chunks, byteLength)),
  };
}

function buildCreateCheckoutRpcArgs(body: CheckoutCreateRequestBody): Record<string, unknown> {
  return {
    p_listing_id: body.listingId,
    p_move_in_date: body.moveInDate,
    p_stay_months: body.stayMonths,
    p_guest_count: body.guestCount,
    p_main_item_codes: body.mainItems,
    p_service_item_codes: body.serviceItems,
    p_note: body.note,
  };
}

function mapCheckoutCreateRpcError(error: SupabaseError): { status: number; error: string } {
  const code = asNonEmptyString(error.code);
  const message = asNonEmptyString(error.message)?.toLowerCase() ?? "";

  if (code === "28000") {
    return {
      status: 401,
      error: "Authentication required",
    };
  }

  if (code === "P0002" || message.includes("listing is not available for checkout")) {
    return {
      status: 409,
      error: "Listing is not available for checkout",
    };
  }

  if (message.includes("listing does not have any enabled main checkout items")) {
    return {
      status: 409,
      error: "Listing does not have any enabled main checkout items",
    };
  }

  if (code === "P0001") {
    return {
      status: 400,
      error: "Checkout item selection is not valid for this listing",
    };
  }

  if (code === "22023") {
    return {
      status: 400,
      error: "Invalid checkout create request",
    };
  }

  return {
    status: 500,
    error: "Checkout create RPC failed",
  };
}

function parseCheckoutCreateRpcSummary(value: unknown): CheckoutCreateRpcSummary | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;
  const result = asNonEmptyString(row.result);
  const reservationId = asUuid(row.reservation_id);
  const orderId = asUuid(row.order_id);
  const paymentId = asUuid(row.payment_id);
  const listingId = asUuid(row.listing_id);
  const totalAmount = asAmount(row.total_amount);
  const currency = asCurrency(row.currency);
  const paymentStatus = asNonEmptyString(row.payment_status);

  if (
    result !== "created"
    || !reservationId
    || !orderId
    || !paymentId
    || !listingId
    || totalAmount === null
    || !currency
    || paymentStatus !== "pending"
  ) {
    return null;
  }

  return {
    currency,
    listingId,
    orderId,
    paymentId,
    reservationId,
    totalAmount,
  };
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

function concatUint8Arrays(chunks: Uint8Array[], byteLength: number): Uint8Array {
  const combined = new Uint8Array(byteLength);
  let offset = 0;

  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return combined;
}

function isJsonContentType(value: string | null): boolean {
  return value?.toLowerCase().split(";")[0]?.trim() === "application/json";
}

function normalizeHttpOrigin(value: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  if (parsed.username || parsed.password) {
    return null;
  }

  return parsed.origin;
}

function normalizeVercelUrl(value: string | null | undefined): string | null {
  const normalized = asNonEmptyString(value);
  if (!normalized) {
    return null;
  }

  return normalized.includes("://") ? normalized : `https://${normalized}`;
}

function asAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return null;
}

function asCurrency(value: unknown): string | null {
  const normalized = asNonEmptyString(value);
  if (!normalized || normalized.length !== 3) {
    return null;
  }

  return normalized.toUpperCase();
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
