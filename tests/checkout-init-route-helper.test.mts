import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCheckoutReturnUrls,
  buildIsbankHostedCheckoutPayload,
  parseCheckoutInitRequestBody,
  resolveCheckoutInitReturnUrlsFromEnvironment,
} from "../lib/payments/checkout-init.ts";
import { buildIsbankSha1Input, sha1Upper } from "../lib/payments/isbank.ts";
import { buildCheckoutInitSuccessResponse } from "../lib/payments/checkout-init-response.ts";

test("buildIsbankHostedCheckoutPayload sets oid from payment id", () => {
  const paymentId = "22222222-2222-4222-8222-222222222222";

  const payload = buildIsbankHostedCheckoutPayload({
    amount: 1200.5,
    clientId: "7000679",
    currency: "try",
    failUrl: "https://example.com/fail",
    okUrl: "https://example.com/ok",
    paymentId,
    rnd: "rnd-token",
    storeKey: "store-key-123",
  });

  assert.equal(payload.oid, paymentId);
  assert.equal(payload.amount, "1200.50");
  assert.equal(payload.currency, "TRY");
  assert.equal(payload.HASH, sha1Upper(buildIsbankSha1Input(payload, "store-key-123")));
});

test("buildCheckoutInitSuccessResponse keeps oid and providerRef aligned to payment id", () => {
  const paymentId = "11111111-1111-4111-8111-111111111111";
  const isbankPayload = buildIsbankHostedCheckoutPayload({
    amount: 999.99,
    clientId: "7000679",
    currency: "TRY",
    failUrl: "https://example.com/fail",
    okUrl: "https://example.com/ok",
    paymentId,
    rnd: "rnd-token",
    storeKey: "store-key-123",
  });

  const response = buildCheckoutInitSuccessResponse({
    amount: 999.99,
    currency: "TRY",
    isbankPayload,
    orderId: "33333333-3333-4333-8333-333333333333",
    paymentId,
    providerRef: paymentId,
  });

  assert.equal(response.data.payment.id, paymentId);
  assert.equal(response.data.payment.providerRef, paymentId);
  assert.equal(response.data.isbank.oid, paymentId);
});

test("buildCheckoutInitSuccessResponse rejects oid mismatch", () => {
  const paymentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const mismatchedOid = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const isbankPayload = buildIsbankHostedCheckoutPayload({
    amount: 50,
    clientId: "7000679",
    currency: "TRY",
    failUrl: "https://example.com/fail",
    okUrl: "https://example.com/ok",
    paymentId: mismatchedOid,
    rnd: "rnd-token",
    storeKey: "store-key-123",
  });

  assert.throws(
    () =>
      buildCheckoutInitSuccessResponse({
        amount: 50,
        currency: "TRY",
        isbankPayload,
        orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        paymentId,
        providerRef: paymentId,
      }),
    /isbank oid must equal paymentId/,
  );
});

test("buildCheckoutInitSuccessResponse rejects providerRef mismatch", () => {
  const paymentId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const isbankPayload = buildIsbankHostedCheckoutPayload({
    amount: 10,
    clientId: "7000679",
    currency: "TRY",
    failUrl: "https://example.com/fail",
    okUrl: "https://example.com/ok",
    paymentId,
    rnd: "rnd-token",
    storeKey: "store-key-123",
  });

  assert.throws(
    () =>
      buildCheckoutInitSuccessResponse({
        amount: 10,
        currency: "TRY",
        isbankPayload,
        orderId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        paymentId,
        providerRef: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      }),
    /providerRef must equal paymentId/,
  );
});

