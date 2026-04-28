import assert from "node:assert/strict";
import test from "node:test";

import {
  handleAdminListingWorkflowSnapshotGet,
  handleAdminReservationWorkflowSnapshotGet,
  type AdminWorkflowSnapshotRouteDependencies,
} from "../lib/admin/workflow-snapshot-route.ts";

type SnapshotSurface = {
  name: "reservation" | "listing";
  handle: (
    request: Request,
    dependencies: AdminWorkflowSnapshotRouteDependencies,
  ) => Promise<Response>;
  invalidId: string;
  validId: string;
  expectedInvalidIdError: string;
  rpcName: "get_admin_reservation_workflow_snapshot" | "get_admin_listing_workflow_snapshot";
  rpcArgKey: "p_reservation_id" | "p_listing_id";
  notFoundError: string;
  successPayload: Record<string, unknown>;
};

const SNAPSHOT_SURFACES: SnapshotSurface[] = [
  {
    name: "reservation",
    handle: (request, dependencies) =>
      handleAdminReservationWorkflowSnapshotGet(request, dependencies, {
        reservationId: "11111111-1111-4111-8111-111111111111",
      }),
    invalidId: "not-a-uuid",
    validId: "11111111-1111-4111-8111-111111111111",
    expectedInvalidIdError: "Invalid reservation id",
    rpcName: "get_admin_reservation_workflow_snapshot",
    rpcArgKey: "p_reservation_id",
    notFoundError: "Reservation not found",
    successPayload: {
      reservation: {
        id: "11111111-1111-4111-8111-111111111111",
        status: "pending",
        move_in_date: "2026-05-01",
        stay_months: 6,
      },
      order: {
        id: "22222222-2222-4222-8222-222222222222",
        status: "pending",
        total_amount: 25000,
        currency: "TRY",
      },
      payment: {
        id: "33333333-3333-4333-8333-333333333333",
        status: "succeeded",
        amount: 25000,
        currency: "TRY",
      },
      listing: {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        status: "passive",
      },
      contact: {
        fullName: "Ada Lovelace",
        phone: "+905551112233",
        email: "ada@example.com",
        preferredContactMethod: "whatsapp",
        preferredContactTime: "afternoon",
        occupantFullName: "Ada Lovelace",
        documentReadiness: "ready",
        note: "Prefers WhatsApp first",
      },
      latest_event: {
        id: "44444444-4444-4444-8444-444444444444",
        workflow_name: "admin_confirm_reservation",
        reason: null,
        note: "documents completed",
        created_at: "2026-04-25T10:00:00.000Z",
      },
      eligibility: {
        can_cancel: false,
        can_confirm: true,
      },
    },
  },
  {
    name: "listing",
    handle: (request, dependencies) =>
      handleAdminListingWorkflowSnapshotGet(request, dependencies, {
        listingId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      }),
    invalidId: "bad-id",
    validId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    expectedInvalidIdError: "Invalid listing id",
    rpcName: "get_admin_listing_workflow_snapshot",
    rpcArgKey: "p_listing_id",
    notFoundError: "Listing not found",
    successPayload: {
      listing: {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        status: "passive",
      },
      latest_event: {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        workflow_name: "admin_reopen_listing",
        reason: "documents_failed",
        note: "manual follow-up required",
        created_at: "2026-04-25T10:05:00.000Z",
      },
      eligibility: {
        can_reopen: false,
      },
    },
  },
];

test("admin workflow snapshot surfaces reject unauthenticated requests", async () => {
  for (const surface of SNAPSHOT_SURFACES) {
    const response = await surface.handle(
      createGetRequest(),
      createDependencies({
        userId: null,
        rpc: () => {
          throw new Error("rpc should not run without auth");
        },
      }),
    );

    assert.equal(response.status, 401, `${surface.name} surface status`);
    assert.equal((await response.json()).error, "Authentication required", `${surface.name} surface payload.error`);
  }
});

test("admin workflow snapshot surfaces reject non-admin users before RPC", async () => {
  for (const surface of SNAPSHOT_SURFACES) {
    const response = await surface.handle(
      createGetRequest(),
      createDependencies({
        getProfileRole: () => "editor",
        rpc: () => {
          throw new Error("rpc should not run for non-admin");
        },
      }),
    );

    assert.equal(response.status, 403, `${surface.name} surface status`);
    assert.equal((await response.json()).error, "Admin role required", `${surface.name} surface payload.error`);
  }
});

