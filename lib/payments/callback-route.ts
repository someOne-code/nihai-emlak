import type { SupabaseClientOptions } from "@supabase/supabase-js";

import {
  buildIsbankHostedPaymentCallbackKey,
  extractExplicitPaymentIdFromCallback,
  extractPaymentCallbackReference,
  extractPaymentIdHintFromCallback,
  getSupportedPaymentCallbackContentType,
  parsePaymentCallbackPayload,
  readPaymentCallbackRawRequestBody,
  sha256Upper,
} from "./callback.ts";
import {
  buildIsbankSha1Input,
  extractProvidedHash,
  findCaseInsensitiveValue,
  getSha1HexLength,
  hasRequiredIsbankFields,
  isValidSha1Hex,
  normalizePaymentPayload,
  safeCompareHash,
  sha1Upper,
  type LooseRecord,
} from "./isbank.ts";

type CreateSupabaseClient = (
  url: string,
  key: string,
  options: SupabaseClientOptions<"public">,
) => unknown;

export type PaymentCallbackRouteDependencies = {
  createSupabaseClient: CreateSupabaseClient;
  sendInngestEvent: (event: {
    name: string;
    data: Record<string, unknown>;
  }) => Promise<unknown>;
};

type RegisterCallbackReceiptInput = {
  provider: string;
  eventKey: string;
  payloadHash: string;
  contentType: string;
};

type CheckoutResultKind = "succeeded" | "idempotent" | "conflict" | "failed";
type CallbackContractRejection = {
  paymentId: string;
  reason: string;
  violations: string[];
};
type ProcessPaymentResult =
  | { ok: true; result: CheckoutResultKind; paymentId: string }
  | {
      ok: false;
      status: number;
      error: string;
      processingErrorCode?: string | null;
      processingErrorMessage?: string | null;
      callbackContractRejection?: CallbackContractRejection;
    };
type ResolvePaymentIdResult =
  | { ok: true; paymentId: string }
  | { ok: false; status: number; error: string };
type PreparedPaymentCallbackResult =
  | {
      ok: true;
      callbackStatus: "approved" | "failed";
      eventPayload: LooseRecord;
      paymentId: string;
      providerRef: string | null;
      supabase: CallbackSupabaseClient;
    }
  | {
      ok: false;
      status: number;
      error: string;
      callbackContractRejection?: CallbackContractRejection;
    };
type PaymentSnapshotResult =
  | { ok: true; payment: PaymentContractSnapshot }
  | { ok: false; status: number; error: string };
type SupabaseClientError = { code?: string; message: string };
type SupabaseRpcResponse = { data: unknown; error: SupabaseClientError | null };
type PaymentLookupResponse = {
  data: Record<string, unknown> | null;
  error: SupabaseClientError | null;
};
type PaymentLookupQuery = {
  eq: (column: string, value: string) => PaymentLookupQuery;
  order: (
    column: string,
    options: { ascending: boolean },
  ) => PaymentLookupQuery;
  limit: (count: number) => PaymentLookupQuery;
  maybeSingle: () => Promise<PaymentLookupResponse>;
};
type CallbackReceiptLookupQuery = {
  eq: (column: string, value: string) => CallbackReceiptLookupQuery;
  maybeSingle: () => Promise<PaymentLookupResponse>;
};
type CallbackReceiptDeleteQuery = {
  eq: (column: string, value: string) => {
    eq: (
      nestedColumn: string,
      nestedValue: string,
    ) => Promise<{ error: SupabaseClientError | null }>;
  };
};
type CallbackSupabaseClient = {
  rpc: (functionName: string, args?: Record<string, unknown>) => Promise<SupabaseRpcResponse>;
  from: {
    (table: "payments"): {
      select: (columns: string) => PaymentLookupQuery;
    };
    (table: "payment_callback_receipts"): {
      select: (columns: string) => CallbackReceiptLookupQuery;
      delete: () => CallbackReceiptDeleteQuery;
    };
    (table: "payment_events"): {
      insert: (row: Record<string, unknown>) => Promise<{ error: SupabaseClientError | null }>;
    };
  };
};
type PaymentContractSnapshot = {
  amount: number;
  currency: string;
  id: string;
  provider: string;
  providerRef: string | null;
  status: PaymentStatus;
};
type PaymentStatus =
  | "pending"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "refunded"
  | "conflict";

