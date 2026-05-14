import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { createClient } from "@supabase/supabase-js";

import { handlePaymentCallbackPost } from "../lib/payments/callback-route.ts";
import { buildIsbankSha1Input, sha1Upper } from "../lib/payments/isbank.ts";

type AnyObject = Record<string, unknown>;

test("payment callback smoke: local Supabase + signed payload completes checkout flow", async () => {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
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

  const adminClient = await createSeedAdminClient(supabaseUrl, publishableKey);

  await insertListing(serviceClient, adminClient, listingId);
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

  const { data: receiptRow, error: receiptError } = await serviceClient
    .from("payment_callback_receipts")
    .select("id,provider")
    .eq("provider", "isbank")
    .like("event_key", `isbank:${paymentId.toUpperCase()}:%`)
    .single();

  if (receiptError || !receiptRow) {
    throw new Error(
      `Failed to fetch payment callback receipt: ${receiptError?.message ?? "not found"}`,
    );
  }

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
  const publishableKey = requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
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

  const adminClient = await createSeedAdminClient(supabaseUrl, publishableKey);

  await insertListing(serviceClient, adminClient, listingId);
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

  const responses = [responseA, responseB];
  assert.ok(
    responses.some((response) => response.status === 200),
    `Expected one callback to finish processing, got ${responses.map((response) => response.status).join(", ")}`,
  );
  assert.ok(
    responses.every((response) => response.status === 200 || response.status === 409),
    `Expected one processed callback and one duplicate/in-flight response, got ${responses.map((response) => response.status).join(", ")}`,
  );

  const results = await Promise.all(
    responses.map(async (response) => ({
      status: response.status,
      body: (await response.json()) as AnyObject,
    })),
  );
  const duplicateCount = results.filter(
    (result) => (result.body.data as AnyObject | undefined)?.duplicate === true,
  ).length;
  const processedCount = results.filter(
    (result) =>
      result.status === 200 &&
      result.body.success === true &&
      (result.body.data as AnyObject | undefined)?.duplicate === false,
  ).length;
  const inFlightCount = results.filter(
    (result) =>
      result.status === 409 &&
      result.body.success === false &&
      result.body.error === "Payment callback is being processed by another request",
  ).length;
  assert.equal(processedCount, 1);
  assert.equal(duplicateCount + inFlightCount, 1);

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

async function createSeedAdminClient(
  supabaseUrl: string,
  publishableKey: string,
): Promise<ReturnType<typeof createClient>> {
  const adminClient = createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error } = await adminClient.auth.signInWithPassword({
    email: "smoke-admin@example.test",
    password: "smoke-admin-2026",
  });

  if (error) {
    throw new Error(`Failed to sign in smoke admin: ${error.message}`);
  }

  return adminClient;
}

async function insertListing(
  serviceClient: ReturnType<typeof createClient>,
  adminClient: ReturnType<typeof createClient>,
  listingId: string,
): Promise<void> {
  const mainItemId = await ensureSmokeMainItem(serviceClient, listingId);
  const { error } = await serviceClient.from("listings").insert({
    id: listingId,
    type: "rent",
    status: "passive",
    title: "Smoke Listing",
    slug: `payment-callback-smoke-${listingId}`,
    summary: "Smoke listing for payment callback tests",
    description: "Smoke listing for payment callback tests",
    city: "Istanbul",
    district: "Kadikoy",
    price: 1250,
    currency: "TRY",
    room_count: 2,
    bathroom_count: 1,
    gross_area_m2: 90,
    is_furnished: false,
  });

  if (error) {
    throw new Error(`Failed to insert listing: ${error.message}`);
  }

  const { error: imageError } = await serviceClient.from("listing_images").insert({
    listing_id: listingId,
    image_url: `https://example.com/payment-callback-smoke-${listingId}.jpg`,
    alt_text: "Payment callback smoke listing",
    sort_order: 0,
    is_primary: true,
  });

  if (imageError) {
    throw new Error(`Failed to insert listing image: ${imageError.message}`);
  }

  const { error: mainItemError } = await serviceClient.from("listing_main_item_options").insert({
    listing_id: listingId,
    main_item_id: mainItemId,
    is_enabled: true,
    sort_order: 10,
  });

  if (mainItemError) {
    throw new Error(`Failed to insert listing main item: ${mainItemError.message}`);
  }

  const { error: statusError } = await adminClient.rpc("admin_set_listing_status", {
    p_listing_id: listingId,
    p_status: "active",
  });

  if (statusError) {
    throw new Error(`Failed to activate listing: ${statusError.message}`);
  }
}

async function ensureSmokeMainItem(
  serviceClient: ReturnType<typeof createClient>,
  listingId: string,
): Promise<string> {
  const { data: existing, error: existingError } = await serviceClient
    .from("main_item_catalog")
    .select("id")
    .eq("code", "payment_callback_smoke_deposit")
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to fetch smoke main item: ${existingError.message}`);
  }

  if (typeof existing?.id === "string") {
    return existing.id;
  }

  const mainItemId = randomUUID();
  const { error } = await serviceClient.from("main_item_catalog").insert({
    id: mainItemId,
    code: "payment_callback_smoke_deposit",
    label: "Payment Callback Smoke Deposit",
    description: "Checkout item for payment callback smoke tests",
    pricing_strategy: "listing_price_multiplier",
    default_multiplier: 1,
    is_active: true,
    sort_order: 10,
  });

  if (error) {
    throw new Error(`Failed to insert smoke main item for ${listingId}: ${error.message}`);
  }

  return mainItemId;
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
