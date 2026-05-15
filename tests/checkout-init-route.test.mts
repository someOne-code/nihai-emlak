import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import test from "node:test";

import {
  handleCheckoutInitPost,
  type CheckoutInitRouteDependencies,
} from "../lib/payments/checkout-init-route.ts";
import { buildIsbankSha1Input, sha1Upper } from "../lib/payments/isbank.ts";

test("checkout init rejects non-json state-changing requests before auth", async (t) => {
  setupCheckoutInitEnv(t);

  const response = await handleCheckoutInitPost(
    new Request("http://localhost:3000/api/checkout/init", {
      method: "POST",
      headers: {
        "content-type": "text/plain",
        origin: "http://localhost:3000",
      },
      body: "not-json",
    }),
    createFailingDependencies(),
  );

  assert.equal(response.status, 415);

  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error, "Checkout init requires application/json");
});

test("checkout init rejects missing origin before auth", async (t) => {
  setupCheckoutInitEnv(t);

  const response = await handleCheckoutInitPost(
    new Request("http://localhost:3000/api/checkout/init", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ orderId: "11111111-1111-4111-8111-111111111111" }),
    }),
    createFailingDependencies(),
  );

  assert.equal(response.status, 403);

  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error, "Checkout init Origin header is required");
});

test("checkout init rejects untrusted origin before auth", async (t) => {
  setupCheckoutInitEnv(t);

  const response = await handleCheckoutInitPost(
    new Request("http://localhost:3000/api/checkout/init", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://evil.example",
      },
      body: JSON.stringify({ orderId: "11111111-1111-4111-8111-111111111111" }),
    }),
    createFailingDependencies(),
  );

  assert.equal(response.status, 403);

  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error, "Checkout init Origin is not trusted");
});

test("checkout init rejects preview origin in production when canonical site URLs are configured", async (t) => {
  setupCheckoutInitEnv(t, {
    nodeEnv: "production",
    nextPublicSiteUrl: "https://nihaiemlak.com",
    siteUrl: "https://nihaiemlak.com",
    vercelUrl: "nihai-emlak-git-phase3-umut.vercel.app",
  });

  const response = await handleCheckoutInitPost(
    new Request("https://nihai-emlak-git-phase3-umut.vercel.app/api/checkout/init", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://nihai-emlak-git-phase3-umut.vercel.app",
      },
      body: JSON.stringify({ orderId: "11111111-1111-4111-8111-111111111111" }),
    }),
    createFailingDependencies(),
  );

  assert.equal(response.status, 403);

  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error, "Checkout init Origin is not trusted");
});

test("checkout init fails closed when SITE_URL and NEXT_PUBLIC_SITE_URL share origin but diverge by base path", async (t) => {
  setupCheckoutInitEnv(t, {
    nodeEnv: "production",
    siteUrl: "https://example.com/admin",
    nextPublicSiteUrl: "https://example.com",
  });

  const response = await handleCheckoutInitPost(
    new Request("https://example.com/api/checkout/init", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://example.com",
      },
      body: JSON.stringify({ orderId: "11111111-1111-4111-8111-111111111111" }),
    }),
    createDependencies({
      getOrder: () => {
        throw new Error("order lookup should not run for ambiguous same-origin return URL config");
      },
      getPendingPayment: () => {
        throw new Error("payment lookup should not run for ambiguous same-origin return URL config");
      },
      insertPayment: () => {
        throw new Error("insert should not run for ambiguous same-origin return URL config");
      },
      userId: "15151515-1515-4515-8515-151515151515",
    }),
  );

  assert.equal(response.status, 500);

  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(
    payload.error,
    "SITE_URL and NEXT_PUBLIC_SITE_URL must not share the same origin with different base paths for checkout return URLs",
  );
});

test("checkout init rejects unauthenticated requests", async (t) => {
  setupCheckoutInitEnv(t);

  const response = await handleCheckoutInitPost(
    new Request("http://localhost:3000/api/checkout/init", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({ orderId: "11111111-1111-4111-8111-111111111111" }),
    }),
    createDependencies({
      getOrder: () => {
        throw new Error("order lookup should not run without auth");
      },
      getPendingPayment: () => {
        throw new Error("payment lookup should not run without auth");
      },
      insertPayment: () => {
        throw new Error("insert should not run without auth");
      },
      userId: null,
    }),
  );

  assert.equal(response.status, 401);

  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error, "Authentication required");
});

