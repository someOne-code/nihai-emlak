import {
  buildIsbankHostedCheckoutPayload,
  parseCheckoutInitRequestBody,
  resolveCheckoutInitReturnUrlsFromEnvironment,
  type CheckoutInitRequestBody,
} from "./checkout-init.ts";
import { buildCheckoutInitSuccessResponse } from "./checkout-init-response.ts";
import {
  readStateChangingJsonRequestPayload,
  validateStateChangingJsonRequestEnvelope,
  type StateChangingJsonRouteConfig,
} from "../http/state-changing-json-route.ts";

type SupabaseError = {
  code?: string | null;
  message?: string | null;
};

type SupabaseMaybeSingleResponse = {
  data: unknown;
  error: SupabaseError | null;
};

type SupabaseSingleResponse = {
  data: unknown;
  error: SupabaseError | null;
};

type SupabaseUpdateQueryBuilder = {
  eq: (column: string, value: string) => SupabaseUpdateQueryBuilder;
  select: (columns: string) => {
    single: () => Promise<SupabaseSingleResponse>;
    maybeSingle: () => Promise<SupabaseMaybeSingleResponse>;
  };
};

type SupabaseQueryBuilder = {
  eq: (column: string, value: string) => SupabaseQueryBuilder;
  order: (column: string, options: { ascending: boolean }) => SupabaseQueryBuilder;
  limit: (count: number) => SupabaseQueryBuilder;
  maybeSingle: () => Promise<SupabaseMaybeSingleResponse>;
};

type SupabaseClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: SupabaseError | null;
    }>;
  };
  from: (table: "orders" | "payments") => {
    select: (columns: string) => SupabaseQueryBuilder;
    update?: (values: Record<string, unknown>) => SupabaseUpdateQueryBuilder;
  };
};

type PaymentWriteClient = {
  from: (table: "payments") => {
    select: (columns: string) => SupabaseQueryBuilder;
    update?: (values: Record<string, unknown>) => SupabaseUpdateQueryBuilder;
  };
};

export type CheckoutInitRouteDependencies = {
  createServerSupabaseClient: () => Promise<unknown>;
  createServiceRoleSupabaseClient: () => Promise<unknown>;
  createRandomValue: () => string;
};

type OrderRow = {
  id: string;
  status: string;
  totalAmount: number;
  currency: string;
};

type PendingPaymentRow = {
  id: string;
  orderId: string;
  userId: string | null;
  amount: number;
  currency: string;
  providerRef: string;
};

const CHECKOUT_INIT_JSON_ROUTE_CONFIG: StateChangingJsonRouteConfig = {
  maxBodyBytes: 4 * 1024,
  routeLabel: "Checkout init",
};

type PaymentLifecycleStatus =
  | "pending"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "refunded"
  | "conflict";

type PaymentStatusRow = {
  status: PaymentLifecycleStatus;
};

