import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { createClient } from "@supabase/supabase-js";

import { handlePaymentCallbackPost } from "../lib/payments/callback-route.ts";
import { buildIsbankSha1Input, sha1Upper } from "../lib/payments/isbank.ts";

type AnyObject = Record<string, unknown>;

test("payment callback smoke: local Supabase + signed payload completes checkout flow", async () => {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const storeKey = requireEnv("ISBANK_STORE_KEY");
  const isbankClientId = requireEnv("ISBANK_CLIENT_ID");

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const userId = await createSmokeUser(serviceClient);
  const listingId = randomUUID();
  const reservationId = randomUUID();
  const orderId = randomUUID();
  const paymentId = randomUUID();

  await insertListing(serviceClient, listingId);
  await insertReservation(serviceClient, {
    id: reservationId,
    listingId,
    userId,
  });
  await insertOrder(serviceClient, {
    id: orderId,
    reservationId,
    userId,
    totalAmount: 1250,
  });
  await insertPayment(serviceClient, {
    id: paymentId,
    orderId,
    userId,
    amount: 1250,
  });

  const callbackPayload = {
    clientid: isbankClientId,
    oid: paymentId,
    amount: "1250.00",
    currency: "TRY",
    okurl: "https://example.com/checkout/success",
    failurl: "https://example.com/checkout/fail",
    txnType: "Auth",
    instalment: "0",
    rnd: `smoke-${Date.now()}`,
    Response: "Approved",
    ProcReturnCode: "00",
  };
  const providedHash = sha1Upper(buildIsbankSha1Input(callbackPayload, storeKey));
  const formBody = new URLSearchParams(callbackPayload).toString();

  const sentEvents: string[] = [];
  const response = await handlePaymentCallbackPost(
    new Request("http://localhost/api/payment/callback", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-isbank-hash": providedHash,
      },
      body: formBody,
    }),
    {
      createSupabaseClient: createClient,
      sendInngestEvent: async (event) => {
        sentEvents.push(event.name);
      },
    },
  );

  const result = (await response.json()) as AnyObject;
  if (response.status !== 200) {
    throw new Error(
      `Smoke callback returned ${response.status}: ${JSON.stringify(result)}`,
    );
  }
  assert.equal(result.success, true);
  assert.equal((result.data as AnyObject)?.paymentId, paymentId);
  assert.equal((result.data as AnyObject)?.checkout, "succeeded");
  assert.deepEqual(sentEvents, ["payment/callback.received"]);

  const paymentRow = await selectSingle(serviceClient, "payments", "id,status,provider_ref", {
    id: paymentId,
  });
  assert.equal(paymentRow.status, "succeeded");
  assert.equal(paymentRow.provider_ref, paymentId);

  const orderRow = await selectSingle(serviceClient, "orders", "id,status", {
    id: orderId,
  });
  assert.equal(orderRow.status, "completed");

  const reservationRow = await selectSingle(serviceClient, "reservations", "id,status", {
    id: reservationId,
  });
  assert.equal(reservationRow.status, "confirmed");

  const listingRow = await selectSingle(serviceClient, "listings", "id,status", {
    id: listingId,
  });
  assert.equal(listingRow.status, "passive");

  const receiptRow = await selectSingle(
    serviceClient,
    "payment_callback_receipts",
    "id,provider",
    {
      provider: "isbank",
    },
  );
  assert.ok(typeof receiptRow.id === "string" && receiptRow.id.length > 0);

  const eventRows = await selectMany(
    serviceClient,
    "payment_events",
    "event_type,payment_id",
    { payment_id: paymentId },
  );
  assert.ok(
    eventRows.some((row) => row.event_type === "payment_checkout_succeeded"),
    "payment_checkout_succeeded event should be written",
  );
});