test("parseCheckoutInitRequestBody ignores request okUrl/failUrl overrides", () => {
  const orderId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const result = parseCheckoutInitRequestBody({
    orderId,
    okUrl: "https://evil.example/ok",
    failUrl: "https://evil.example/fail",
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    throw new Error("Expected checkout init body parsing to succeed");
  }

  assert.deepEqual(result.body, { orderId });
  assert.equal("okUrl" in result.body, false);
  assert.equal("failUrl" in result.body, false);
});

test("buildCheckoutReturnUrls uses only server site URL", () => {
  const urls = buildCheckoutReturnUrls("https://trusted.example.com");
  assert.equal(urls.okUrl, "https://trusted.example.com/checkout/success");
  assert.equal(urls.failUrl, "https://trusted.example.com/checkout/fail");
});

test("resolveCheckoutInitReturnUrlsFromEnvironment accepts NEXT_PUBLIC_SITE_URL outside dev/test when SITE_URL is missing", () => {
  const result = resolveCheckoutInitReturnUrlsFromEnvironment({
    nodeEnv: "production",
    siteUrl: undefined,
    publicSiteUrl: "https://public.example.com",
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    throw new Error("Expected NEXT_PUBLIC_SITE_URL fallback to succeed");
  }

  assert.equal(result.returnUrls.okUrl, "https://public.example.com/checkout/success");
  assert.equal(result.returnUrls.failUrl, "https://public.example.com/checkout/fail");
});

test("resolveCheckoutInitReturnUrlsFromEnvironment requires SITE_URL, NEXT_PUBLIC_SITE_URL, or VERCEL_URL outside dev/test", () => {
  const result = resolveCheckoutInitReturnUrlsFromEnvironment({
    nodeEnv: "production",
    siteUrl: undefined,
    publicSiteUrl: undefined,
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    throw new Error("Expected production URL configuration requirement failure");
  }

  assert.equal(result.status, 500);
  assert.equal(
    result.error,
    "SITE_URL or NEXT_PUBLIC_SITE_URL must be configured outside development/test",
  );
});

test("resolveCheckoutInitReturnUrlsFromEnvironment rejects VERCEL_URL-only configuration in production", () => {
  const result = resolveCheckoutInitReturnUrlsFromEnvironment({
    nodeEnv: "production",
    siteUrl: undefined,
    publicSiteUrl: undefined,
    vercelUrl: "nihai-emlak-preview.vercel.app",
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    throw new Error("Expected production VERCEL_URL-only configuration to fail closed");
  }

  assert.equal(result.status, 500);
  assert.equal(
    result.error,
    "SITE_URL or NEXT_PUBLIC_SITE_URL must be configured outside development/test",
  );
});

test("resolveCheckoutInitReturnUrlsFromEnvironment keeps canonical site URL in production even when preferred origin is preview", () => {
  const result = resolveCheckoutInitReturnUrlsFromEnvironment({
    nodeEnv: "production",
    siteUrl: "https://nihaiemlak.com",
    publicSiteUrl: "https://nihaiemlak.com",
    vercelUrl: "nihai-emlak-preview.vercel.app",
    preferredOrigin: "https://nihai-emlak-preview.vercel.app",
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    throw new Error("Expected canonical production site URL to succeed");
  }

  assert.equal(result.returnUrls.okUrl, "https://nihaiemlak.com/checkout/success");
  assert.equal(result.returnUrls.failUrl, "https://nihaiemlak.com/checkout/fail");
});

test("resolveCheckoutInitReturnUrlsFromEnvironment preserves configured base path for trusted origin", () => {
  const result = resolveCheckoutInitReturnUrlsFromEnvironment({
    nodeEnv: "production",
    siteUrl: "https://nihaiemlak.com/app",
    publicSiteUrl: "https://nihaiemlak.com/app",
    preferredOrigin: "https://nihaiemlak.com",
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    throw new Error("Expected trusted origin with base path to succeed");
  }

  assert.equal(result.returnUrls.okUrl, "https://nihaiemlak.com/app/checkout/success");
  assert.equal(result.returnUrls.failUrl, "https://nihaiemlak.com/app/checkout/fail");
});

test("resolveCheckoutInitReturnUrlsFromEnvironment fails closed on invalid configured URL", () => {
  const result = resolveCheckoutInitReturnUrlsFromEnvironment({
    nodeEnv: "production",
    siteUrl: "not-a-valid-url",
    publicSiteUrl: "https://public.example.com",
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    throw new Error("Expected invalid URL failure");
  }

  assert.equal(result.status, 500);
  assert.equal(result.error, "Checkout return URL configuration is invalid");
});