test("checkout init returns not found when order does not belong to authenticated user", async (t) => {
  setupCheckoutInitEnv(t);

  const response = await handleCheckoutInitPost(
    new Request("http://localhost:3000/api/checkout/init", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({ orderId: "14141414-1414-4414-8414-141414141414" }),
    }),
    createDependencies({
      getOrder: () => null,
      getPendingPayment: () => {
        throw new Error("payment lookup should not run when order is missing");
      },
      insertPayment: () => {
        throw new Error("insert should not run when order is missing");
      },
      userId: "15151515-1515-4515-8515-151515151515",
    }),
  );

  assert.equal(response.status, 404);

  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error, "Order not found");
});

test("checkout init rejects non-pending orders", async (t) => {
  setupCheckoutInitEnv(t);

  const response = await handleCheckoutInitPost(
    new Request("http://localhost:3000/api/checkout/init", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({ orderId: "16161616-1616-4616-8616-161616161616" }),
    }),
    createDependencies({
      getOrder: () => ({
        id: "16161616-1616-4616-8616-161616161616",
        total_amount: 1250,
        currency: "TRY",
        status: "completed",
      }),
      getPendingPayment: () => {
        throw new Error("payment lookup should not run for non-pending orders");
      },
      insertPayment: () => {
        throw new Error("insert should not run for non-pending orders");
      },
      userId: "17171717-1717-4717-8717-171717171717",
    }),
  );

  assert.equal(response.status, 409);

  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error, "Only pending orders can be initialized for payment");
});

test("checkout init accepts preview origin in test mode when VERCEL_URL matches request host", async (t) => {
  setupCheckoutInitEnv(t, {
    nextPublicSiteUrl: "https://nihaiemlak.com",
    siteUrl: "https://nihaiemlak.com",
    vercelUrl: "nihai-emlak-git-phase3-umut.vercel.app",
  });

  const orderId = "44444444-4444-4444-8444-444444444444";
  const userId = "55555555-5555-4555-8555-555555555555";
  const paymentId = "66666666-6666-4666-8666-666666666666";

  const response = await handleCheckoutInitPost(
    new Request("https://nihai-emlak-git-phase3-umut.vercel.app/api/checkout/init", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://nihai-emlak-git-phase3-umut.vercel.app",
      },
      body: JSON.stringify({ orderId }),
    }),
    createDependencies({
      getOrder: () => ({
        id: orderId,
        total_amount: 1250,
        currency: "TRY",
        status: "pending",
      }),
      getPendingPayment: () => ({
        id: paymentId,
        order_id: orderId,
        amount: "1250.00",
        currency: "TRY",
        status: "pending",
        provider_ref: paymentId,
      }),
      getPaymentById: () => ({
        id: paymentId,
        order_id: orderId,
        amount: "1250.00",
        currency: "TRY",
        status: "pending",
        provider_ref: paymentId,
      }),
      insertPayment: () => {
        throw new Error("insert should not be called when pending payment exists");
      },
      userId,
    }),
  );

  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.data.payment.id, paymentId);
  assert.equal(
    payload.data.isbank.okurl,
    "https://nihai-emlak-git-phase3-umut.vercel.app/checkout/success",
  );
  assert.equal(
    payload.data.isbank.failurl,
    "https://nihai-emlak-git-phase3-umut.vercel.app/checkout/fail",
  );
});