export async function handlePaymentCallbackPost(
  request: Request,
  dependencies: PaymentCallbackRouteDependencies,
): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";
  const headerHash = request.headers.get("x-isbank-hash");
  const supportedContentType = getSupportedPaymentCallbackContentType(contentType);

  if (!supportedContentType) {
    return Response.json(
      {
        success: false,
        error: "Unsupported callback content type",
      },
      { status: 415 },
    );
  }

  const rawBodyResult = await readPaymentCallbackRawRequestBody(request);
  if (!rawBodyResult.ok) {
    return Response.json(
      {
        success: false,
        error: rawBodyResult.error,
      },
      { status: rawBodyResult.status },
    );
  }

  const payloadResult = parsePaymentCallbackPayload(
    rawBodyResult.rawBody,
    supportedContentType,
  );
  if (!payloadResult.ok) {
    return Response.json(
      {
        success: false,
        error: payloadResult.error,
      },
      { status: payloadResult.status },
    );
  }

  const payload = normalizePaymentPayload(payloadResult.payload);

  const storeKey = process.env.ISBANK_STORE_KEY;
  if (!storeKey) {
    return Response.json(
      {
        success: false,
        error: "Server payment verification key is not configured",
      },
      { status: 500 },
    );
  }

  if (!hasRequiredIsbankFields(payload)) {
    return Response.json(
      {
        success: false,
        error: "Missing required callback fields",
      },
      { status: 400 },
    );
  }

  const providedHash = extractProvidedHash(payload, headerHash);
  if (!providedHash || !isValidSha1Hex(providedHash)) {
    return Response.json(
      {
        success: false,
        error: `Invalid hash format. Expected ${getSha1HexLength()} hex chars`,
      },
      { status: 400 },
    );
  }

  const calculatedHash = sha1Upper(buildIsbankSha1Input(payload, storeKey));
  const verified = safeCompareHash(providedHash, calculatedHash);

  if (!verified) {
    await dependencies.sendInngestEvent({
      name: "payment/callback.rejected",
      data: {
        provider: "isbank",
        reason: "invalid-signature",
      },
    });

    return Response.json(
      {
        success: false,
        error: "Invalid payment callback signature",
        meta: {
          provider: "isbank",
          verification: "sha1",
        },
      },
      { status: 401 },
    );
  }

  const payloadHash = sha256Upper(rawBodyResult.rawBody);

  const preparedCallback = await preparePaymentCallback(
    {
      provider: "isbank",
      payload,
    },
    dependencies,
  );
  if (!preparedCallback.ok) {
    if (preparedCallback.callbackContractRejection) {
      await dependencies.sendInngestEvent({
        name: "payment/callback.rejected",
        data: {
          provider: "isbank",
          reason: preparedCallback.callbackContractRejection.reason,
          paymentId: preparedCallback.callbackContractRejection.paymentId,
          violations: preparedCallback.callbackContractRejection.violations,
        },
      });
    }

    return Response.json(
      {
        success: false,
        error: preparedCallback.error,
      },
      { status: preparedCallback.status },
    );
  }

  const receiptInput = {
    provider: "isbank",
    eventKey: buildIsbankHostedPaymentCallbackKey(
      payload,
      providedHash,
      payloadHash,
    ),
    payloadHash,
    contentType: supportedContentType,
  } satisfies RegisterCallbackReceiptInput;

  const receiptResult = await registerCallbackReceipt(
    receiptInput,
    dependencies,
  );

  if (!receiptResult.ok) {
    return Response.json(
      {
        success: false,
        error: receiptResult.error,
      },
      { status: receiptResult.status },
    );
  }

  if (!receiptResult.inserted) {
    const paymentStatus = await getPaymentStatusForDuplicateCheck(
      preparedCallback.supabase,
      preparedCallback.paymentId,
    );

    if (paymentStatus === "pending" || paymentStatus === "unknown") {
      return Response.json(
        {
          success: false,
          error: "Payment callback is being processed by another request",
        },
        { status: 409 },
      );
    }

    return Response.json({
      success: true,
      message: "Duplicate payment callback ignored",
      data: {
        provider: "isbank",
        verified: true,
        duplicate: true,
      },
    });
  }

  const checkoutResult = await executePreparedPaymentCallback(
    preparedCallback,
  );
  if (!checkoutResult.ok) {
    if (isInvariantFailure(checkoutResult)) {
      const auditResult = await recordInvariantRejectedPaymentEvent(
        preparedCallback.supabase,
        preparedCallback.paymentId,
        preparedCallback.providerRef,
        `isbank_callback_${preparedCallback.callbackStatus}`,
        checkoutResult,
      );
      const cleanupResult = await releaseCallbackReceipt(receiptInput, dependencies);
      if (!cleanupResult.ok) {
        return Response.json(
          {
            success: false,
            error: cleanupResult.error,
          },
          { status: cleanupResult.status },
        );
      }

      if (!auditResult.ok) {
        return Response.json(
          {
            success: false,
            error: auditResult.error,
          },
          { status: auditResult.status },
        );
      }

      return Response.json(
        {
          success: false,
          error: checkoutResult.error,
        },
        { status: checkoutResult.status },
      );
    }

    const cleanupResult = await releaseCallbackReceipt(receiptInput, dependencies);
    if (!cleanupResult.ok) {
      return Response.json(
        {
          success: false,
          error: cleanupResult.error,
        },
        { status: cleanupResult.status },
      );
    }

    return Response.json(
      {
        success: false,
        error: checkoutResult.error,
      },
      { status: checkoutResult.status },
    );
  }

  await dependencies.sendInngestEvent({
    name: "payment/callback.received",
    data: {
      provider: "isbank",
      verified: true,
      checkout: checkoutResult.result,
      paymentId: checkoutResult.paymentId,
      payloadHash,
      eventKey: receiptInput.eventKey,
    },
  });

  const messageByResult: Record<CheckoutResultKind, string> = {
    succeeded: "Payment callback processed",
    idempotent: "Payment callback already processed",
    conflict: "Payment callback processed with conflict",
    failed: "Payment callback processed as failed",
  };

  return Response.json({
    success: true,
    message: messageByResult[checkoutResult.result],
    data: {
      provider: "isbank",
      verified,
      duplicate: false,
      checkout: checkoutResult.result,
      paymentId: checkoutResult.paymentId,
    },
  });
}

