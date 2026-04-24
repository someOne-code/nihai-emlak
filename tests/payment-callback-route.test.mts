import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import test from "node:test";

import {
  buildIsbankHostedPaymentCallbackKey,
  sha256Upper,
} from "../lib/payments/callback.ts";
import { handlePaymentCallbackPost } from "../lib/payments/callback-route.ts";
import { buildIsbankSha1Input, sha1Upper } from "../lib/payments/isbank.ts";

type PaymentRow = {
  amount: number | string;
  currency: string;
  id: string;
  provider?: string;
  provider_ref?: string;
  status?: string;
};

test("callback route resolves signed oid as payment_id when supplemental payment_id matches", async (t) => {
  const callbackClientId = setupCallbackRouteEnv(t);

  const paymentId = "c4f6a8ba-58bf-42eb-8db9-cc318ef5e34f";
  const callbackPayload = {
    clientid: callbackClientId,
    oid: paymentId,
    payment_id: paymentId,
    amount: "1250.00",
    currency: "TRY",
    okurl: "https://example.com/ok",
    failurl: "https://example.com/fail",
    txnType: "Auth",
    instalment: "0",
    rnd: "rnd-123",
    ProcReturnCode: "00",
    Response: "Approved",
  };

  const providedHash = sha1Upper(
    buildIsbankSha1Input(callbackPayload, process.env.ISBANK_STORE_KEY),
  );
  const rawBody = new URLSearchParams(callbackPayload).toString();

  let providerRefLookupCalled = false;
  let processCheckoutArgs: Record<string, unknown> | undefined;
  const sentEvents: string[] = [];
  let registerReceiptCalled = false;

  const response = await handlePaymentCallbackPost(
    new Request("http://localhost/api/payment/callback", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-isbank-hash": providedHash,
      },
      body: rawBody,
    }),
    {
      createSupabaseClient: (_url, key) => {
        assert.equal(key, "service-key");
        return {
          from: buildPaymentsTableMock({
            onProviderRefLookup: () => {
              providerRefLookupCalled = true;
            },
            paymentRowsById: {
              [paymentId]: {
                id: paymentId,
                amount: "1250.00",
                currency: "TRY",
                provider: "isbank",
                provider_ref: paymentId,
                status: "pending",
              },
            },
          }),
          rpc: async (functionName: string, args?: Record<string, unknown>) => {
            if (functionName === "register_payment_callback_receipt") {
              registerReceiptCalled = true;
              return { data: true, error: null };
            }

            assert.equal(functionName, "process_payment_checkout");
            processCheckoutArgs = args;
            return { data: { result: "succeeded" }, error: null };
          },
        };
      },
      sendInngestEvent: async (event) => {
        sentEvents.push(event.name);
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(providerRefLookupCalled, false);
  assert.equal(processCheckoutArgs?.p_payment_id, paymentId);
  assert.equal(registerReceiptCalled, true);
  assert.deepEqual(sentEvents, ["payment/callback.received"]);

  const json = await response.json();
  assert.equal(json.success, true);
  assert.equal(json.data?.paymentId, paymentId);
});

test("callback route rejects when oid and payment_id conflict", async (t) => {
  const callbackClientId = setupCallbackRouteEnv(t);

  const signedOid = "c4f6a8ba-58bf-42eb-8db9-cc318ef5e34f";
  const injectedPaymentId = "0b22c380-2d57-4dc3-9375-cf8601f87b7d";
  const callbackPayload = {
    clientid: callbackClientId,
    oid: signedOid,
    payment_id: injectedPaymentId,
    amount: "1250.00",
    currency: "TRY",
    okurl: "https://example.com/ok",
    failurl: "https://example.com/fail",
    txnType: "Auth",
    instalment: "0",
    rnd: "rnd-123",
    ProcReturnCode: "00",
    Response: "Approved",
  };

  const providedHash = sha1Upper(
    buildIsbankSha1Input(callbackPayload, process.env.ISBANK_STORE_KEY),
  );
  const rawBody = new URLSearchParams(callbackPayload).toString();

  let processCheckoutCalled = false;
  let registerReceiptCalled = false;

  const response = await handlePaymentCallbackPost(
    new Request("http://localhost/api/payment/callback", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-isbank-hash": providedHash,
      },
      body: rawBody,
    }),
    {
      createSupabaseClient: (_url, key) => {
        assert.equal(key, "service-key");
        return {
          from: buildPaymentsTableMock({}),
          rpc: async (functionName: string) => {
            if (functionName === "register_payment_callback_receipt") {
              registerReceiptCalled = true;
              return { data: true, error: null };
            }

            processCheckoutCalled = true;
            return { data: { result: "succeeded" }, error: null };
          },
        };
      },
      sendInngestEvent: async () => {},
    },
  );

  assert.equal(response.status, 422);
  assert.equal(processCheckoutCalled, false);
  assert.equal(registerReceiptCalled, false);

  const json = await response.json();
  assert.equal(json.success, false);
  assert.equal(
    json.error,
    "Payment callback contains conflicting oid and payment_id references",
  );
});

