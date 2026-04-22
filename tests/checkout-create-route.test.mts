import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import test from "node:test";

import {
  handleCheckoutCreatePost,
  type CheckoutCreateRouteDependencies,
} from "../lib/payments/checkout-create-route.ts";

const validCheckoutCreatePayload = {
  listing_id: "11111111-1111-4111-8111-111111111111",
  move_in_date: "2026-05-20",
  stay_months: 6,
  guest_count: 2,
  main_items: [" Deposit "],
  service_items: [" Cleaning "],
  note: "  Lutfen ogleden sonra arayin.  ",
};

test("checkout create rejects non-json state-changing requests before auth", async (t) => {
  setupCheckoutCreateEnv(t);

  const response = await handleCheckoutCreatePost(
    new Request("http://localhost:3000/api/checkout", {
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
  assert.equal(payload.error, "Checkout create requires application/json");
});

test("checkout create rejects untrusted origins before auth", async (t) => {
  setupCheckoutCreateEnv(t);

  const response = await handleCheckoutCreatePost(
    new Request("http://localhost:3000/api/checkout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://evil.example",
      },
      body: JSON.stringify(validCheckoutCreatePayload),
    }),
    createFailingDependencies(),
  );

  assert.equal(response.status, 403);

  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error, "Checkout create Origin is not trusted");
});

test("checkout create rejects oversized bodies before auth", async (t) => {
  setupCheckoutCreateEnv(t);

  const response = await handleCheckoutCreatePost(
    new Request("http://localhost:3000/api/checkout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        ...validCheckoutCreatePayload,
        note: "a".repeat(20 * 1024),
      }),
    }),
    createFailingDependencies(),
  );

  assert.equal(response.status, 413);

  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error, "Checkout create payload is too large");
});

test("checkout create rejects unauthenticated requests", async (t) => {
  setupCheckoutCreateEnv(t);

  const response = await handleCheckoutCreatePost(
    createJsonRequest(validCheckoutCreatePayload),
    createDependencies({
      userId: null,
      rpc: () => {
        throw new Error("rpc should not be called without a user");
      },
    }),
  );

  assert.equal(response.status, 401);

  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error, "Authentication required");
});

test("checkout create rejects invalid request bodies", async (t) => {
  setupCheckoutCreateEnv(t);

  const response = await handleCheckoutCreatePost(
    createJsonRequest({
      ...validCheckoutCreatePayload,
      total: 100,
    }),
    createDependencies({
      rpc: () => {
        throw new Error("rpc should not be called for invalid input");
      },
    }),
  );

  assert.equal(response.status, 400);

  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error, "Client-supplied totals are not accepted");
});

test("checkout create sends normalized checkout intent to create_checkout RPC", async (t) => {
  setupCheckoutCreateEnv(t);

  const calls: Array<{ functionName: string; args: Record<string, unknown> }> = [];
  const response = await handleCheckoutCreatePost(
    createJsonRequest({
      ...validCheckoutCreatePayload,
      listing_id: " 11111111-1111-4111-8111-AAAAAAAAAAAA ",
    }),
    createDependencies({
      rpc: (functionName, args) => {
        calls.push({ functionName, args });
        return {
          data: {
            result: "created",
            reservation_id: "22222222-2222-4222-8222-222222222222",
            order_id: "33333333-3333-4333-8333-333333333333",
            payment_id: "44444444-4444-4444-8444-444444444444",
            listing_id: "11111111-1111-4111-8111-aaaaaaaaaaaa",
            total_amount: "1250.00",
            currency: "try",
            payment_status: "pending",
          },
          error: null,
        };
      },
    }),
  );

  assert.equal(response.status, 201);
  assert.deepEqual(calls, [
    {
      functionName: "create_checkout",
      args: {
        p_listing_id: "11111111-1111-4111-8111-aaaaaaaaaaaa",
        p_move_in_date: "2026-05-20",
        p_stay_months: 6,
        p_guest_count: 2,
        p_main_item_codes: ["deposit"],
        p_service_item_codes: ["cleaning"],
        p_note: "Lutfen ogleden sonra arayin.",
      },
    },
  ]);

  const payload = await response.json();
  assert.deepEqual(payload, {
    success: true,
    data: {
      reservation: {
        id: "22222222-2222-4222-8222-222222222222",
      },
      order: {
        id: "33333333-3333-4333-8333-333333333333",
        totalAmount: 1250,
        currency: "TRY",
      },
      payment: {
        id: "44444444-4444-4444-8444-444444444444",
        status: "pending",
      },
      listing: {
        id: "11111111-1111-4111-8111-aaaaaaaaaaaa",
      },
    },
  });
});