export async function handleCheckoutInitPost(
  request: Request,
  dependencies: CheckoutInitRouteDependencies,
): Promise<Response> {
  const trustedRequestResult = validateStateChangingJsonRequestEnvelope(
    request,
    CHECKOUT_INIT_JSON_ROUTE_CONFIG,
  );
  if (!trustedRequestResult.ok) {
    return Response.json(
      {
        success: false,
        error: trustedRequestResult.error,
      },
      { status: trustedRequestResult.status },
    );
  }

  const bodyResult = await readCheckoutInitRequestBody(request);
  if (!bodyResult.ok) {
    return Response.json(
      {
        success: false,
        error: bodyResult.error,
      },
      { status: bodyResult.status },
    );
  }

  const supabase = (await dependencies.createServerSupabaseClient()) as SupabaseClient;
  const userResult = await supabase.auth.getUser();
  if (userResult.error || !userResult.data.user) {
    return Response.json(
      {
        success: false,
        error: "Authentication required",
      },
      { status: 401 },
    );
  }

  const userId = userResult.data.user.id;
  const clientId = process.env.ISBANK_CLIENT_ID;
  if (!clientId) {
    return Response.json(
      {
        success: false,
        error: "ISBANK_CLIENT_ID is not configured",
      },
      { status: 500 },
    );
  }
  const storeKey = process.env.ISBANK_STORE_KEY;
  if (!storeKey) {
    return Response.json(
      {
        success: false,
        error: "ISBANK_STORE_KEY is not configured",
      },
      { status: 500 },
    );
  }

  const returnUrlResult = resolveCheckoutInitReturnUrlsFromEnvironment({
    nodeEnv: process.env.NODE_ENV,
    preferredOrigin: request.headers.get("origin"),
    siteUrl: process.env.SITE_URL,
    publicSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    vercelUrl: process.env.VERCEL_URL,
  });
  if (!returnUrlResult.ok) {
    return Response.json(
      {
        success: false,
        error: returnUrlResult.error,
      },
      { status: returnUrlResult.status },
    );
  }

  const orderSelect = await supabase
    .from("orders")
    .select("id,user_id,total_amount,currency,status")
    .eq("id", bodyResult.body.orderId)
    .eq("user_id", userId)
    .maybeSingle();

  if (orderSelect.error) {
    return Response.json(
      {
        success: false,
        error: "Failed to resolve order for checkout init",
      },
      { status: 500 },
    );
  }

  const order = parseOrderRow(orderSelect.data);
  if (!order) {
    return Response.json(
      {
        success: false,
        error: "Order not found",
      },
      { status: 404 },
    );
  }

  if (order.status !== "pending") {
    return Response.json(
      {
        success: false,
        error: "Only pending orders can be initialized for payment",
      },
      { status: 409 },
    );
  }

  const existingPendingPaymentResult = await getExistingPendingIsbankPayment(
    supabase,
    order.id,
    userId,
  );
  if (!existingPendingPaymentResult.ok) {
    return Response.json(
      {
        success: false,
        error: existingPendingPaymentResult.error,
      },
      { status: existingPendingPaymentResult.status },
    );
  }

  let payment = existingPendingPaymentResult.payment;
  if (!payment) {
    return Response.json(
      {
        success: false,
        error: "Checkout init requires an existing pending payment",
      },
      { status: 409 },
    );
  }

  const reconciledPaymentResult = await reconcilePendingPaymentWithOrder(
    dependencies.createServiceRoleSupabaseClient,
    payment,
    order,
    userId,
  );
  if (!reconciledPaymentResult.ok) {
    return Response.json(
      {
        success: false,
        error: reconciledPaymentResult.error,
      },
      { status: reconciledPaymentResult.status },
    );
  }

  payment = reconciledPaymentResult.payment;

  if (payment.providerRef !== payment.id) {
    return Response.json(
      {
        success: false,
        error: "Payment OID contract violation: provider_ref must equal payment.id",
      },
      { status: 500 },
    );
  }

  const returnUrls = returnUrlResult.returnUrls;
  const isbankPayload = buildIsbankHostedCheckoutPayload({
    amount: payment.amount,
    clientId,
    currency: payment.currency,
    failUrl: returnUrls.failUrl,
    okUrl: returnUrls.okUrl,
    paymentId: payment.id,
    rnd: dependencies.createRandomValue(),
    storeKey,
  });

  return Response.json(
    buildCheckoutInitSuccessResponse({
      amount: payment.amount,
      currency: payment.currency,
      isbankPayload,
      orderId: payment.orderId,
      paymentId: payment.id,
      providerRef: payment.providerRef,
    }),
  );
}

async function getExistingPendingIsbankPayment(
  supabase: SupabaseClient,
  orderId: string,
  userId: string,
): Promise<
  | { ok: true; payment: PendingPaymentRow | null }
  | { ok: false; status: number; error: string }
> {
  const pendingPaymentSelect = await supabase
    .from("payments")
    .select("id,order_id,user_id,amount,currency,status,provider_ref")
    .eq("order_id", orderId)
    .eq("user_id", userId)
    .eq("provider", "isbank")
    .eq("status", "pending")
    .maybeSingle();

  if (pendingPaymentSelect.error) {
    if (isMultipleRowsSupabaseError(pendingPaymentSelect.error)) {
      return {
        ok: false,
        status: 409,
        error: "Checkout init found multiple pending payments for order",
      };
    }

    return {
      ok: false,
      status: 500,
      error: "Failed to resolve existing pending payment for checkout init",
    };
  }

  if (!pendingPaymentSelect.data) {
    return {
      ok: true,
      payment: null,
    };
  }

  const payment = parsePendingPaymentRow(pendingPaymentSelect.data);
  if (!payment) {
    return {
      ok: false,
      status: 500,
      error: "Invalid pending payment row returned from database",
    };
  }

  return {
    ok: true,
    payment,
  };
}

async function reconcilePendingPaymentWithOrder(
  createServiceRoleSupabaseClient: () => Promise<unknown>,
  payment: PendingPaymentRow,
  order: OrderRow,
  userId: string,
): Promise<
  | { ok: true; payment: PendingPaymentRow }
  | { ok: false; status: number; error: string }
> {
  if (payment.amount !== order.totalAmount || payment.currency !== order.currency) {
    return {
      ok: false,
      status: 409,
      error: "Pending payment no longer matches order total",
    };
  }

  const refreshedPaymentResult = await refreshPendingPaymentForCheckoutInit(
    createServiceRoleSupabaseClient,
    payment.id,
  );
  if (!refreshedPaymentResult.ok) {
    return refreshedPaymentResult;
  }

  if (
    refreshedPaymentResult.payment.orderId !== order.id
  ) {
    return {
      ok: false,
      status: 409,
      error: "Pending payment no longer belongs to order",
    };
  }

  if (
    refreshedPaymentResult.payment.userId !== null
    && refreshedPaymentResult.payment.userId !== userId
  ) {
    return {
      ok: false,
      status: 409,
      error: "Pending payment no longer belongs to user",
    };
  }

  if (
    refreshedPaymentResult.payment.amount !== order.totalAmount
    || refreshedPaymentResult.payment.currency !== order.currency
  ) {
    return {
      ok: false,
      status: 409,
      error: "Pending payment no longer matches order total",
    };
  }

  return refreshedPaymentResult;
}