test("callback route returns 400 when streamed body read fails", async (t) => {
  setupCallbackRouteEnv(t);

  const response = await handlePaymentCallbackPost(
    new Request("http://localhost/api/payment/callback", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-isbank-hash": "ABCDEF0123456789ABCDEF0123456789ABCDEF01",
      },
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.error(new Error("stream failed"));
        },
      }),
      duplex: "half",
    } as RequestInit & { duplex: "half" }),
    {
      createSupabaseClient: () => {
        throw new Error("createSupabaseClient should not be called when body read fails");
      },
      sendInngestEvent: async () => {
        throw new Error("sendInngestEvent should not be called when body read fails");
      },
    },
  );

  assert.equal(response.status, 400);

  const json = await response.json();
  assert.equal(json.success, false);
  assert.equal(json.error, "Invalid callback payload");
});

test("callback route does not persist duplicate receipt when checkout processing fails", async (t) => {
  const callbackClientId = setupCallbackRouteEnv(t);

  const paymentId = "2fe9c8e0-b663-441e-86fc-b8dd72dfd5d0";
  const callbackPayload = {
    clientid: callbackClientId,
    oid: paymentId,
    amount: "1250.00",
    currency: "TRY",
    okurl: "https://example.com/ok",
    failurl: "https://example.com/fail",
    txnType: "Auth",
    instalment: "0",
    rnd: "rnd-123",
    ProcReturnCode: "00",
    Response: "Approved",
  };

  const providedHash = sha1Upper(
    buildIsbankSha1Input(callbackPayload, process.env.ISBANK_STORE_KEY),
  );
  const rawBody = new URLSearchParams(callbackPayload).toString();

  let registerReceiptCalled = false;
  let releaseReceiptCalled = false;

  const response = await handlePaymentCallbackPost(
    new Request("http://localhost/api/payment/callback", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-isbank-hash": providedHash,
      },
      body: rawBody,
    }),
    {
      createSupabaseClient: (_url, key) => {
        assert.equal(key, "service-key");
        return {
          from: buildPaymentsTableMock({
            onReceiptRelease: () => {
              releaseReceiptCalled = true;
            },
            paymentRowsById: {
              [paymentId]: {
                id: paymentId,
                amount: "1250.00",
                currency: "TRY",
                provider: "isbank",
                provider_ref: paymentId,
                status: "pending",
              },
            },
          }),
          rpc: async (functionName: string) => {
            if (functionName === "register_payment_callback_receipt") {
              registerReceiptCalled = true;
              return { data: true, error: null };
            }

            return {
              data: null,
              error: { message: "transient rpc failure" },
            };
          },
        };
      },
      sendInngestEvent: async () => {},
    },
  );

  assert.equal(response.status, 500);
  assert.equal(registerReceiptCalled, true);
  assert.equal(releaseReceiptCalled, true);

  const json = await response.json();
  assert.equal(json.success, false);
  assert.equal(json.error, "Failed to process payment callback");
});