async function registerCallbackReceipt(
  input: RegisterCallbackReceiptInput,
  dependencies: PaymentCallbackRouteDependencies,
): Promise<
  | { ok: true; inserted: boolean }
  | { ok: false; status: number; error: string }
> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return {
      ok: false,
      status: 500,
      error: "Server callback storage client is not configured",
    };
  }

  const supabase = dependencies.createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }) as CallbackSupabaseClient;

  const { data, error } = await supabase.rpc("register_payment_callback_receipt", {
    p_provider: input.provider,
    p_event_key: input.eventKey,
    p_payload_hash: input.payloadHash,
    p_content_type: input.contentType,
  });

  if (error) {
    return {
      ok: false,
      status: 500,
      error: "Failed to persist payment callback receipt",
    };
  }

  return {
    ok: true,
    inserted: Boolean(data),
  };
}

async function preparePaymentCallback(
  input: {
    provider: string;
    payload: LooseRecord;
  },
  dependencies: PaymentCallbackRouteDependencies,
): Promise<PreparedPaymentCallbackResult> {
  const serviceClient = createServiceRoleSupabaseClient(dependencies);
  if (!serviceClient.ok) {
    return serviceClient;
  }

  const paymentIdResult = await resolvePaymentIdForCallback(serviceClient.client, input);
  if (!paymentIdResult.ok) {
    return paymentIdResult;
  }

  const paymentSnapshotResult = await getPaymentSnapshotForContract(
    serviceClient.client,
    paymentIdResult.paymentId,
  );
  if (!paymentSnapshotResult.ok) {
    return paymentSnapshotResult;
  }

  const expectedClientId = readExpectedIsbankClientId();
  if (!expectedClientId) {
    return {
      ok: false,
      status: 500,
      error: "ISBANK_CLIENT_ID is not configured for callback validation",
    };
  }

  const contractCheck = validateIsbankCallbackContract({
    callbackReference: extractPaymentCallbackReference(input.payload),
    payload: input.payload,
    payment: paymentSnapshotResult.payment,
    expectedClientId,
  });
  if (!contractCheck.ok) {
    return {
      ok: false,
      status: 422,
      error: "Payment callback contract validation failed",
      callbackContractRejection: {
        reason: "invalid-callback-contract",
        paymentId: paymentSnapshotResult.payment.id,
        violations: contractCheck.violations,
      },
    };
  }

  const callbackStatus = resolveIsbankCallbackStatus(input.payload);
  if (!callbackStatus) {
    return {
      ok: false,
      status: 422,
      error: "Payment callback contract validation failed",
      callbackContractRejection: {
        reason: "invalid-callback-contract",
        paymentId: paymentSnapshotResult.payment.id,
        violations: ["response", "procreturncode"],
      },
    };
  }

  return {
    ok: true,
    paymentId: paymentIdResult.paymentId,
    providerRef: extractPaymentCallbackReference(input.payload),
    callbackStatus,
    eventPayload: input.payload,
    supabase: serviceClient.client,
  };
}

