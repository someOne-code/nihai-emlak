import assert from "node:assert/strict";
import test from "node:test";

import {
  AdminUsersClientError,
  fetchAdminUsers,
  inviteAdminUser,
} from "../lib/admin-ui/users-client.ts";
import {
  buildAdminUsersViewModel,
  type AdminUsersDto,
} from "../lib/admin-ui/users-view-model.ts";

test("admin users client fetches list endpoint with no-store credentials", async () => {
  const calls: Array<{
    url: string;
    method: string;
    credentials: RequestCredentials | undefined;
    cache: RequestCache | undefined;
  }> = [];

  const result = await fetchAdminUsers({
    fetcher: async (input, init) => {
      calls.push({
        url: String(input),
        method: init?.method ?? "GET",
        credentials: init?.credentials,
        cache: init?.cache,
      });
      return jsonResponse({
        success: true,
        data: { items: [] },
      });
    },
  });

  assert.deepEqual(calls, [
    {
      url: "/api/admin/users",
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    },
  ]);
  assert.deepEqual(result, { items: [] });
});

test("admin users client posts invite payload", async () => {
  const calls: Array<{ url: string; body: unknown }> = [];

  const result = await inviteAdminUser("New-Admin@Example.com", {
    fetcher: async (input, init) => {
      calls.push({
        url: String(input),
        body: JSON.parse(String(init?.body)),
      });
      return jsonResponse({
        success: true,
        data: { email: "new-admin@example.com", role: "admin" },
      });
    },
  });

  assert.deepEqual(calls, [
    {
      url: "/api/admin/users/invite",
      body: { email: "New-Admin@Example.com" },
    },
  ]);
  assert.deepEqual(result, {
    email: "new-admin@example.com",
    role: "admin",
  });
});

test("admin users client throws typed errors for failed envelopes", async () => {
  await assert.rejects(
    () =>
      inviteAdminUser("bad-email", {
        fetcher: async () =>
          jsonResponse({ success: false, error: "Valid email is required" }, 400),
      }),
    (error: unknown) => {
      assert.ok(error instanceof AdminUsersClientError);
      assert.equal(error.message, "Valid email is required");
      assert.equal(error.status, 400);
      return true;
    },
  );
});

test("admin users view-model renders empty and populated states", () => {
  const empty = buildAdminUsersViewModel({ items: [] });
  assert.equal(empty.isEmpty, true);
  assert.deepEqual(empty.rows, []);

  const populated = buildAdminUsersViewModel({
    items: [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        email: "owner@example.com",
        role: "admin",
        createdAt: "2026-05-01T10:00:00.000Z",
      },
    ],
  } satisfies AdminUsersDto);

  assert.equal(populated.isEmpty, false);
  assert.deepEqual(populated.rows, [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      email: "owner@example.com",
      roleLabel: "Admin",
      createdAtLabel: "2026-05-01",
    },
  ]);
});

function jsonResponse(payload: unknown, status = 200): Response {
  return Response.json(payload, {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}