test("callback route records durable payment event for checkout invariant failures and releases receipt", async (t) => {
  const callbackClientId = setupCallbackRouteEnv(t);

  const paymentId = "9fe9c8e0-b663-441e-86fc-b8dd72dfd5d0";
  const callbackPayload = {
    clientid: callbackClientId,
    oid: paymentId,
    amount: "1250.00",
    currency: "TRY",
    okurl: "https://example.com/ok",
    failurl: "https://example.com/fail",
    txnType: "Auth",
    instalment: "0",
    rnd: "rnd-123",
    ProcReturnCode: "00",
    Response: "Approved",
  };

  const providedHash = sha1Upper(
    buildIsbankSha1Input(callbackPayload, process.env.ISBANK_STORE_KEY),
  );
  const rawBody = new URLSearchParams(callbackPayload).toString();

  let registerReceiptCalled = false;
  let releaseReceiptCalled = false;
  const insertedPaymentEvents: Array<Record<string, unknown>> = [];

  const response = await handlePaymentCallbackPost(
    new Request("http://localhost/api/payment/callback", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-isbank-hash": providedHash,
      },
      body: rawBody,
    }),
    {
      createSupabaseClient: (_url, key) => {
        assert.equal(key, "service-key");
        return {
          from: buildPaymentsTableMock({
            onReceiptRelease: () => {
              releaseReceiptCalled = true;
            },
            onInsertPaymentEvent: (row) => {
              insertedPaymentEvents.push(row);
            },
            paymentRowsById: {
              [paymentId]: {
                id: paymentId,
                amount: "1250.00",
                currency: "TRY",
                provider: "isbank",
                provider_ref: paymentId,
                status: "pending",
              },
            },
          }),
          rpc: async (functionName: string) => {
            if (functionName === "register_payment_callback_receipt") {
              registerReceiptCalled = true;
              return { data: true, error: null };
            }

            return {
              data: null,
              error: {
                code: "22023",
                message: "payment amount invariant violated for payment: 9fe9c8e0-b663-441e-86fc-b8dd72dfd5d0",
              },
            };
          },
        };
      },
      sendInngestEvent: async () => {},
    },
  );

  assert.equal(response.status, 500);
  assert.equal(registerReceiptCalled, true);
  assert.equal(releaseReceiptCalled, true);
  assert.equal(insertedPaymentEvents.length, 1);
  assert.deepEqual(insertedPaymentEvents[0], {
    payment_id: paymentId,
    event_type: "payment_callback_invariant_rejected",
    provider: "isbank",
    payload: {
      source_event_type: "isbank_callback_approved",
      reason: "callback_invariant_violation",
      processing_error_code: "22023",
      processing_error_message: "payment amount invariant violated for payment: 9fe9c8e0-b663-441e-86fc-b8dd72dfd5d0",
      provider_ref: paymentId,
    },
  });

  const json = await response.json();
  assert.equal(json.success, false);
  assert.equal(json.error, "Failed to process payment callback");
});

test("callback route surfaces receipt cleanup failure after checkout processing error", async (t) => {
  const callbackClientId = setupCallbackRouteEnv(t);

  const paymentId = "11112222-3333-4444-8555-666677778888";
  const callbackPayload = {
    clientid: callbackClientId,
    oid: paymentId,
    amount: "1250.00",
    currency: "TRY",
    okurl: "https://example.com/ok",
    failurl: "https://example.com/fail",
    txnType: "Auth",
    instalment: "0",
    rnd: "rnd-123",
    ProcReturnCode: "00",
    Response: "Approved",
  };

  const providedHash = sha1Upper(
    buildIsbankSha1Input(callbackPayload, process.env.ISBANK_STORE_KEY),
  );
  const rawBody = new URLSearchParams(callbackPayload).toString();

  const response = await handlePaymentCallbackPost(
    new Request("http://localhost/api/payment/callback", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-isbank-hash": providedHash,
      },
      body: rawBody,
    }),
    {
      createSupabaseClient: (_url, key) => {
        assert.equal(key, "service-key");
        return {
          from: buildPaymentsTableMock({
            receiptReleaseError: { message: "delete failed" },
            paymentRowsById: {
              [paymentId]: {
                id: paymentId,
                amount: "1250.00",
                currency: "TRY",
                provider: "isbank",
                provider_ref: paymentId,
                status: "pending",
              },
            },
          }),
          rpc: async (functionName: string) => {
            if (functionName === "register_payment_callback_receipt") {
              return { data: true, error: null };
            }

            return {
              data: null,
              error: { message: "transient rpc failure" },
            };
          },
        };
      },
      sendInngestEvent: async () => {},
    },
  );

  assert.equal(response.status, 500);

  const json = await response.json();
  assert.equal(json.success, false);
  assert.equal(json.error, "Failed to release payment callback receipt");
});

test("callback route fails when receipt row still exists after cleanup", async (t) => {
  const callbackClientId = setupCallbackRouteEnv(t);

  const paymentId = "abababab-abab-4bab-8bab-abababababab";
  const callbackPayload = {
    clientid: callbackClientId,
    oid: paymentId,
    amount: "1250.00",
    currency: "TRY",
    okurl: "https://example.com/ok",
    failurl: "https://example.com/fail",
    txnType: "Auth",
    instalment: "0",
    rnd: "rnd-123",
    ProcReturnCode: "00",
    Response: "Approved",
  };

  const providedHash = sha1Upper(
    buildIsbankSha1Input(callbackPayload, process.env.ISBANK_STORE_KEY),
  );
  const rawBody = new URLSearchParams(callbackPayload).toString();

  const response = await handlePaymentCallbackPost(
    new Request("http://localhost/api/payment/callback", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-isbank-hash": providedHash,
      },
      body: rawBody,
    }),
    {
      createSupabaseClient: (_url, key) => {
        assert.equal(key, "service-key");
        return {
          from: buildPaymentsTableMock({
            receiptStillExists: true,
            paymentRowsById: {
              [paymentId]: {
                id: paymentId,
                amount: "1250.00",
                currency: "TRY",
                provider: "isbank",
                provider_ref: paymentId,
                status: "pending",
              },
            },
          }),
          rpc: async (functionName: string) => {
            if (functionName === "register_payment_callback_receipt") {
              return { data: true, error: null };
            }

            return {
              data: null,
              error: { message: "transient rpc failure" },
            };
          },
        };
      },
      sendInngestEvent: async () => {},
    },
  );

  assert.equal(response.status, 500);

  const json = await response.json();
  assert.equal(json.success, false);
  assert.equal(json.error, "Failed to release payment callback receipt");
});