test("checkout init accepts trusted origin behind proxy even when request host differs", async (t) => {
  setupCheckoutInitEnv(t, {
    nextPublicSiteUrl: "https://nihaiemlak.com",
    siteUrl: "https://nihaiemlak.com",
    vercelUrl: "nihai-emlak-git-phase3-umut.vercel.app",
  });

  const orderId = "47474747-4747-4747-8747-474747474747";
  const userId = "58585858-5858-4858-8858-585858585858";
  const paymentId = "69696969-6969-4969-8969-696969696969";

  const response = await handleCheckoutInitPost(
    new Request("http://127.0.0.1:3000/api/checkout/init", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://nihai-emlak-git-phase3-umut.vercel.app",
      },
      body: JSON.stringify({ orderId }),
    }),
    createDependencies({
      getOrder: () => ({
        id: orderId,
        total_amount: 1250,
        currency: "TRY",
        status: "pending",
      }),
      getPendingPayment: () => ({
        id: paymentId,
        order_id: orderId,
        amount: "1250.00",
        currency: "TRY",
        status: "pending",
        provider_ref: paymentId,
      }),
      getPaymentById: () => ({
        id: paymentId,
        order_id: orderId,
        amount: "1250.00",
        currency: "TRY",
        status: "pending",
        provider_ref: paymentId,
      }),
      insertPayment: () => {
        throw new Error("insert should not be called when pending payment exists");
      },
      userId,
    }),
  );

  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.data.payment.id, paymentId);
});

test("checkout init builds return URLs from VERCEL_URL when site URLs are unset in test mode", async (t) => {
  setupCheckoutInitEnv(t, {
    vercelUrl: "nihai-emlak-preview.vercel.app",
  });

  delete process.env.SITE_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;

  const orderId = "81818181-8181-4181-8181-818181818181";
  const userId = "82828282-8282-4282-8282-828282828282";
  const paymentId = "83838383-8383-4383-8383-838383838383";

  const response = await handleCheckoutInitPost(
    new Request("https://nihai-emlak-preview.vercel.app/api/checkout/init", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://nihai-emlak-preview.vercel.app",
      },
      body: JSON.stringify({ orderId }),
    }),
    createDependencies({
      getOrder: () => ({
        id: orderId,
        total_amount: 1250,
        currency: "TRY",
        status: "pending",
      }),
      getPendingPayment: () => ({
        id: paymentId,
        order_id: orderId,
        amount: "1250.00",
        currency: "TRY",
        status: "pending",
        provider_ref: paymentId,
      }),
      getPaymentById: () => ({
        id: paymentId,
        order_id: orderId,
        amount: "1250.00",
        currency: "TRY",
        status: "pending",
        provider_ref: paymentId,
      }),
      insertPayment: () => {
        throw new Error("insert should not be called when pending payment exists");
      },
      userId,
    }),
  );

  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.data.isbank.okurl, "https://nihai-emlak-preview.vercel.app/checkout/success");
  assert.equal(payload.data.isbank.failurl, "https://nihai-emlak-preview.vercel.app/checkout/fail");
});

test("checkout init rejects oversized json before auth", async (t) => {
  setupCheckoutInitEnv(t);

  const response = await handleCheckoutInitPost(
    new Request("http://localhost:3000/api/checkout/init", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        orderId: "11111111-1111-4111-8111-111111111111",
        padding: "x".repeat(5000),
      }),
    }),
    createFailingDependencies(),
  );

  assert.equal(response.status, 413);

  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error, "Checkout init payload is too large");
});

test("checkout init reuses existing pending isbank payment for same order", async (t) => {
  setupCheckoutInitEnv(t);

  const orderId = "11111111-1111-4111-8111-111111111111";
  const userId = "22222222-2222-4222-8222-222222222222";
  const existingPaymentId = "33333333-3333-4333-8333-333333333333";

  const state = {
    paymentSelectCallCount: 0,
    insertCallCount: 0,
  };

  const dependencies = createDependencies({
    getOrder: () => ({
      id: orderId,
      total_amount: 1250,
      currency: "TRY",
      status: "pending",
    }),
    getPendingPayment: () => {
      state.paymentSelectCallCount += 1;
      return {
        id: existingPaymentId,
        order_id: orderId,
        amount: "1250.00",
        currency: "TRY",
        status: "pending",
        provider_ref: existingPaymentId,
      };
    },
    getPaymentById: () => ({
      id: existingPaymentId,
      order_id: orderId,
      amount: "1250.00",
      currency: "TRY",
      status: "pending",
      provider_ref: existingPaymentId,
    }),
    insertPayment: () => {
      state.insertCallCount += 1;
      throw new Error("insert should not be called when pending payment exists");
    },
    userId,
  });

  const response = await handleCheckoutInitPost(
    new Request("http://localhost:3000/api/checkout/init", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({ orderId }),
    }),
    dependencies,
  );

  assert.equal(response.status, 200);
  assert.equal(state.paymentSelectCallCount, 1);
  assert.equal(state.insertCallCount, 0);

  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.data.payment.id, existingPaymentId);
  assert.equal(payload.data.payment.providerRef, existingPaymentId);
  assert.equal(payload.data.isbank.oid, existingPaymentId);
  assert.equal(
    payload.data.isbank.HASH,
    sha1Upper(buildIsbankSha1Input(payload.data.isbank, "store-key-123")),
  );
});

