import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import test from "node:test";

import {
  handleAdminCancelReservationPost,
  handleAdminConfirmReservationPost,
  handleAdminReopenListingPost,
  type AdminWorkflowRouteDependencies,
} from "../lib/admin/workflow-route.ts";

test("admin cancel route rejects non-json requests before auth", async (t) => {
  setupAdminWorkflowEnv(t);

  const response = await handleAdminCancelReservationPost(
    new Request("http://localhost:3000/api/admin/workflows/reservations/id/cancel", {
      method: "POST",
      headers: {
        "content-type": "text/plain",
        origin: "http://localhost:3000",
      },
      body: "not-json",
    }),
    createFailingDependencies(),
    { reservationId: "11111111-1111-4111-8111-111111111111" },
  );

  assert.equal(response.status, 415);

  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error, "Admin workflow requires application/json");
});

test("admin cancel route rejects unauthenticated requests", async (t) => {
  setupAdminWorkflowEnv(t);

  const response = await handleAdminCancelReservationPost(
    createJsonRequest({ reason: "customer_withdrew" }),
    createDependencies({
      userId: null,
      getProfileRole: () => {
        throw new Error("profile lookup should not run without auth");
      },
      rpc: () => {
        throw new Error("rpc should not run without auth");
      },
    }),
    { reservationId: "11111111-1111-4111-8111-111111111111" },
  );

  assert.equal(response.status, 401);

  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error, "Authentication required");
});

test("admin cancel route rejects non-admin users before RPC", async (t) => {
  setupAdminWorkflowEnv(t);

  const response = await handleAdminCancelReservationPost(
    createJsonRequest({ reason: "customer_withdrew" }),
    createDependencies({
      getProfileRole: () => "editor",
      rpc: () => {
        throw new Error("rpc should not run for non-admin");
      },
    }),
    { reservationId: "11111111-1111-4111-8111-111111111111" },
  );

  assert.equal(response.status, 403);

  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error, "Admin role required");
});

test("admin cancel route validates reservation id and request body", async (t) => {
  setupAdminWorkflowEnv(t);

  const invalidIdResponse = await handleAdminCancelReservationPost(
    createJsonRequest({ reason: "customer_withdrew" }),
    createDependencies({
      rpc: () => {
        throw new Error("rpc should not run for invalid route params");
      },
    }),
    { reservationId: "not-a-uuid" },
  );

  assert.equal(invalidIdResponse.status, 400);
  assert.equal((await invalidIdResponse.json()).error, "Invalid reservation id");

  const invalidBodyResponse = await handleAdminCancelReservationPost(
    createJsonRequest({ note: "missing reason" }),
    createDependencies({
      rpc: () => {
        throw new Error("rpc should not run for invalid body");
      },
    }),
    { reservationId: "11111111-1111-4111-8111-111111111111" },
  );

  assert.equal(invalidBodyResponse.status, 400);
  assert.equal((await invalidBodyResponse.json()).error, "Admin cancel reason is required");
});

test("admin cancel route calls admin_cancel_reservation RPC with normalized input", async (t) => {
  setupAdminWorkflowEnv(t);

  const calls: Array<{ functionName: string; args: Record<string, unknown> }> = [];
  const response = await handleAdminCancelReservationPost(
    createJsonRequest({
      reason: "  customer_withdrew_before_payment  ",
      note: "  customer changed plans  ",
    }),
    createDependencies({
      rpc: (functionName, args) => {
        calls.push({ functionName, args });
        return {
          data: {
            result: "cancelled",
            event_id: "22222222-2222-4222-8222-222222222222",
            reservation_id: "11111111-1111-4111-8111-111111111111",
            order_id: "33333333-3333-4333-8333-333333333333",
            payment_id: "44444444-4444-4444-8444-444444444444",
            listing_id: "55555555-5555-4555-8555-555555555555",
            reservation_status: "cancelled",
            order_status: "cancelled",
            payment_status: "cancelled",
            listing_status: "active",
          },
          error: null,
        };
      },
    }),
    { reservationId: "11111111-1111-4111-8111-111111111111" },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [
    {
      functionName: "admin_cancel_reservation",
      args: {
        p_reservation_id: "11111111-1111-4111-8111-111111111111",
        p_cancel_reason: "customer_withdrew_before_payment",
        p_note: "customer changed plans",
      },
    },
  ]);

  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.data.result, "cancelled");
  assert.equal(payload.data.eventId, "22222222-2222-4222-8222-222222222222");
  assert.equal(payload.data.reservation.status, "cancelled");
  assert.equal(payload.data.order.status, "cancelled");
  assert.equal(payload.data.payment.status, "cancelled");
  assert.equal(payload.data.listing.status, "active");
});