test("callback route accepts signed failed callbacks and records failure state", async (t) => {
  const callbackClientId = setupCallbackRouteEnv(t);
  const paymentId = "6e0a4ce1-bf0f-4f8a-9cab-552a43c4d81f";
  const callbackPayload = {
    clientid: callbackClientId,
    oid: paymentId,
    amount: "1250.00",
    currency: "TRY",
    okurl: "https://example.com/ok",
    failurl: "https://example.com/fail",
    txnType: "Auth",
    instalment: "0",
    rnd: "rnd-123",
    ProcReturnCode: "05",
    Response: "Declined",
  };

  const providedHash = sha1Upper(
    buildIsbankSha1Input(callbackPayload, process.env.ISBANK_STORE_KEY),
  );
  const rawBody = new URLSearchParams(callbackPayload).toString();

  let processCheckoutCalled = false;
  let registerReceiptCalled = false;
  let processCheckoutArgs: Record<string, unknown> | undefined;
  const sentEvents: Array<{ name: string; data: Record<string, unknown> }> = [];

  const response = await handlePaymentCallbackPost(
    new Request("http://localhost/api/payment/callback", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-isbank-hash": providedHash,
      },
      body: rawBody,
    }),
    {
      createSupabaseClient: (_url, key) => {
        assert.equal(key, "service-key");
        return {
          from: buildPaymentsTableMock({
            paymentRowsById: {
              [paymentId]: {
                id: paymentId,
                amount: "1250.00",
                currency: "TRY",
                provider: "isbank",
                provider_ref: paymentId,
                status: "pending",
              },
            },
          }),
          rpc: async (functionName: string, args?: Record<string, unknown>) => {
            if (functionName === "register_payment_callback_receipt") {
              registerReceiptCalled = true;
              return { data: true, error: null };
            }

            processCheckoutCalled = true;
            processCheckoutArgs = args;
            return { data: { result: "failed" }, error: null };
          },
        };
      },
      sendInngestEvent: async (event) => {
        sentEvents.push(event);
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(processCheckoutCalled, true);
  assert.equal(registerReceiptCalled, true);
  assert.equal(processCheckoutArgs?.p_event_type, "isbank_callback_failed");
  assert.equal(processCheckoutArgs?.p_payment_id, paymentId);
  assert.equal(sentEvents.length, 1);
  assert.equal(sentEvents[0]?.name, "payment/callback.received");
  assert.deepEqual(sentEvents[0]?.data, {
    provider: "isbank",
    verified: true,
    checkout: "failed",
    paymentId,
    payloadHash: sha256Upper(rawBody),
    eventKey: buildIsbankHostedPaymentCallbackKey(
      callbackPayload,
      providedHash,
      sha256Upper(rawBody),
    ),
  });
  assert.equal(Object.hasOwn(sentEvents[0]?.data ?? {}, "payload"), false);

  const json = await response.json();
  assert.equal(json.success, true);
  assert.equal(json.data?.checkout, "failed");
  assert.equal(json.data?.paymentId, paymentId);
});

test("callback route rejects amount mismatch and does not process checkout", async (t) => {
  const callbackClientId = setupCallbackRouteEnv(t);
  const paymentId = "605fc8cc-dca4-4e14-b659-7f7858f41eff";
  const callbackPayload = {
    clientid: callbackClientId,
    oid: paymentId,
    amount: "999.00",
    currency: "TRY",
    okurl: "https://example.com/ok",
    failurl: "https://example.com/fail",
    txnType: "Auth",
    instalment: "0",
    rnd: "rnd-123",
    ProcReturnCode: "00",
    Response: "Approved",
  };

  const providedHash = sha1Upper(
    buildIsbankSha1Input(callbackPayload, process.env.ISBANK_STORE_KEY),
  );
  const rawBody = new URLSearchParams(callbackPayload).toString();

  let processCheckoutCalled = false;
  let registerReceiptCalled = false;
  const sentEvents: Array<{ name: string; data: Record<string, unknown> }> = [];

  const response = await handlePaymentCallbackPost(
    new Request("http://localhost/api/payment/callback", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-isbank-hash": providedHash,
      },
      body: rawBody,
    }),
    {
      createSupabaseClient: (_url, key) => {
        assert.equal(key, "service-key");
        return {
          from: buildPaymentsTableMock({
            paymentRowsById: {
              [paymentId]: {
                id: paymentId,
                amount: "1250.00",
                currency: "TRY",
                provider: "isbank",
                provider_ref: paymentId,
                status: "pending",
              },
            },
          }),
          rpc: async (functionName: string) => {
            if (functionName === "register_payment_callback_receipt") {
              registerReceiptCalled = true;
              return { data: true, error: null };
            }

            processCheckoutCalled = true;
            return { data: { result: "succeeded" }, error: null };
          },
        };
      },
      sendInngestEvent: async (event) => {
        sentEvents.push(event);
      },
    },
  );

  assert.equal(response.status, 422);
  assert.equal(processCheckoutCalled, false);
  assert.equal(registerReceiptCalled, false);
  assert.equal(sentEvents.length, 1);
  assert.equal(sentEvents[0]?.name, "payment/callback.rejected");

  const json = await response.json();
  assert.equal(json.success, false);
  assert.equal(json.error, "Payment callback contract validation failed");
});