test("checkout init rejects pending orders without an existing pending isbank payment", async (t) => {
  setupCheckoutInitEnv(t);

  const orderId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const userId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  const dependencies = createDependencies({
    getOrder: () => ({
      id: orderId,
      total_amount: 999.99,
      currency: "TRY",
      status: "pending",
    }),
    getPendingPayment: () => null,
    insertPayment: () => {
      throw new Error("checkout init must not create pending payments");
    },
    userId,
  });

  const response = await handleCheckoutInitPost(
    new Request("http://localhost:3000/api/checkout/init", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({ orderId }),
    }),
    dependencies,
  );

  assert.equal(response.status, 409);

  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error, "Checkout init requires an existing pending payment");
});

test("checkout init rejects zero-amount pending payments before hosted checkout payload", async (t) => {
  setupCheckoutInitEnv(t);

  const orderId = "01010101-0101-4101-8101-010101010101";
  const userId = "02020202-0202-4202-8202-020202020202";
  const paymentId = "03030303-0303-4303-8303-030303030303";

  const response = await handleCheckoutInitPost(
    new Request("http://localhost:3000/api/checkout/init", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({ orderId }),
    }),
    createDependencies({
      getOrder: () => ({
        id: orderId,
        total_amount: 0,
        currency: "TRY",
        status: "pending",
      }),
      getPendingPayment: () => ({
        id: paymentId,
        order_id: orderId,
        amount: "0.00",
        currency: "TRY",
        status: "pending",
        provider_ref: paymentId,
      }),
      getPaymentById: () => ({
        id: paymentId,
        order_id: orderId,
        amount: "0.00",
        currency: "TRY",
        status: "pending",
        provider_ref: paymentId,
      }),
      insertPayment: () => {
        throw new Error("insert should not be called when pending payment exists");
      },
      userId,
    }),
  );

  assert.equal(response.status, 409);

  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error, "Checkout init requires a positive pending payment amount");
  assert.equal("data" in payload, false);
});

test("checkout init does not recover missing pending payment by creating or racing a new one", async (t) => {
  setupCheckoutInitEnv(t);

  const orderId = "12121212-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const userId = "34343434-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  const dependencies = createDependencies({
    getOrder: () => ({
      id: orderId,
      total_amount: 999.99,
      currency: "TRY",
      status: "pending",
    }),
    getPendingPayment: () => null,
    insertPayment: () => {
      throw new Error("checkout init must not create pending payments");
    },
    userId,
  });

  const response = await handleCheckoutInitPost(
    new Request("http://localhost:3000/api/checkout/init", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({ orderId }),
    }),
    dependencies,
  );

  assert.equal(response.status, 409);

  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error, "Checkout init requires an existing pending payment");
});

test("checkout init rejects reused pending payment when order total drifts from the order", async (t) => {
  setupCheckoutInitEnv(t);

  const orderId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const userId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  const existingPaymentId = "ffffffff-ffff-4fff-8fff-ffffffffffff";

  const dependencies = createDependencies({
    getOrder: () => ({
      id: orderId,
      total_amount: 1500,
      currency: "USD",
      status: "pending",
    }),
    getPendingPayment: () => ({
      id: existingPaymentId,
      order_id: orderId,
      amount: "1250.00",
      currency: "TRY",
      status: "pending",
      provider_ref: existingPaymentId,
    }),
    insertPayment: () => {
      throw new Error("insert should not be called when pending payment exists");
    },
    userId,
  });

  const response = await handleCheckoutInitPost(
    new Request("http://localhost:3000/api/checkout/init", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({ orderId }),
    }),
    dependencies,
  );

  assert.equal(response.status, 409);

  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error, "Pending payment no longer matches order total");
});