async function executePreparedPaymentCallback(
  input: Extract<PreparedPaymentCallbackResult, { ok: true }>,
): Promise<ProcessPaymentResult> {
  const { data, error } = await input.supabase.rpc("process_payment_checkout", {
    p_payment_id: input.paymentId,
    p_event_type: `isbank_callback_${input.callbackStatus}`,
    p_provider_ref: input.providerRef,
    p_event_payload: input.eventPayload,
  });

  if (error) {
    if (error.message.toLowerCase().includes("payment not found")) {
      return {
        ok: false,
        status: 404,
        error: "Payment record not found for callback",
        processingErrorCode: error.code ?? null,
        processingErrorMessage: error.message ?? null,
      };
    }

    return {
      ok: false,
      status: 500,
      error: "Failed to process payment callback",
      processingErrorCode: error.code ?? null,
      processingErrorMessage: error.message ?? null,
    };
  }

  const resultKind = parseCheckoutResult(data);
  if (!resultKind) {
    return {
      ok: false,
      status: 500,
      error: "Invalid checkout processing result",
    };
  }

  return {
    ok: true,
    result: resultKind,
    paymentId: input.paymentId,
  };
}

async function recordInvariantRejectedPaymentEvent(
  supabase: CallbackSupabaseClient,
  paymentId: string,
  providerRef: string | null,
  sourceEventType: string,
  failure: Extract<ProcessPaymentResult, { ok: false }>,
): Promise<
  | { ok: true }
  | { ok: false; status: number; error: string }
> {
  const insertResult = await supabase.from("payment_events").insert({
    payment_id: paymentId,
    event_type: "payment_callback_invariant_rejected",
    provider: "isbank",
    payload: {
      source_event_type: sourceEventType,
      reason: "callback_invariant_violation",
      processing_error_code: failure.processingErrorCode ?? null,
      processing_error_message: failure.processingErrorMessage ?? null,
      provider_ref: providerRef,
    },
  });

  if (insertResult.error) {
    return {
      ok: false,
      status: 500,
      error: "Failed to audit payment callback invariant violation",
    };
  }

  return { ok: true };
}

function isInvariantFailure(
  result: Extract<ProcessPaymentResult, { ok: false }>,
): boolean {
  return result.processingErrorCode === "22023" || result.processingErrorCode === "P0004";
}

async function releaseCallbackReceipt(
  input: RegisterCallbackReceiptInput,
  dependencies: PaymentCallbackRouteDependencies,
): Promise<
  | { ok: true }
  | { ok: false; status: number; error: string }
> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return {
      ok: false,
      status: 500,
      error: "Server callback storage client is not configured",
    };
  }

  const supabase = dependencies.createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }) as CallbackSupabaseClient;

  const deleteResult = await supabase
    .from("payment_callback_receipts")
    .delete()
    .eq("provider", input.provider)
    .eq("event_key", input.eventKey);

  if (deleteResult.error) {
    return {
      ok: false,
      status: 500,
      error: "Failed to release payment callback receipt",
    };
  }

  const receiptLookup = await supabase
    .from("payment_callback_receipts")
    .select("id")
    .eq("provider", input.provider)
    .eq("event_key", input.eventKey)
    .maybeSingle();

  if (receiptLookup.error || receiptLookup.data) {
    return {
      ok: false,
      status: 500,
      error: "Failed to release payment callback receipt",
    };
  }

  return { ok: true };
}

function createServiceRoleSupabaseClient(
  dependencies: PaymentCallbackRouteDependencies,
):
  | { ok: true; client: CallbackSupabaseClient }
  | { ok: false; status: number; error: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return {
      ok: false,
      status: 500,
      error: "Server payment orchestration client is not configured",
    };
  }

  return {
    ok: true,
    client: dependencies.createSupabaseClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }) as CallbackSupabaseClient,
  };
}