test("callback route rejects when resolved payment provider is not isbank", async (t) => {
  const callbackClientId = setupCallbackRouteEnv(t);
  const paymentId = "6bb18c57-69e8-4cb6-8289-9df2d8f7f942";
  const callbackPayload = {
    clientid: callbackClientId,
    oid: paymentId,
    amount: "1250.00",
    currency: "TRY",
    okurl: "https://example.com/ok",
    failurl: "https://example.com/fail",
    txnType: "Auth",
    instalment: "0",
    rnd: "rnd-123",
    ProcReturnCode: "00",
    Response: "Approved",
  };

  const providedHash = sha1Upper(
    buildIsbankSha1Input(callbackPayload, process.env.ISBANK_STORE_KEY),
  );
  const rawBody = new URLSearchParams(callbackPayload).toString();

  let processCheckoutCalled = false;
  let registerReceiptCalled = false;

  const response = await handlePaymentCallbackPost(
    new Request("http://localhost/api/payment/callback", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-isbank-hash": providedHash,
      },
      body: rawBody,
    }),
    {
      createSupabaseClient: (_url, key) => {
        assert.equal(key, "service-key");
        return {
          from: buildPaymentsTableMock({
            paymentRowsById: {
              [paymentId]: {
                id: paymentId,
                amount: "1250.00",
                currency: "TRY",
                provider: "manual",
                provider_ref: paymentId,
                status: "pending",
              },
            },
          }),
          rpc: async (functionName: string) => {
            if (functionName === "register_payment_callback_receipt") {
              registerReceiptCalled = true;
              return { data: true, error: null };
            }

            processCheckoutCalled = true;
            return { data: { result: "succeeded" }, error: null };
          },
        };
      },
      sendInngestEvent: async () => {},
    },
  );

  assert.equal(response.status, 422);
  assert.equal(processCheckoutCalled, false);
  assert.equal(registerReceiptCalled, false);

  const json = await response.json();
  assert.equal(json.success, false);
  assert.equal(json.error, "Payment callback contract validation failed");
});