test("checkout init revalidates order total against refreshed pending payment", async (t) => {
  setupCheckoutInitEnv(t);

  const orderId = "abababab-abab-4bab-8bab-abababababab";
  const userId = "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd";
  const paymentId = "efefefef-efef-4fef-8fef-efefefefefef";

  const dependencies = createDependencies({
    getOrder: () => ({
      id: orderId,
      total_amount: 1250,
      currency: "TRY",
      status: "pending",
    }),
    getPendingPayment: () => ({
      id: paymentId,
      order_id: orderId,
      amount: "1250.00",
      currency: "TRY",
      status: "pending",
      provider_ref: paymentId,
    }),
    getPaymentById: () => ({
      id: paymentId,
      order_id: orderId,
      amount: "1300.00",
      currency: "TRY",
      status: "pending",
      provider_ref: paymentId,
    }),
    insertPayment: () => {
      throw new Error("insert should not be called when pending payment exists");
    },
    userId,
  });

  const response = await handleCheckoutInitPost(
    new Request("http://localhost:3000/api/checkout/init", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({ orderId }),
    }),
    dependencies,
  );

  assert.equal(response.status, 409);

  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error, "Pending payment no longer matches order total");
});

test("checkout init rejects refreshed pending payment rebound to another order", async (t) => {
  setupCheckoutInitEnv(t);

  const orderId = "abababab-abab-4bab-8bab-abababababab";
  const reboundOrderId = "bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc";
  const userId = "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd";
  const paymentId = "efefefef-efef-4fef-8fef-efefefefefef";

  const dependencies = createDependencies({
    getOrder: () => ({
      id: orderId,
      total_amount: 1250,
      currency: "TRY",
      status: "pending",
    }),
    getPendingPayment: () => ({
      id: paymentId,
      order_id: orderId,
      amount: "1250.00",
      currency: "TRY",
      status: "pending",
      provider_ref: paymentId,
    }),
    getPaymentById: () => ({
      id: paymentId,
      order_id: reboundOrderId,
      amount: "1250.00",
      currency: "TRY",
      status: "pending",
      provider_ref: paymentId,
    }),
    insertPayment: () => {
      throw new Error("insert should not be called when pending payment exists");
    },
    userId,
  });

  const response = await handleCheckoutInitPost(
    new Request("http://localhost:3000/api/checkout/init", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({ orderId }),
    }),
    dependencies,
  );

  assert.equal(response.status, 409);

  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error, "Pending payment no longer belongs to order");
});

test("checkout init rejects refreshed pending payment rebound to another user", async (t) => {
  setupCheckoutInitEnv(t);

  const orderId = "abababab-abab-4bab-8bab-abababababab";
  const userId = "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd";
  const reboundUserId = "dededede-dede-4ede-8ede-dededededede";
  const paymentId = "efefefef-efef-4fef-8fef-efefefefefef";

  const dependencies = createDependencies({
    getOrder: () => ({
      id: orderId,
      total_amount: 1250,
      currency: "TRY",
      status: "pending",
    }),
    getPendingPayment: () => ({
      id: paymentId,
      order_id: orderId,
      user_id: userId,
      amount: "1250.00",
      currency: "TRY",
      status: "pending",
      provider_ref: paymentId,
    }),
    getPaymentById: () => ({
      id: paymentId,
      order_id: orderId,
      user_id: reboundUserId,
      amount: "1250.00",
      currency: "TRY",
      status: "pending",
      provider_ref: paymentId,
    }),
    insertPayment: () => {
      throw new Error("insert should not be called when pending payment exists");
    },
    userId,
  });

  const response = await handleCheckoutInitPost(
    new Request("http://localhost:3000/api/checkout/init", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({ orderId }),
    }),
    dependencies,
  );

  assert.equal(response.status, 409);

  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error, "Pending payment no longer belongs to user");
});