async function resolvePaymentIdForCallback(
  supabase: CallbackSupabaseClient,
  input: { provider: string; payload: LooseRecord },
): Promise<ResolvePaymentIdResult> {
  const signedReference = extractPaymentCallbackReference(input.payload);
  const explicitPaymentId = extractExplicitPaymentIdFromCallback(input.payload);

  if (
    signedReference &&
    explicitPaymentId &&
    !isSamePaymentReference(signedReference, explicitPaymentId)
  ) {
    return {
      ok: false,
      status: 422,
      error: "Payment callback contains conflicting oid and payment_id references",
    };
  }

  const paymentIdHint = extractPaymentIdHintFromCallback(input.payload);
  if (!paymentIdHint) {
    return {
      ok: false,
      status: 422,
      error: "Payment callback does not include a resolvable payment reference",
    };
  }

  if (isUuid(paymentIdHint)) {
    return {
      ok: true,
      paymentId: paymentIdHint,
    };
  }

  const byProviderRef = await supabase
    .from("payments")
    .select("id")
    .eq("provider", input.provider)
    .eq("provider_ref", paymentIdHint)
    .maybeSingle();

  if (byProviderRef.error) {
    if (isMultipleRowsSupabaseError(byProviderRef.error)) {
      return {
        ok: false,
        status: 409,
        error: "Payment callback reference matches multiple payment records",
      };
    }

    return {
      ok: false,
      status: 500,
      error: "Failed to resolve payment from callback reference",
    };
  }

  const providerRefPaymentId = readPaymentIdFromLookup(byProviderRef.data);
  if (providerRefPaymentId) {
    return {
      ok: true,
      paymentId: providerRefPaymentId,
    };
  }

  return {
    ok: false,
    status: 422,
    error: "Payment callback reference does not match any payment record",
  };
}

async function getPaymentSnapshotForContract(
  supabase: CallbackSupabaseClient,
  paymentId: string,
): Promise<PaymentSnapshotResult> {
  const paymentSelect = await supabase
    .from("payments")
    .select("id,amount,currency,provider,provider_ref,status")
    .eq("id", paymentId)
    .maybeSingle();

  if (paymentSelect.error) {
    return {
      ok: false,
      status: 500,
      error: "Failed to load payment for callback validation",
    };
  }

  const payment = parsePaymentSnapshot(paymentSelect.data);
  if (!payment) {
    return {
      ok: false,
      status: 404,
      error: "Payment record not found for callback",
    };
  }

  return {
    ok: true,
    payment,
  };
}

function validateIsbankCallbackContract(input: {
  callbackReference: string | null;
  payload: LooseRecord;
  payment: PaymentContractSnapshot;
  expectedClientId: string;
}): { ok: true } | { ok: false; violations: string[] } {
  const violations: string[] = [];

  if (input.payment.provider !== "isbank") {
    violations.push("provider");
  }

  if (
    input.payment.status !== "pending"
    && input.payment.status !== "succeeded"
    && input.payment.status !== "conflict"
    && input.payment.status !== "failed"
  ) {
    violations.push("payment_status");
  }

  if (!input.callbackReference) {
    violations.push("oid");
  } else {
    if (isUuid(input.callbackReference) && !isSamePaymentReference(input.payment.id, input.callbackReference)) {
      violations.push("oid");
    }

    if (!input.payment.providerRef || !isSamePaymentReference(input.payment.providerRef, input.callbackReference)) {
      violations.push("provider_ref");
    }
  }

  const response = readTrimmedPayloadValue(input.payload, "response");
  if (!response) {
    violations.push("response");
  }

  const procReturnCode = readTrimmedPayloadValue(input.payload, "procreturncode");
  if (!procReturnCode) {
    violations.push("procreturncode");
  }

  const callbackClientId = readTrimmedPayloadValue(input.payload, "clientid");
  if (!callbackClientId || callbackClientId !== input.expectedClientId) {
    violations.push("clientid");
  }

  const callbackCurrency = readTrimmedPayloadValue(input.payload, "currency");
  if (!callbackCurrency || callbackCurrency.toUpperCase() !== input.payment.currency) {
    violations.push("currency");
  }

  const callbackAmountMinorUnits = parseAmountToMinorUnits(
    readTrimmedPayloadValue(input.payload, "amount"),
  );
  const paymentAmountMinorUnits = parseAmountToMinorUnits(input.payment.amount);
  if (
    callbackAmountMinorUnits === null ||
    paymentAmountMinorUnits === null ||
    callbackAmountMinorUnits !== paymentAmountMinorUnits
  ) {
    violations.push("amount");
  }

  if (violations.length > 0) {
    return { ok: false, violations };
  }

  return { ok: true };
}