test("callback route allows succeeded payment status for signed callback retry", async (t) => {
  const callbackClientId = setupCallbackRouteEnv(t);
  const paymentId = "8dd174f8-0f62-4d55-9857-d6eaed95dcf4";
  const callbackPayload = {
    clientid: callbackClientId,
    oid: paymentId,
    amount: "1250.00",
    currency: "TRY",
    okurl: "https://example.com/ok",
    failurl: "https://example.com/fail",
    txnType: "Auth",
    instalment: "0",
    rnd: "rnd-123",
    ProcReturnCode: "00",
    Response: "Approved",
  };

  const providedHash = sha1Upper(
    buildIsbankSha1Input(callbackPayload, process.env.ISBANK_STORE_KEY),
  );
  const rawBody = new URLSearchParams(callbackPayload).toString();

  let processCheckoutCalled = false;
  let registerReceiptCalled = false;
  const sentEvents: string[] = [];

  const response = await handlePaymentCallbackPost(
    new Request("http://localhost/api/payment/callback", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-isbank-hash": providedHash,
      },
      body: rawBody,
    }),
    {
      createSupabaseClient: (_url, key) => {
        assert.equal(key, "service-key");
        return {
          from: buildPaymentsTableMock({
            paymentRowsById: {
              [paymentId]: {
                id: paymentId,
                amount: "1250.00",
                currency: "TRY",
                provider: "isbank",
                provider_ref: paymentId,
                status: "succeeded",
              },
            },
          }),
          rpc: async (functionName: string, args?: Record<string, unknown>) => {
            if (functionName === "register_payment_callback_receipt") {
              registerReceiptCalled = true;
              assert.equal(args?.p_provider, "isbank");
              return { data: false, error: null };
            }

            processCheckoutCalled = true;
            return { data: { result: "idempotent" }, error: null };
          },
        };
      },
      sendInngestEvent: async (event) => {
        sentEvents.push(event.name);
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(processCheckoutCalled, false);
  assert.equal(registerReceiptCalled, true);
  assert.deepEqual(sentEvents, []);

  const json = await response.json();
  assert.equal(json.success, true);
  assert.equal(json.data?.duplicate, true);
  assert.equal(json.message, "Duplicate payment callback ignored");
});

test("callback route allows conflict payment status for signed callback retry", async (t) => {
  const callbackClientId = setupCallbackRouteEnv(t);
  const paymentId = "7bb7fbf4-7fb9-4eb7-a614-a34bb7f36db3";
  const callbackPayload = {
    clientid: callbackClientId,
    oid: paymentId,
    amount: "1250.00",
    currency: "TRY",
    okurl: "https://example.com/ok",
    failurl: "https://example.com/fail",
    txnType: "Auth",
    instalment: "0",
    rnd: "rnd-123",
    ProcReturnCode: "00",
    Response: "Approved",
  };

  const providedHash = sha1Upper(
    buildIsbankSha1Input(callbackPayload, process.env.ISBANK_STORE_KEY),
  );
  const rawBody = new URLSearchParams(callbackPayload).toString();

  let processCheckoutCalled = false;
  let registerReceiptCalled = false;
  const sentEvents: string[] = [];

  const response = await handlePaymentCallbackPost(
    new Request("http://localhost/api/payment/callback", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-isbank-hash": providedHash,
      },
      body: rawBody,
    }),
    {
      createSupabaseClient: (_url, key) => {
        assert.equal(key, "service-key");
        return {
          from: buildPaymentsTableMock({
            paymentRowsById: {
              [paymentId]: {
                id: paymentId,
                amount: "1250.00",
                currency: "TRY",
                provider: "isbank",
                provider_ref: paymentId,
                status: "conflict",
              },
            },
          }),
          rpc: async (functionName: string, args?: Record<string, unknown>) => {
            if (functionName === "register_payment_callback_receipt") {
              registerReceiptCalled = true;
              assert.equal(args?.p_provider, "isbank");
              return { data: false, error: null };
            }

            processCheckoutCalled = true;
            return { data: { result: "conflict" }, error: null };
          },
        };
      },
      sendInngestEvent: async (event) => {
        sentEvents.push(event.name);
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(processCheckoutCalled, false);
  assert.equal(registerReceiptCalled, true);
  assert.deepEqual(sentEvents, []);

  const json = await response.json();
  assert.equal(json.success, true);
  assert.equal(json.data?.duplicate, true);
  assert.equal(json.message, "Duplicate payment callback ignored");
});

test("callback route does not mutate payment state when receipt persistence fails", async (t) => {
  const callbackClientId = setupCallbackRouteEnv(t);
  const paymentId = "d1ab2d6d-50a8-4f0c-8f2c-8f9fd8f6a9d8";
  const callbackPayload = {
    clientid: callbackClientId,
    oid: paymentId,
    amount: "1250.00",
    currency: "TRY",
    okurl: "https://example.com/ok",
    failurl: "https://example.com/fail",
    txnType: "Auth",
    instalment: "0",
    rnd: "rnd-123",
    ProcReturnCode: "00",
    Response: "Approved",
  };

  const providedHash = sha1Upper(
    buildIsbankSha1Input(callbackPayload, process.env.ISBANK_STORE_KEY),
  );
  const rawBody = new URLSearchParams(callbackPayload).toString();

  let processCheckoutCalled = false;

  const response = await handlePaymentCallbackPost(
    new Request("http://localhost/api/payment/callback", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-isbank-hash": providedHash,
      },
      body: rawBody,
    }),
    {
      createSupabaseClient: (_url, key) => {
        assert.equal(key, "service-key");
        return {
          from: buildPaymentsTableMock({
            paymentRowsById: {
              [paymentId]: {
                id: paymentId,
                amount: "1250.00",
                currency: "TRY",
                provider: "isbank",
                provider_ref: paymentId,
                status: "pending",
              },
            },
          }),
          rpc: async (functionName: string) => {
            if (functionName === "register_payment_callback_receipt") {
              return {
                data: null,
                error: { message: "write failed" },
              };
            }

            processCheckoutCalled = true;
            return { data: { result: "succeeded" }, error: null };
          },
        };
      },
      sendInngestEvent: async () => {},
    },
  );

  assert.equal(response.status, 500);
  assert.equal(processCheckoutCalled, false);

  const json = await response.json();
  assert.equal(json.success, false);
  assert.equal(json.error, "Failed to persist payment callback receipt");
});

