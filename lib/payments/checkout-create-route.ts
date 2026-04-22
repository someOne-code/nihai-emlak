import {
  parseCheckoutCreateRequestBody,
  type CheckoutCreateRequestBody,
} from "./checkout-create.ts";
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

const CHECKOUT_CREATE_JSON_ROUTE_CONFIG: StateChangingJsonRouteConfig = {
  maxBodyBytes: 16 * 1024,
  routeLabel: "Checkout create",
};

export async function handleCheckoutCreatePost(
  request: Request,
  dependencies: CheckoutCreateRouteDependencies,
): Promise<Response> {
  const trustedRequestResult = validateStateChangingJsonRequestEnvelope(
    request,
    CHECKOUT_CREATE_JSON_ROUTE_CONFIG,
  );
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

async function readCheckoutCreateRequestBody(
  request: Request,
): Promise<
  | { ok: true; body: CheckoutCreateRequestBody }
  | { ok: false; status: number; error: string }
> {
  const payloadResult = await readStateChangingJsonRequestPayload(
    request,
    CHECKOUT_CREATE_JSON_ROUTE_CONFIG,
  );
  if (!payloadResult.ok) {
    return payloadResult;
  }

  return parseCheckoutCreateRequestBody(payloadResult.value);
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