test("admin workflow snapshot surfaces fail closed when profile lookup fails", async () => {
  for (const surface of SNAPSHOT_SURFACES) {
    const response = await surface.handle(
      createGetRequest(),
      createDependencies({
        profileError: {
          code: "57014",
          message: "statement timeout",
        },
        rpc: () => {
          throw new Error("rpc should not run when profile lookup fails");
        },
      }),
    );

    assert.equal(response.status, 500, `${surface.name} surface status`);
    assert.equal((await response.json()).error, "Admin profile lookup failed", `${surface.name} surface payload.error`);
  }
});

test("admin workflow snapshot surfaces validate route params before RPC", async () => {
  const reservationResponse = await handleAdminReservationWorkflowSnapshotGet(
    createGetRequest(),
    createDependencies({
      rpc: () => {
        throw new Error("rpc should not run for invalid reservation id");
      },
    }),
    { reservationId: "not-a-uuid" },
  );

  assert.equal(reservationResponse.status, 400);
  assert.equal((await reservationResponse.json()).error, "Invalid reservation id");

  const listingResponse = await handleAdminListingWorkflowSnapshotGet(
    createGetRequest(),
    createDependencies({
      rpc: () => {
        throw new Error("rpc should not run for invalid listing id");
      },
    }),
    { listingId: "bad-id" },
  );

  assert.equal(listingResponse.status, 400);
  assert.equal((await listingResponse.json()).error, "Invalid listing id");
});

test("admin workflow snapshot surfaces map not found RPC errors", async () => {
  for (const surface of SNAPSHOT_SURFACES) {
    const response = await surface.handle(
      createGetRequest(),
      createDependencies({
        rpc: () => ({
          data: null,
          error: {
            code: "P0002",
            message: `${surface.name} not found`,
          },
        }),
      }),
    );

    assert.equal(response.status, 404, `${surface.name} surface status`);
    assert.equal((await response.json()).error, surface.notFoundError, `${surface.name} surface payload.error`);
  }
});

test("admin workflow snapshot surfaces fail closed on invariant drift", async () => {
  for (const surface of SNAPSHOT_SURFACES) {
    const response = await surface.handle(
      createGetRequest(),
      createDependencies({
        rpc: () => ({
          data: null,
          error: {
            code: "P0004",
            message: `${surface.name} invariant drift`,
          },
        }),
      }),
    );

    assert.equal(response.status, 500, `${surface.name} surface status`);
    assert.equal((await response.json()).error, "Admin workflow invariant violation", `${surface.name} surface payload.error`);
  }
});

test("admin reservation workflow snapshot route calls RPC and returns no-store payload", async () => {
  const calls: Array<{ functionName: string; args: Record<string, unknown> }> = [];
  const surface = SNAPSHOT_SURFACES[0]!;

  const response = await surface.handle(
    createGetRequest(),
    createDependencies({
      rpc: (functionName, args) => {
        calls.push({ functionName, args });
        return {
          data: surface.successPayload,
          error: null,
        };
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(calls, [
    {
      functionName: surface.rpcName,
      args: {
        [surface.rpcArgKey]: surface.validId,
      },
    },
  ]);

  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.deepEqual(payload.data, surface.successPayload);
});

test("admin listing workflow snapshot route calls RPC and returns no-store payload", async () => {
  const calls: Array<{ functionName: string; args: Record<string, unknown> }> = [];
  const surface = SNAPSHOT_SURFACES[1]!;

  const response = await surface.handle(
    createGetRequest(),
    createDependencies({
      rpc: (functionName, args) => {
        calls.push({ functionName, args });
        return {
          data: surface.successPayload,
          error: null,
        };
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(calls, [
    {
      functionName: surface.rpcName,
      args: {
        [surface.rpcArgKey]: surface.validId,
      },
    },
  ]);

  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.deepEqual(payload.data, surface.successPayload);
});

function createGetRequest(): Request {
  return new Request("http://localhost:3000/api/admin/workflows/test/snapshot", {
    method: "GET",
  });
}

function createDependencies(options: {
  userId?: string | null;
  getProfileRole?: () => string | null;
  profileError?: { code?: string | null; message?: string | null } | null;
  rpc: (
    functionName: "get_admin_reservation_workflow_snapshot" | "get_admin_listing_workflow_snapshot",
    args: Record<string, unknown>,
  ) => { data: unknown; error: { code?: string | null; message?: string | null } | null };
}): AdminWorkflowSnapshotRouteDependencies {
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
      rpc: async (
        functionName: "get_admin_reservation_workflow_snapshot" | "get_admin_listing_workflow_snapshot",
        args: Record<string, unknown>,
      ) => options.rpc(functionName, args),
    }),
  };
}