test("callback route rejects when payment provider_ref does not match signed oid", async (t) => {
  const callbackClientId = setupCallbackRouteEnv(t);
  const paymentId = "5b8d4b67-25d9-48dd-87a7-275f7d751447";
  const callbackPayload = {
    clientid: callbackClientId,
    oid: paymentId,
    amount: "1250.00",
    currency: "TRY",
    okurl: "https://example.com/ok",
    failurl: "https://example.com/fail",
    txnType: "Auth",
    instalment: "0",
    rnd: "rnd-123",
    ProcReturnCode: "00",
    Response: "Approved",
  };

  const providedHash = sha1Upper(
    buildIsbankSha1Input(callbackPayload, process.env.ISBANK_STORE_KEY),
  );
  const rawBody = new URLSearchParams(callbackPayload).toString();

  let processCheckoutCalled = false;
  let registerReceiptCalled = false;

  const response = await handlePaymentCallbackPost(
    new Request("http://localhost/api/payment/callback", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-isbank-hash": providedHash,
      },
      body: rawBody,
    }),
    {
      createSupabaseClient: (_url, key) => {
        assert.equal(key, "service-key");
        return {
          from: buildPaymentsTableMock({
            paymentRowsById: {
              [paymentId]: {
                id: paymentId,
                amount: "1250.00",
                currency: "TRY",
                provider: "isbank",
                provider_ref: "a77f6ba7-036a-4669-9712-b3899cb4f4cf",
                status: "pending",
              },
            },
          }),
          rpc: async (functionName: string) => {
            if (functionName === "register_payment_callback_receipt") {
              registerReceiptCalled = true;
              return { data: true, error: null };
            }

            processCheckoutCalled = true;
            return { data: { result: "succeeded" }, error: null };
          },
        };
      },
      sendInngestEvent: async () => {},
    },
  );

  assert.equal(response.status, 422);
  assert.equal(processCheckoutCalled, false);
  assert.equal(registerReceiptCalled, false);

  const json = await response.json();
  assert.equal(json.success, false);
  assert.equal(json.error, "Payment callback contract validation failed");
});

test("callback route fails closed when provider_ref matches multiple payments", async (t) => {
  const callbackClientId = setupCallbackRouteEnv(t);
  const providerRef = "legacy-isbank-ref-123";
  const callbackPayload = {
    clientid: callbackClientId,
    oid: providerRef,
    amount: "1250.00",
    currency: "TRY",
    okurl: "https://example.com/ok",
    failurl: "https://example.com/fail",
    txnType: "Auth",
    instalment: "0",
    rnd: "rnd-123",
    ProcReturnCode: "00",
    Response: "Approved",
  };

  const providedHash = sha1Upper(
    buildIsbankSha1Input(callbackPayload, process.env.ISBANK_STORE_KEY),
  );
  const rawBody = new URLSearchParams(callbackPayload).toString();

  let processCheckoutCalled = false;
  let registerReceiptCalled = false;

  const response = await handlePaymentCallbackPost(
    new Request("http://localhost/api/payment/callback", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-isbank-hash": providedHash,
      },
      body: rawBody,
    }),
    {
      createSupabaseClient: (_url, key) => {
        assert.equal(key, "service-key");
        return {
          from: buildPaymentsTableMock({
            providerRefLookupError: {
              code: "PGRST116",
              message: "JSON object requested, multiple rows returned",
            },
          }),
          rpc: async (functionName: string) => {
            if (functionName === "register_payment_callback_receipt") {
              registerReceiptCalled = true;
              return { data: true, error: null };
            }

            processCheckoutCalled = true;
            return { data: { result: "succeeded" }, error: null };
          },
        };
      },
      sendInngestEvent: async () => {},
    },
  );

  assert.equal(response.status, 409);
  assert.equal(processCheckoutCalled, false);
  assert.equal(registerReceiptCalled, false);

  const json = await response.json();
  assert.equal(json.success, false);
  assert.equal(json.error, "Payment callback reference matches multiple payment records");
});