test("checkout init fails closed when multiple pending isbank payments exist for an order", async (t) => {
  setupCheckoutInitEnv(t);

  const orderId = "9a9a9a9a-9a9a-4a9a-8a9a-9a9a9a9a9a9a";
  const userId = "8b8b8b8b-8b8b-4b8b-8b8b-8b8b8b8b8b8b";

  const dependencies = createDependencies({
    getOrder: () => ({
      id: orderId,
      total_amount: 1250,
      currency: "TRY",
      status: "pending",
    }),
    getPendingPayment: () => {
      throw new Error("default payment lookup should not run");
    },
    createServerPaymentsClient: () => ({
      select: () =>
        createQueryBuilder(() => ({
          data: null,
          error: {
            code: "PGRST116",
            message: "JSON object requested, multiple rows returned",
          },
        })),
    }),
    insertPayment: () => {
      throw new Error("insert should not be called when lookup is ambiguous");
    },
    userId,
  });

  const response = await handleCheckoutInitPost(
    new Request("http://localhost:3000/api/checkout/init", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({ orderId }),
    }),
    dependencies,
  );

  assert.equal(response.status, 409);

  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error, "Checkout init found multiple pending payments for order");
});

test("checkout init treats PGRST116 as duplicate pending payment even without english message text", async (t) => {
  setupCheckoutInitEnv(t);

  const orderId = "7a7a7a7a-7a7a-4a7a-8a7a-7a7a7a7a7a7a";
  const userId = "6b6b6b6b-6b6b-4b6b-8b6b-6b6b6b6b6b6b";

  const dependencies = createDependencies({
    getOrder: () => ({
      id: orderId,
      total_amount: 1250,
      currency: "TRY",
      status: "pending",
    }),
    getPendingPayment: () => {
      throw new Error("default payment lookup should not run");
    },
    createServerPaymentsClient: () => ({
      select: () =>
        createQueryBuilder(() => ({
          data: null,
          error: {
            code: "PGRST116",
            message: "singular response conflict",
          },
        })),
    }),
    insertPayment: () => {
      throw new Error("insert should not be called when lookup is ambiguous");
    },
    userId,
  });

  const response = await handleCheckoutInitPost(
    new Request("http://localhost:3000/api/checkout/init", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({ orderId }),
    }),
    dependencies,
  );

  assert.equal(response.status, 409);

  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error, "Checkout init found multiple pending payments for order");
});

test("checkout init never rewrites mismatched payment rows through service-role reconciliation", async (t) => {
  setupCheckoutInitEnv(t);

  const orderId = "78787878-7878-4878-8878-787878787878";
  const userId = "89898989-8989-4898-8898-898989898989";
  const paymentId = "90909090-9090-4090-8090-909090909090";

  let serviceRoleUpdateAttempted = false;

  const dependencies = createDependencies({
    getOrder: () => ({
      id: orderId,
      total_amount: 1750,
      currency: "EUR",
      status: "pending",
    }),
    getPendingPayment: () => ({
      id: paymentId,
      order_id: orderId,
      amount: "1250.00",
      currency: "TRY",
      status: "pending",
      provider_ref: paymentId,
    }),
    insertPayment: () => {
      throw new Error("insert should not be called when pending payment exists");
    },
    updatePayment: () => {
      serviceRoleUpdateAttempted = true;
      throw new Error("service-role update should not run for mismatched payments");
    },
    userId,
  });

  const response = await handleCheckoutInitPost(
    new Request("http://localhost:3000/api/checkout/init", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({ orderId }),
    }),
    dependencies,
  );

  assert.equal(response.status, 409);
  assert.equal(serviceRoleUpdateAttempted, false);

  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error, "Pending payment no longer matches order total");
});