test("payment callback smoke: concurrent callback calls keep single success transition", async () => {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const storeKey = requireEnv("ISBANK_STORE_KEY");
  const isbankClientId = requireEnv("ISBANK_CLIENT_ID");

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const userId = await createSmokeUser(serviceClient);
  const listingId = randomUUID();
  const reservationId = randomUUID();
  const orderId = randomUUID();
  const paymentId = randomUUID();

  await insertListing(serviceClient, listingId);
  await insertReservation(serviceClient, {
    id: reservationId,
    listingId,
    userId,
  });
  await insertOrder(serviceClient, {
    id: orderId,
    reservationId,
    userId,
    totalAmount: 1250,
  });
  await insertPayment(serviceClient, {
    id: paymentId,
    orderId,
    userId,
    amount: 1250,
  });

  const callbackPayload = {
    clientid: isbankClientId,
    oid: paymentId,
    amount: "1250.00",
    currency: "TRY",
    okurl: "https://example.com/checkout/success",
    failurl: "https://example.com/checkout/fail",
    txnType: "Auth",
    instalment: "0",
    rnd: `smoke-concurrent-${Date.now()}`,
    Response: "Approved",
    ProcReturnCode: "00",
  };
  const providedHash = sha1Upper(buildIsbankSha1Input(callbackPayload, storeKey));
  const formBody = new URLSearchParams(callbackPayload).toString();

  const sentEvents: string[] = [];
  const runCallback = () =>
    handlePaymentCallbackPost(
      new Request("http://localhost/api/payment/callback", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "x-isbank-hash": providedHash,
        },
        body: formBody,
      }),
      {
        createSupabaseClient: createClient,
        sendInngestEvent: async (event) => {
          sentEvents.push(event.name);
        },
      },
    );

  const [responseA, responseB] = await Promise.all([runCallback(), runCallback()]);

  assert.equal(responseA.status, 200);
  assert.equal(responseB.status, 200);

  const resultA = (await responseA.json()) as AnyObject;
  const resultB = (await responseB.json()) as AnyObject;
  assert.equal(resultA.success, true);
  assert.equal(resultB.success, true);
  const duplicateCount = [resultA, resultB].filter(
    (result) => (result.data as AnyObject | undefined)?.duplicate === true,
  ).length;
  const processedCount = [resultA, resultB].filter(
    (result) => (result.data as AnyObject | undefined)?.duplicate === false,
  ).length;
  assert.equal(duplicateCount, 1);
  assert.equal(processedCount, 1);

  const paymentRow = await selectSingle(serviceClient, "payments", "id,status,provider_ref", {
    id: paymentId,
  });
  assert.equal(paymentRow.status, "succeeded");
  assert.equal(paymentRow.provider_ref, paymentId);

  const orderRow = await selectSingle(serviceClient, "orders", "id,status", {
    id: orderId,
  });
  assert.equal(orderRow.status, "completed");

  const reservationRow = await selectSingle(serviceClient, "reservations", "id,status", {
    id: reservationId,
  });
  assert.equal(reservationRow.status, "confirmed");

  const listingRow = await selectSingle(serviceClient, "listings", "id,status", {
    id: listingId,
  });
  assert.equal(listingRow.status, "passive");

  const eventRows = await selectMany(
    serviceClient,
    "payment_events",
    "event_type,payment_id",
    { payment_id: paymentId },
  );
  const succeededCount = eventRows.filter(
    (row) => row.event_type === "payment_checkout_succeeded",
  ).length;

  assert.equal(succeededCount, 1);
  assert.equal(
    eventRows.some((row) => row.event_type === "payment_checkout_idempotent"),
    false,
  );

  const { data: receiptRows, error: receiptError } = await serviceClient
    .from("payment_callback_receipts")
    .select("id,event_key")
    .eq("provider", "isbank")
    .like("event_key", `isbank:${paymentId.toUpperCase()}:%`);

  if (receiptError) {
    throw new Error(`Failed to fetch callback receipts: ${receiptError.message}`);
  }

  assert.equal((receiptRows ?? []).length, 1);
  assert.equal(
    sentEvents.filter((name) => name === "payment/callback.received").length,
    1,
  );
});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required for payment callback smoke test`);
  }

  return value.trim();
}

async function createSmokeUser(serviceClient: ReturnType<typeof createClient>): Promise<string> {
  const email = `payment-smoke-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    email_confirm: true,
    password: "SmokeTest!123456",
    user_metadata: {
      full_name: "Payment Callback Smoke User",
    },
  });

  if (error || !data.user?.id) {
    throw new Error(`Failed to create smoke user: ${error?.message ?? "unknown error"}`);
  }

  return data.user.id;
}

async function insertListing(
  serviceClient: ReturnType<typeof createClient>,
  listingId: string,
): Promise<void> {
  const { error } = await serviceClient.from("listings").insert({
    id: listingId,
    type: "rent",
    status: "active",
    title: "Smoke Listing",
    slug: `payment-callback-smoke-${listingId}`,
    city: "Istanbul",
    price: 1250,
    currency: "TRY",
  });

  if (error) {
    throw new Error(`Failed to insert listing: ${error.message}`);
  }
}

async function insertReservation(
  serviceClient: ReturnType<typeof createClient>,
  input: { id: string; listingId: string; userId: string },
): Promise<void> {
  const { error } = await serviceClient.from("reservations").insert({
    id: input.id,
    listing_id: input.listingId,
    user_id: input.userId,
    move_in_date: "2026-05-01",
    stay_months: 6,
    guest_count: 1,
    status: "pending",
  });

  if (error) {
    throw new Error(`Failed to insert reservation: ${error.message}`);
  }
}

async function insertOrder(
  serviceClient: ReturnType<typeof createClient>,
  input: {
    id: string;
    reservationId: string;
    userId: string;
    totalAmount: number;
  },
): Promise<void> {
  const { error } = await serviceClient.from("orders").insert({
    id: input.id,
    reservation_id: input.reservationId,
    user_id: input.userId,
    total_amount: input.totalAmount,
    currency: "TRY",
    status: "pending",
  });

  if (error) {
    throw new Error(`Failed to insert order: ${error.message}`);
  }
}

async function insertPayment(
  serviceClient: ReturnType<typeof createClient>,
  input: { id: string; orderId: string; userId: string; amount: number },
): Promise<void> {
  const { error } = await serviceClient.from("payments").insert({
    id: input.id,
    order_id: input.orderId,
    user_id: input.userId,
    amount: input.amount,
    currency: "TRY",
    status: "pending",
    provider: "isbank",
  });

  if (error) {
    throw new Error(`Failed to insert payment: ${error.message}`);
  }
}

async function selectSingle(
  serviceClient: ReturnType<typeof createClient>,
  table: string,
  columns: string,
  equalities: Record<string, string>,
): Promise<AnyObject> {
  let query = serviceClient.from(table).select(columns);
  for (const [column, value] of Object.entries(equalities)) {
    query = query.eq(column, value);
  }

  const { data, error } = await query.single();
  if (error || !data) {
    throw new Error(`Failed to fetch ${table}: ${error?.message ?? "not found"}`);
  }

  return data as AnyObject;
}

async function selectMany(
  serviceClient: ReturnType<typeof createClient>,
  table: string,
  columns: string,
  equalities: Record<string, string>,
): Promise<AnyObject[]> {
  let query = serviceClient.from(table).select(columns);
  for (const [column, value] of Object.entries(equalities)) {
    query = query.eq(column, value);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch ${table}: ${error.message}`);
  }

  return (data ?? []) as AnyObject[];
}