test("callback route treats PGRST116 as duplicate provider_ref without relying on english message text", async (t) => {
  const callbackClientId = setupCallbackRouteEnv(t);
  const providerRef = "legacy-isbank-ref-code-only";
  const callbackPayload = {
    clientid: callbackClientId,
    oid: providerRef,
    amount: "1250.00",
    currency: "TRY",
    okurl: "https://example.com/ok",
    failurl: "https://example.com/fail",
    txnType: "Auth",
    instalment: "0",
    rnd: "rnd-123",
    ProcReturnCode: "00",
    Response: "Approved",
  };

  const providedHash = sha1Upper(
    buildIsbankSha1Input(callbackPayload, process.env.ISBANK_STORE_KEY),
  );
  const rawBody = new URLSearchParams(callbackPayload).toString();

  const response = await handlePaymentCallbackPost(
    new Request("http://localhost/api/payment/callback", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-isbank-hash": providedHash,
      },
      body: rawBody,
    }),
    {
      createSupabaseClient: (_url, key) => {
        assert.equal(key, "service-key");
        return {
          from: buildPaymentsTableMock({
            providerRefLookupError: {
              code: "PGRST116",
              message: "singular response conflict",
            },
          }),
          rpc: async () => ({ data: { result: "succeeded" }, error: null }),
        };
      },
      sendInngestEvent: async () => {},
    },
  );

  assert.equal(response.status, 409);

  const json = await response.json();
  assert.equal(json.success, false);
  assert.equal(json.error, "Payment callback reference matches multiple payment records");
});

function setupCallbackRouteEnv(
  t: TestContext,
  options?: { isbankClientId?: string },
): string {
  const originalEnv = {
    ISBANK_CLIENT_ID: process.env.ISBANK_CLIENT_ID,
    ISBANK_STORE_KEY: process.env.ISBANK_STORE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  t.after(() => {
    process.env.ISBANK_CLIENT_ID = originalEnv.ISBANK_CLIENT_ID;
    process.env.ISBANK_STORE_KEY = originalEnv.ISBANK_STORE_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnv.SUPABASE_SERVICE_ROLE_KEY;
  });

  process.env.ISBANK_CLIENT_ID = options?.isbankClientId ?? "7000679";
  process.env.ISBANK_STORE_KEY = "store-key-123";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "pub-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

  return process.env.ISBANK_CLIENT_ID;
}

function buildPaymentsTableMock(input: {
  onProviderRefLookup?: () => void;
  onReceiptRelease?: () => void;
  onInsertPaymentEvent?: (row: Record<string, unknown>) => void;
  receiptReleaseError?: { message: string } | null;
  receiptStillExists?: boolean;
  paymentRowsById?: Record<string, PaymentRow>;
  providerRefToPaymentId?: Record<string, string>;
  providerRefLookupError?: { code?: string; message: string } | null;
}) {
  return (table: "payment_callback_receipts" | "payments") => {
    if (table === "payment_callback_receipts") {
      return {
        select: () => {
          const filters: Record<string, string> = {};
          const query = {
            eq: (column: string, value: string) => {
              filters[column] = value;
              return query;
            },
            maybeSingle: async () => ({
              data:
                input.receiptStillExists && filters.provider && filters.event_key
                  ? { id: "receipt-id" }
                  : null,
              error: null,
            }),
          };

          return query;
        },
        delete: () => ({
          eq: () => ({
            eq: async () => {
              input.onReceiptRelease?.();
              return { error: input.receiptReleaseError ?? null };
            },
          }),
        }),
      };
    }

    if (table === "payment_events") {
      return {
        insert: async (row: Record<string, unknown>) => {
          input.onInsertPaymentEvent?.(row);
          return { error: null };
        },
      };
    }

    return {
      select: () => {
        const filters: Record<string, string> = {};
        const query = {
          eq: (column: string, value: string) => {
            filters[column] = value;
            if (column === "provider_ref") {
              input.onProviderRefLookup?.();
            }
            return query;
          },
          order: () => query,
          limit: () => query,
          maybeSingle: async () => {
            const byId = filters.id;
            if (byId) {
              return {
                data: input.paymentRowsById?.[byId] ?? null,
                error: null,
              };
            }

            const providerRef = filters.provider_ref;
            if (providerRef) {
              if (input.providerRefLookupError) {
                return {
                  data: null,
                  error: input.providerRefLookupError,
                };
              }

              const paymentId = input.providerRefToPaymentId?.[providerRef] ?? null;
              return {
                data: paymentId ? { id: paymentId } : null,
                error: null,
              };
            }

            return { data: null, error: null };
          },
        };

        return query;
      },
    };
  };
}