test("checkout init does not rewrite terminal payment during callback race", async (t) => {
  setupCheckoutInitEnv(t);

  const orderId = "12121212-1212-4212-8212-121212121212";
  const userId = "34343434-3434-4434-8434-343434343434";
  const paymentId = "56565656-5656-4565-8565-565656565656";

  const state = {
    updateFilters: [] as Array<{ column: string; value: string }>,
  };

  const dependencies = createDependencies({
    getOrder: () => ({
      id: orderId,
      total_amount: 1500,
      currency: "USD",
      status: "pending",
    }),
    getPendingPayment: () => ({
      id: paymentId,
      order_id: orderId,
      amount: "1250.00",
      currency: "TRY",
      status: "pending",
      provider_ref: paymentId,
    }),
    insertPayment: () => {
      throw new Error("insert should not be called when pending payment exists");
    },
    updatePayment: (_payload, filters) => {
      state.updateFilters = filters;
      return {
        data: null,
        error: null,
      };
    },
    getPaymentById: () => ({
      id: paymentId,
      order_id: orderId,
      amount: "1250.00",
      currency: "TRY",
      status: "succeeded",
      provider_ref: paymentId,
    }),
    userId,
  });

  const response = await handleCheckoutInitPost(
    new Request("http://localhost:3000/api/checkout/init", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({ orderId }),
    }),
    dependencies,
  );

  assert.equal(response.status, 409);
  assert.deepEqual(state.updateFilters, []);

  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error, "Pending payment no longer matches order total");
});

test("checkout init does not emit hosted checkout when matching payment became terminal", async (t) => {
  setupCheckoutInitEnv(t);

  const orderId = "13131313-1313-4313-8313-131313131313";
  const userId = "24242424-2424-4424-8424-242424242424";
  const paymentId = "35353535-3535-4535-8535-353535353535";

  const dependencies = createDependencies({
    getOrder: () => ({
      id: orderId,
      total_amount: 1250,
      currency: "TRY",
      status: "pending",
    }),
    getPendingPayment: () => ({
      id: paymentId,
      order_id: orderId,
      amount: "1250.00",
      currency: "TRY",
      status: "pending",
      provider_ref: paymentId,
    }),
    insertPayment: () => {
      throw new Error("insert should not be called when pending payment exists");
    },
    getPaymentById: () => ({
      id: paymentId,
      order_id: orderId,
      amount: "1250.00",
      currency: "TRY",
      status: "succeeded",
      provider_ref: paymentId,
    }),
    userId,
  });

  const response = await handleCheckoutInitPost(
    new Request("http://localhost:3000/api/checkout/init", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({ orderId }),
    }),
    dependencies,
  );

  assert.equal(response.status, 409);

  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error, "Payment is no longer pending for checkout init");
});

function setupCheckoutInitEnv(
  t: TestContext,
  overrides?: {
    nodeEnv?: string;
    nextPublicSiteUrl?: string;
    siteUrl?: string;
    vercelUrl?: string;
  },
) {
  const originalEnv = {
    ISBANK_CLIENT_ID: process.env.ISBANK_CLIENT_ID,
    ISBANK_STORE_KEY: process.env.ISBANK_STORE_KEY,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    SITE_URL: process.env.SITE_URL,
    VERCEL_URL: process.env.VERCEL_URL,
  };

  t.after(() => {
    process.env.ISBANK_CLIENT_ID = originalEnv.ISBANK_CLIENT_ID;
    process.env.ISBANK_STORE_KEY = originalEnv.ISBANK_STORE_KEY;
    process.env.NODE_ENV = originalEnv.NODE_ENV;
    process.env.NEXT_PUBLIC_SITE_URL = originalEnv.NEXT_PUBLIC_SITE_URL;
    process.env.SITE_URL = originalEnv.SITE_URL;
    process.env.VERCEL_URL = originalEnv.VERCEL_URL;
  });

  process.env.ISBANK_CLIENT_ID = "7000679";
  process.env.ISBANK_STORE_KEY = "store-key-123";
  process.env.NODE_ENV = overrides?.nodeEnv ?? "test";
  process.env.SITE_URL = overrides?.siteUrl ?? "http://localhost:3000";
  process.env.NEXT_PUBLIC_SITE_URL = overrides?.nextPublicSiteUrl ?? "http://localhost:3000";

  if (overrides?.vercelUrl) {
    process.env.VERCEL_URL = overrides.vercelUrl;
  } else {
    delete process.env.VERCEL_URL;
  }
}

