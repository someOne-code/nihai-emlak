import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { inngest } from "@/lib/inngest/client";
import {
  buildIsbankHostedPaymentCallbackKey,
  getSupportedPaymentCallbackContentType,
  parsePaymentCallbackPayload,
  readPaymentCallbackRawBody,
  sha256Upper,
} from "@/lib/payments/callback";
import {
  buildIsbankSha1Input,
  extractProvidedHash,
  getSha1HexLength,
  hasRequiredIsbankFields,
  isValidSha1Hex,
  normalizePaymentPayload,
  safeCompareHash,
  sha1Upper,
} from "@/lib/payments/isbank";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const headerHash = request.headers.get("x-isbank-hash");
  const supportedContentType = getSupportedPaymentCallbackContentType(contentType);

  if (!supportedContentType) {
    return NextResponse.json(
      {
        success: false,
        error: "Unsupported callback content type",
      },
      { status: 415 },
    );
  }

  const rawBodyResult = readPaymentCallbackRawBody(await request.arrayBuffer());
  if (!rawBodyResult.ok) {
    return NextResponse.json(
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
    return NextResponse.json(
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
    return NextResponse.json(
      {
        success: false,
        error: "Server payment verification key is not configured",
      },
      { status: 500 },
    );
  }

  if (!hasRequiredIsbankFields(payload)) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing required callback fields",
      },
      { status: 400 },
    );
  }

  const providedHash = extractProvidedHash(payload, headerHash);
  if (!providedHash || !isValidSha1Hex(providedHash)) {
    return NextResponse.json(
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
    await inngest.send({
      name: "payment/callback.rejected",
      data: {
        provider: "isbank",
        reason: "invalid-signature",
      },
    });

    return NextResponse.json(
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

  const receiptResult = await registerCallbackReceipt({
    provider: "isbank",
    eventKey: buildIsbankHostedPaymentCallbackKey(
      payload,
      providedHash,
      payloadHash,
    ),
    payloadHash,
    contentType: supportedContentType,
  });

  if (!receiptResult.ok) {
    return NextResponse.json(
      {
        success: false,
        error: receiptResult.error,
      },
      { status: receiptResult.status },
    );
  }

  if (!receiptResult.inserted) {
    return NextResponse.json({
      success: true,
      message: "Duplicate payment callback ignored",
      data: {
        provider: "isbank",
        verified: true,
        duplicate: true,
      },
    });
  }

  await inngest.send({
    name: "payment/callback.received",
    data: {
      provider: "isbank",
      verified: true,
      payload,
    },
  });

  return NextResponse.json({
    success: true,
    message: "Payment callback accepted",
    data: {
      provider: "isbank",
      verified,
    },
  });
}

type RegisterCallbackReceiptInput = {
  provider: string;
  eventKey: string;
  payloadHash: string;
  contentType: string;
};

async function registerCallbackReceipt(
  input: RegisterCallbackReceiptInput,
): Promise<
  | { ok: true; inserted: boolean }
  | { ok: false; status: number; error: string }
> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    return {
      ok: false,
      status: 500,
      error: "Server callback storage client is not configured",
    };
  }

  const supabase = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

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