test("checkout create maps unavailable listing RPC errors to 409", async (t) => {
  setupCheckoutCreateEnv(t);

  const response = await handleCheckoutCreatePost(
    createJsonRequest(validCheckoutCreatePayload),
    createDependencies({
      rpc: () => ({
        data: null,
        error: {
          code: "P0002",
          message: "listing is not available for checkout: 11111111-1111-4111-8111-111111111111",
        },
      }),
    }),
  );

  assert.equal(response.status, 409);

  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error, "Listing is not available for checkout");
});

test("checkout create maps inactive listing RPC errors to 409", async (t) => {
  setupCheckoutCreateEnv(t);

  const response = await handleCheckoutCreatePost(
    createJsonRequest(validCheckoutCreatePayload),
    createDependencies({
      rpc: () => ({
        data: null,
        error: {
          code: "P0002",
          message: "listing is not available for checkout: inactive listing",
        },
      }),
    }),
  );

  assert.equal(response.status, 409);

  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error, "Listing is not available for checkout");
});

test("checkout create maps item configuration RPC errors to 400", async (t) => {
  setupCheckoutCreateEnv(t);

  const response = await handleCheckoutCreatePost(
    createJsonRequest(validCheckoutCreatePayload),
    createDependencies({
      rpc: () => ({
        data: null,
        error: {
          code: "P0001",
          message: "main item is not enabled for listing: deposit",
        },
      }),
    }),
  );

  assert.equal(response.status, 400);

  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error, "Checkout item selection is not valid for this listing");
});

test("checkout create rejects malformed RPC success payloads", async (t) => {
  setupCheckoutCreateEnv(t);

  const response = await handleCheckoutCreatePost(
    createJsonRequest(validCheckoutCreatePayload),
    createDependencies({
      rpc: () => ({
        data: {
          result: "created",
          payment_status: "succeeded",
        },
        error: null,
      }),
    }),
  );

  assert.equal(response.status, 500);

  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error, "Invalid checkout create RPC response");
});

function createJsonRequest(payload: unknown): Request {
  return new Request("http://localhost:3000/api/checkout", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify(payload),
  });
}

function createFailingDependencies(): CheckoutCreateRouteDependencies {
  return {
    createServerSupabaseClient: async () => {
      throw new Error("Supabase client should not be created");
    },
  };
}

function createDependencies(options: {
  userId?: string | null;
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => { data: unknown; error: { code?: string | null; message?: string | null } | null };
}): CheckoutCreateRouteDependencies {
  return {
    createServerSupabaseClient: async () => ({
      auth: {
        getUser: async () => ({
          data: {
            user: options.userId === null
              ? null
              : { id: options.userId ?? "55555555-5555-4555-8555-555555555555" },
          },
          error: null,
        }),
      },
      rpc: async (functionName: string, args: Record<string, unknown>) =>
        options.rpc(functionName, args),
    }),
  };
}

function setupCheckoutCreateEnv(t: TestContext): void {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousSiteUrl = process.env.SITE_URL;
  const previousPublicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const previousVercelUrl = process.env.VERCEL_URL;

  process.env.NODE_ENV = "test";
  delete process.env.SITE_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.VERCEL_URL;

  t.after(() => {
    restoreEnv("NODE_ENV", previousNodeEnv);
    restoreEnv("SITE_URL", previousSiteUrl);
    restoreEnv("NEXT_PUBLIC_SITE_URL", previousPublicSiteUrl);
    restoreEnv("VERCEL_URL", previousVercelUrl);
  });
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