function readExpectedIsbankClientId(): string | null {
  const clientId = process.env.ISBANK_CLIENT_ID;
  if (typeof clientId !== "string" || clientId.trim().length === 0) {
    return null;
  }

  return clientId.trim();
}

function readPaymentIdFromLookup(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const id = (value as Record<string, unknown>).id;
  if (typeof id !== "string" || id.trim().length === 0) {
    return null;
  }

  return id.trim();
}

function parsePaymentSnapshot(value: unknown): PaymentContractSnapshot | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;
  const id = asNonEmptyString(row.id);
  const amount = asFiniteNonNegativeNumber(row.amount);
  const currency = asCurrencyCode(row.currency);
  const provider = asNonEmptyString(row.provider);
  const providerRef = asOptionalNonEmptyString(row.provider_ref);
  const status = asPaymentStatus(row.status);

  if (!id || amount === null || !currency || !provider || !status) {
    return null;
  }

  return {
    id,
    amount,
    currency,
    provider,
    providerRef,
    status,
  };
}

function readTrimmedPayloadValue(payload: LooseRecord, fieldName: string): string | null {
  const value = findCaseInsensitiveValue(payload, fieldName);
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return value.trim();
}

function parseAmountToMinorUnits(value: number | string | null): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) {
      return null;
    }

    return parseAmountToMinorUnits(value.toFixed(2));
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const [wholePart, fractionPart = ""] = normalized.split(".");
  const paddedFraction = `${fractionPart}00`.slice(0, 2);

  const whole = Number(wholePart);
  const fraction = Number(paddedFraction);
  if (!Number.isSafeInteger(whole) || !Number.isSafeInteger(fraction)) {
    return null;
  }

  const minorUnits = (whole * 100) + fraction;
  if (!Number.isSafeInteger(minorUnits)) {
    return null;
  }

  return minorUnits;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return value.trim();
}

function asOptionalNonEmptyString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return asNonEmptyString(value);
}

function isMultipleRowsSupabaseError(error: SupabaseClientError | null): boolean {
  if (!error) {
    return false;
  }

  if (error.code === "PGRST116") {
    return true;
  }

  return error.message?.toLowerCase().includes("multiple rows") ?? false;
}

function asFiniteNonNegativeNumber(value: unknown): number | null {
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

function asCurrencyCode(value: unknown): string | null {
  const normalized = asNonEmptyString(value);
  if (!normalized || normalized.length !== 3) {
    return null;
  }

  return normalized.toUpperCase();
}

function asPaymentStatus(value: unknown): PaymentStatus | null {
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

function parseCheckoutResult(data: unknown): CheckoutResultKind | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const result = (data as Record<string, unknown>).result;
  if (
    result === "succeeded"
    || result === "idempotent"
    || result === "conflict"
    || result === "failed"
  ) {
    return result;
  }

  return null;
}

function resolveIsbankCallbackStatus(payload: LooseRecord): "approved" | "failed" | null {
  const response = readTrimmedPayloadValue(payload, "response");
  const procReturnCode = readTrimmedPayloadValue(payload, "procreturncode");
  if (!response || !procReturnCode) {
    return null;
  }

  if (response.toLowerCase() === "approved" && procReturnCode === "00") {
    return "approved";
  }

  return "failed";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isSamePaymentReference(left: string, right: string): boolean {
  if (isUuid(left) && isUuid(right)) {
    return left.toLowerCase() === right.toLowerCase();
  }

  return left === right;
}

async function getPaymentStatusForDuplicateCheck(
  supabase: CallbackSupabaseClient,
  paymentId: string,
): Promise<PaymentStatus | "unknown"> {
  try {
    const { data, error } = await supabase
      .from("payments")
      .select("status")
      .eq("id", paymentId)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return "unknown";
    }

    const status = typeof data.status === "string" ? data.status : "";
    if (
      status === "pending" ||
      status === "succeeded" ||
      status === "failed" ||
      status === "cancelled" ||
      status === "refunded" ||
      status === "conflict"
    ) {
      return status;
    }

    return "unknown";
  } catch {
    return "unknown";
  }
}
