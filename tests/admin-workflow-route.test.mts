import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("admin workflow route fails closed when profile lookup fails", async (t) => {
  setupAdminWorkflowEnv(t);

  const response = await handleAdminCancelReservationPost(
    createJsonRequest({ reason: "customer_withdrew" }),
    createDependencies({
      profileError: {
        code: "57014",
        message: "statement timeout",
      },
      rpc: () => {
        throw new Error("rpc should not run when profile lookup fails");
      },
    }),
    { reservationId: "11111111-1111-4111-8111-111111111111" },
  );

  assert.equal(response.status, 500);

  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error, "Admin profile lookup failed");
});

test("admin workflow route trusts private SITE_URL and rejects NEXT_PUBLIC_SITE_URL when both are configured", async (t) => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousSiteUrl = process.env.SITE_URL;
  const previousPublicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const previousVercelUrl = process.env.VERCEL_URL;

  process.env.NODE_ENV = "production";
  process.env.SITE_URL = "https://admin.example.com/internal";
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.example.com";
  delete process.env.VERCEL_URL;

  t.after(() => {
    restoreEnv("NODE_ENV", previousNodeEnv);
    restoreEnv("SITE_URL", previousSiteUrl);
    restoreEnv("NEXT_PUBLIC_SITE_URL", previousPublicSiteUrl);
    restoreEnv("VERCEL_URL", previousVercelUrl);
  });

  const publicOriginResponse = await handleAdminCancelReservationPost(
    createJsonRequest(
      { reason: "customer_withdrew" },
      "https://www.example.com",
    ),
    createFailingDependencies(),
    { reservationId: "11111111-1111-4111-8111-111111111111" },
  );

  assert.equal(publicOriginResponse.status, 403);
  assert.equal((await publicOriginResponse.json()).error, "Admin workflow Origin is not trusted");

  const privateOriginResponse = await handleAdminCancelReservationPost(
    createJsonRequest(
      { reason: "customer_withdrew" },
      "https://admin.example.com",
    ),
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

  assert.equal(privateOriginResponse.status, 401);
  assert.equal((await privateOriginResponse.json()).error, "Authentication required");
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

test("admin confirm route maps invariant drift separately from validation errors", async (t) => {
  setupAdminWorkflowEnv(t);

  const legacyInvariantResponse = await handleAdminConfirmReservationPost(
    createJsonRequest({}),
    createDependencies({
      rpc: () => ({
        data: null,
        error: {
          code: "22023",
          message: "reservation ownership invariant violated: 11111111-1111-4111-8111-111111111111",
        },
      }),
    }),
    { reservationId: "11111111-1111-4111-8111-111111111111" },
  );

  assert.equal(legacyInvariantResponse.status, 500);
  assert.equal((await legacyInvariantResponse.json()).error, "Admin workflow invariant violation");

  const invariantResponse = await handleAdminConfirmReservationPost(
    createJsonRequest({}),
    createDependencies({
      rpc: () => ({
        data: null,
        error: {
          code: "P0004",
          message: "reservation confirm invariant drift: 11111111-1111-4111-8111-111111111111",
        },
      }),
    }),
    { reservationId: "11111111-1111-4111-8111-111111111111" },
  );

  assert.equal(invariantResponse.status, 500);
  assert.equal((await invariantResponse.json()).error, "Admin workflow invariant violation");

  const validationResponse = await handleAdminConfirmReservationPost(
    createJsonRequest({}),
    createDependencies({
      rpc: () => ({
        data: null,
        error: {
          code: "22023",
          message: "p_note is too long",
        },
      }),
    }),
    { reservationId: "11111111-1111-4111-8111-111111111111" },
  );

  assert.equal(validationResponse.status, 400);
  assert.equal((await validationResponse.json()).error, "Invalid admin workflow request");
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

test("admin workflow SQL keeps payment-first lock order aligned with payment callback", () => {
  const adminWorkflowSql = readFileSync(
    new URL("../supabase/migrations/20260423120000_25_admin_workflow_rpcs.sql", import.meta.url),
    "utf8",
  );
  const callbackSql = readFileSync(
    new URL("../supabase/migrations/20260423103000_23_remove_process_payment_test_hook.sql", import.meta.url),
    "utf8",
  );

  const callbackLockOrder = extractLockOrder(
    callbackSql,
    "internal.process_payment_checkout",
  );

  assert.deepEqual(callbackLockOrder, [
    "public.payments",
    "public.orders",
    "public.reservations",
    "public.listings",
  ]);

  assert.deepEqual(
    extractLockOrder(adminWorkflowSql, "internal.admin_cancel_reservation"),
    callbackLockOrder,
  );
  assert.deepEqual(
    extractLockOrder(adminWorkflowSql, "internal.admin_confirm_reservation"),
    callbackLockOrder,
  );
});

function createJsonRequest(payload: unknown, origin = "http://localhost:3000"): Request {
  return new Request("http://localhost:3000/api/admin/workflows/test", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
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
  profileError?: { code?: string | null; message?: string | null } | null;
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
              data: options.profileError
                ? null
                : {
                    role: options.getProfileRole?.() ?? "admin",
                  },
              error: options.profileError ?? null,
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

function extractLockOrder(sqlText: string, functionName: string): string[] {
  const functionBodyMatch = sqlText.match(
    new RegExp(
      `create\\s+or\\s+replace\\s+function\\s+${escapeRegExp(functionName)}\\([^]*?as\\s+\\$\\$([^]*?)\\$\\$;`,
      "i",
    ),
  );

  assert.ok(functionBodyMatch, `Expected to find function ${functionName}`);

  return functionBodyMatch[1]!
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => /for update$/i.test(statement))
    .map((statement) => {
      const fromMatch = statement.match(/from\s+(public\.(?:payments|orders|reservations|listings))/i);
      assert.ok(fromMatch, `Expected lock statement in ${functionName} to include a tracked table`);
      return fromMatch[1].toLowerCase();
    });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
