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

test("checkout init resolves pending payment after unique violation race", async (t) => {
  setupCheckoutInitEnv(t);

  const orderId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const userId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const racedPaymentId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  const state = {
    paymentSelectCallCount: 0,
    insertCallCount: 0,
  };

  const dependencies = createDependencies({
    getOrder: () => ({
      id: orderId,
      total_amount: 999.99,
      currency: "TRY",
      status: "pending",
    }),
    getPendingPayment: () => {
      state.paymentSelectCallCount += 1;
      if (state.paymentSelectCallCount === 1) {
        return null;
      }

      return {
        id: racedPaymentId,
        order_id: orderId,
        amount: "999.99",
        currency: "TRY",
        status: "pending",
        provider_ref: racedPaymentId,
      };
    },
    insertPayment: () => {
      state.insertCallCount += 1;
      return {
        data: null,
        error: {
          code: "23505",
          message:
            'duplicate key value violates unique constraint "payments_unique_pending_isbank_per_order"',
        },
      };
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
  assert.equal(state.insertCallCount, 1);
  assert.equal(state.paymentSelectCallCount, 2);

  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.data.payment.id, racedPaymentId);
  assert.equal(payload.data.payment.providerRef, racedPaymentId);
  assert.equal(payload.data.isbank.oid, racedPaymentId);
});

test("checkout init refreshes reused pending payment when order total changes", async (t) => {
  setupCheckoutInitEnv(t);

  const orderId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const userId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  const existingPaymentId = "ffffffff-ffff-4fff-8fff-ffffffffffff";

  const state = {
    serviceRoleUpdatePayloads: [] as Record<string, unknown>[],
  };

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
    updatePayment: (payload) => {
      state.serviceRoleUpdatePayloads.push(payload);
      return {
        data: {
          id: existingPaymentId,
          order_id: orderId,
          amount: "1500.00",
          currency: "USD",
          status: "pending",
          provider_ref: existingPaymentId,
        },
        error: null,
      };
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
  assert.equal(state.serviceRoleUpdatePayloads.length, 1);
  assert.deepEqual(state.serviceRoleUpdatePayloads[0], {
    amount: 1500,
    currency: "USD",
  });

  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.data.payment.id, existingPaymentId);
  assert.equal(payload.data.payment.amount, 1500);
  assert.equal(payload.data.payment.currency, "USD");
  assert.equal(payload.data.isbank.amount, "1500.00");
  assert.equal(payload.data.isbank.currency, "USD");
});

test("checkout init refreshes mismatched payment through service-role client", async (t) => {
  setupCheckoutInitEnv(t);

  const orderId = "78787878-7878-4878-8878-787878787878";
  const userId = "89898989-8989-4898-8898-898989898989";
  const paymentId = "90909090-9090-4090-8090-909090909090";

  let serverScopedUpdateAttempted = false;
  let serviceRoleUpdateCount = 0;

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
    createServerPaymentsClient: () => ({
      select: () =>
        createQueryBuilder(() => ({
          data: {
            id: paymentId,
            order_id: orderId,
            amount: "1250.00",
            currency: "TRY",
            status: "pending",
            provider_ref: paymentId,
          },
          error: null,
        })),
      update: () => {
        serverScopedUpdateAttempted = true;
        throw new Error("server-scoped client must not update payments");
      },
      insert: () => ({
        select: () => ({
          single: async () => ({ data: null, error: null }),
        }),
      }),
    }),
    updatePayment: () => {
      serviceRoleUpdateCount += 1;
      return {
        data: {
          id: paymentId,
          order_id: orderId,
          amount: "1750.00",
          currency: "EUR",
          status: "pending",
          provider_ref: paymentId,
        },
        error: null,
      };
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
  assert.equal(serverScopedUpdateAttempted, false);
  assert.equal(serviceRoleUpdateCount, 1);
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
  assert.deepEqual(state.updateFilters, [
    { column: "id", value: paymentId },
    { column: "status", value: "pending" },
  ]);

  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error, "Payment is no longer pending for checkout init");
});

function setupCheckoutInitEnv(t: TestContext) {
  const originalEnv = {
    ISBANK_CLIENT_ID: process.env.ISBANK_CLIENT_ID,
    ISBANK_STORE_KEY: process.env.ISBANK_STORE_KEY,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    SITE_URL: process.env.SITE_URL,
  };

  t.after(() => {
    process.env.ISBANK_CLIENT_ID = originalEnv.ISBANK_CLIENT_ID;
    process.env.ISBANK_STORE_KEY = originalEnv.ISBANK_STORE_KEY;
    process.env.NODE_ENV = originalEnv.NODE_ENV;
    process.env.NEXT_PUBLIC_SITE_URL = originalEnv.NEXT_PUBLIC_SITE_URL;
    process.env.SITE_URL = originalEnv.SITE_URL;
  });

  process.env.ISBANK_CLIENT_ID = "7000679";
  process.env.ISBANK_STORE_KEY = "store-key-123";
  process.env.NODE_ENV = "test";
  process.env.SITE_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
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
  userId: string;
}): CheckoutInitRouteDependencies {
  const createDefaultPaymentsClient = () => ({
    select: () =>
      createQueryBuilder((filters) => {
        if (filters.some((filter) => filter.column === "id")) {
          const paymentId = filters.find((filter) => filter.column === "id")?.value ?? "";
          return {
            data: input.getPaymentById?.(paymentId) ?? null,
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
            user: {
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
  ) => Promise<{ data: unknown; error: { message?: string } | null }> | {
    data: unknown;
    error: { message?: string } | null;
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