function createFailingDependencies(): CheckoutInitRouteDependencies {
  return {
    createRandomValue: () => {
      throw new Error("createRandomValue should not be called");
    },
    createServerSupabaseClient: async () => {
      throw new Error("createServerSupabaseClient should not be called");
    },
    createServiceRoleSupabaseClient: async () => {
      throw new Error("createServiceRoleSupabaseClient should not be called");
    },
  };
}

function createDependencies(input: {
  getOrder: () => Record<string, unknown> | null;
  getPendingPayment: () => Record<string, unknown> | null;
  createServerPaymentsClient?: () => {
    select: (columns: string) => ReturnType<typeof createQueryBuilder>;
    update?: (payload: Record<string, unknown>) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => {
          select: (columns: string) => {
            single: () => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
            maybeSingle: () => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
          };
        };
      };
    };
    insert?: (payload: Record<string, unknown>) => {
      select: (columns: string) => {
        single: () => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
      };
    };
  };
  insertPayment: (payload: Record<string, unknown>) => {
    data: unknown;
    error: { code?: string; message?: string } | null;
  };
  updatePayment?: (
    payload: Record<string, unknown>,
    filters: Array<{ column: string; value: string }>,
  ) => {
    data: unknown;
    error: { code?: string; message?: string } | null;
  };
  getPaymentById?: (paymentId: string) => Record<string, unknown> | null;
  userId: string | null;
}): CheckoutInitRouteDependencies {
  const createDefaultPaymentsClient = () => ({
    select: () =>
      createQueryBuilder((filters) => {
        if (filters.some((filter) => filter.column === "id")) {
          const paymentId = filters.find((filter) => filter.column === "id")?.value ?? "";
          const expectedStatus = filters.find((filter) => filter.column === "status")?.value;
          const payment = input.getPaymentById?.(paymentId) ?? null;

          if (
            payment
            && expectedStatus
            && typeof payment.status === "string"
            && payment.status !== expectedStatus
          ) {
            return {
              data: null,
              error: null,
            };
          }

          return {
            data: payment,
            error: null,
          };
        }

        return {
          data: input.getPendingPayment(),
          error: null,
        };
      }),
    update: input.updatePayment
      ? (payload: Record<string, unknown>) => ({
          eq: (column: string, value: string) => {
            const filters = [{ column, value }];
            const buildEq = () => ({
              eq: (nestedColumn: string, nestedValue: string) => {
                filters.push({ column: nestedColumn, value: nestedValue });
                return buildEq();
              },
              select: () => ({
                single: async () => input.updatePayment?.(payload, filters) ?? { data: null, error: null },
                maybeSingle: async () => input.updatePayment?.(payload, filters) ?? { data: null, error: null },
              }),
            });

            return buildEq();
          },
        })
      : undefined,
    insert: (payload: Record<string, unknown>) => ({
      select: () => ({
        single: async () => input.insertPayment(payload),
      }),
    }),
  });

  return {
    createRandomValue: () => "rnd-test",
    createServerSupabaseClient: async () => ({
      auth: {
        getUser: async () => ({
          data: {
            user: input.userId === null
              ? null
              : {
                  id: input.userId,
                },
          },
          error: null,
        }),
      },
      from: (table) => {
        if (table === "orders") {
          return {
            select: () =>
              createQueryBuilder(() => ({
                data: input.getOrder(),
                error: null,
              })),
          };
        }

        return input.createServerPaymentsClient?.() ?? createDefaultPaymentsClient();
      },
    }),
    createServiceRoleSupabaseClient: async () => ({
      from: () => createDefaultPaymentsClient(),
    }),
  };
}

function createQueryBuilder(
  executeMaybeSingle: (
    filters: Array<{ column: string; value: string }>,
  ) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }> | {
    data: unknown;
    error: { code?: string; message?: string } | null;
  },
) {
  const filters: Array<{ column: string; value: string }> = [];
  const query = {
    eq: (column: string, value: string) => {
      filters.push({ column, value });
      return query;
    },
    order: () => query,
    limit: () => query,
    maybeSingle: async () => executeMaybeSingle(filters),
  };

  return query;
}