test("admin confirm route accepts optional note and maps not found/conflict errors", async (t) => {
  setupAdminWorkflowEnv(t);

  const notFoundResponse = await handleAdminConfirmReservationPost(
    createJsonRequest({ note: "  docs completed  " }),
    createDependencies({
      rpc: () => ({
        data: null,
        error: {
          code: "P0002",
          message: "reservation not found: 11111111-1111-4111-8111-111111111111",
        },
      }),
    }),
    { reservationId: "11111111-1111-4111-8111-111111111111" },
  );

  assert.equal(notFoundResponse.status, 404);
  assert.equal((await notFoundResponse.json()).error, "Reservation not found");

  const conflictResponse = await handleAdminConfirmReservationPost(
    createJsonRequest({}),
    createDependencies({
      rpc: () => ({
        data: null,
        error: {
          code: "P0001",
          message: "reservation cannot be confirmed without succeeded payment",
        },
      }),
    }),
    { reservationId: "11111111-1111-4111-8111-111111111111" },
  );

  assert.equal(conflictResponse.status, 409);
  assert.equal((await conflictResponse.json()).error, "Admin workflow conflict");
});

test("admin confirm route calls admin_confirm_reservation RPC and returns summary", async (t) => {
  setupAdminWorkflowEnv(t);

  const calls: Array<{ functionName: string; args: Record<string, unknown> }> = [];
  const response = await handleAdminConfirmReservationPost(
    createJsonRequest({
      note: "  documents completed in backoffice  ",
    }),
    createDependencies({
      rpc: (functionName, args) => {
        calls.push({ functionName, args });
        return {
          data: {
            result: "confirmed",
            event_id: "99999999-9999-4999-8999-999999999999",
            reservation_id: "11111111-1111-4111-8111-111111111111",
            order_id: "33333333-3333-4333-8333-333333333333",
            payment_id: "44444444-4444-4444-8444-444444444444",
            listing_id: "55555555-5555-4555-8555-555555555555",
            reservation_status: "confirmed",
            order_status: "completed",
            payment_status: "succeeded",
            listing_status: "passive",
          },
          error: null,
        };
      },
    }),
    { reservationId: "11111111-1111-4111-8111-111111111111" },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [
    {
      functionName: "admin_confirm_reservation",
      args: {
        p_reservation_id: "11111111-1111-4111-8111-111111111111",
        p_note: "documents completed in backoffice",
      },
    },
  ]);

  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.data.result, "confirmed");
  assert.equal(payload.data.listing.status, "passive");
});

test("admin reopen route validates reason and maps rpc response", async (t) => {
  setupAdminWorkflowEnv(t);

  const invalidBodyResponse = await handleAdminReopenListingPost(
    createJsonRequest({ note: "missing reason" }),
    createDependencies({
      rpc: () => {
        throw new Error("rpc should not run for invalid body");
      },
    }),
    { listingId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
  );

  assert.equal(invalidBodyResponse.status, 400);
  assert.equal((await invalidBodyResponse.json()).error, "Admin reopen reason is required");

  const response = await handleAdminReopenListingPost(
    createJsonRequest({
      reason: "  paperwork completed  ",
      note: "  refund completed offline  ",
    }),
    createDependencies({
      rpc: () => ({
        data: {
          result: "reopened",
          event_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          listing_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          listing_status: "active",
        },
        error: null,
      }),
    }),
    { listingId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
  );

  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.data.result, "reopened");
  assert.equal(payload.data.eventId, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  assert.equal(payload.data.listing.status, "active");
});

function createJsonRequest(payload: unknown): Request {
  return new Request("http://localhost:3000/api/admin/workflows/test", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify(payload),
  });
}

function createFailingDependencies(): AdminWorkflowRouteDependencies {
  return {
    createServerSupabaseClient: async () => {
      throw new Error("Supabase client should not be created");
    },
  };
}

function createDependencies(options: {
  userId?: string | null;
  getProfileRole?: () => string | null;
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => { data: unknown; error: { code?: string | null; message?: string | null } | null };
}): AdminWorkflowRouteDependencies {
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
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                role: options.getProfileRole?.() ?? "admin",
              },
              error: null,
            }),
          }),
        }),
      }),
      rpc: async (functionName: string, args: Record<string, unknown>) =>
        options.rpc(functionName, args),
    }),
  };
}

function setupAdminWorkflowEnv(t: TestContext): void {
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