async function refreshPendingPaymentForCheckoutInit(
  createServiceRoleSupabaseClient: () => Promise<unknown>,
  paymentId: string,
): Promise<
  | { ok: true; payment: PendingPaymentRow }
  | { ok: false; status: number; error: string }
> {
  let supabase: PaymentWriteClient;
  try {
    supabase = (await createServiceRoleSupabaseClient()) as PaymentWriteClient;
  } catch {
    return {
      ok: false,
      status: 500,
      error: "Failed to refresh pending payment for checkout init",
    };
  }

  const paymentSelect = await supabase
    .from("payments")
    .select("id,order_id,user_id,amount,currency,status,provider_ref")
    .eq("id", paymentId)
    .eq("status", "pending")
    .maybeSingle();

  if (paymentSelect.error) {
    return {
      ok: false,
      status: 500,
      error: "Failed to refresh pending payment for checkout init",
    };
  }

  if (!paymentSelect.data) {
    const currentPaymentResult = await getPaymentStatusForCheckoutInit(
      supabase,
      paymentId,
    );
    if (!currentPaymentResult.ok) {
      return currentPaymentResult;
    }

    if (currentPaymentResult.payment.status !== "pending") {
      return {
        ok: false,
        status: 409,
        error: "Payment is no longer pending for checkout init",
      };
    }

    return {
      ok: false,
      status: 500,
      error: "Failed to refresh pending payment for checkout init",
    };
  }

  const refreshedPayment = parsePendingPaymentRow(paymentSelect.data);
  if (!refreshedPayment) {
    return {
      ok: false,
      status: 500,
      error: "Invalid pending payment row returned from database",
    };
  }

  return {
    ok: true,
    payment: refreshedPayment,
  };
}

async function getPaymentStatusForCheckoutInit(
  supabase: PaymentWriteClient,
  paymentId: string,
): Promise<
  | { ok: true; payment: PaymentStatusRow }
  | { ok: false; status: number; error: string }
> {
  const paymentSelect = await supabase
    .from("payments")
    .select("status")
    .eq("id", paymentId)
    .maybeSingle();

  if (paymentSelect.error) {
    return {
      ok: false,
      status: 500,
      error: "Failed to resolve payment state for checkout init",
    };
  }

  const payment = parsePaymentStatusRow(paymentSelect.data);
  if (!payment) {
    return {
      ok: false,
      status: 500,
      error: "Failed to resolve payment state for checkout init",
    };
  }

  return {
    ok: true,
    payment,
  };
}

async function readCheckoutInitRequestBody(
  request: Request,
): Promise<
  | { ok: true; body: CheckoutInitRequestBody }
  | { ok: false; status: number; error: string }
> {
  const payloadResult = await readStateChangingJsonRequestPayload(
    request,
    CHECKOUT_INIT_JSON_ROUTE_CONFIG,
  );
  if (!payloadResult.ok) {
    return payloadResult;
  }

  return parseCheckoutInitRequestBody(payloadResult.value);
}

function parseOrderRow(value: unknown): OrderRow | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;
  const id = asUuid(row.id);
  const status = asNonEmptyString(row.status);
  const currency = asCurrency(row.currency);
  const totalAmount = asAmount(row.total_amount);

  if (!id || !status || !currency || totalAmount === null) {
    return null;
  }

  return {
    id,
    status,
    totalAmount,
    currency,
  };
}

function parsePendingPaymentRow(value: unknown): PendingPaymentRow | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;
  const id = asUuid(row.id);
  const orderId = asUuid(row.order_id);
  const userId = row.user_id === undefined ? null : asUuid(row.user_id);
  const amount = asAmount(row.amount);
  const currency = asCurrency(row.currency);
  const status = asNonEmptyString(row.status);
  const providerRef = asNonEmptyString(row.provider_ref);

  if (
    !id
    || !orderId
    || (row.user_id !== undefined && !userId)
    || amount === null
    || !currency
    || !providerRef
    || status !== "pending"
  ) {
    return null;
  }

  return {
    id,
    orderId,
    userId,
    amount,
    currency,
    providerRef,
  };
}

function parsePaymentStatusRow(value: unknown): PaymentStatusRow | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;
  const status = asPaymentLifecycleStatus(row.status);
  if (!status) {
    return null;
  }

  return { status };
}

function asAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
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

  return normalized;
}

function isMultipleRowsSupabaseError(error: SupabaseError | null): boolean {
  if (!error) {
    return false;
  }

  if (error.code === "PGRST116") {
    return true;
  }

  return error.message?.toLowerCase().includes("multiple rows") ?? false;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return value.trim();
}

function asPaymentLifecycleStatus(value: unknown): PaymentLifecycleStatus | null {
  const normalized = asNonEmptyString(value);
  if (
    normalized !== "pending"
    && normalized !== "succeeded"
    && normalized !== "failed"
    && normalized !== "cancelled"
    && normalized !== "refunded"
    && normalized !== "conflict"
  ) {
    return null;
  }

  return normalized;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
