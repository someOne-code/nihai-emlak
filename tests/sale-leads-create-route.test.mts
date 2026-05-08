import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import test from "node:test";

import {
  handleSaleLeadCreatePost,
  type SaleLeadCreateRouteDependencies,
} from "../lib/sale-leads/create-route.ts";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VALID_LISTING_ID = "11111111-1111-4111-8111-111111111111";

const validPayload = {
  listing_id: VALID_LISTING_ID,
  message: "Bu ilanla ilgileniyorum",
  contact_name: "Ada User",
  contact_email: "ADA@EXAMPLE.COM",
  contact_phone: " +90 555 111 22 33 ",
};

test("sale lead create rejects non-json requests before auth", async (t) => {
  setupSaleLeadEnv(t);

  const response = await handleSaleLeadCreatePost(
    new Request("http://localhost:3000/api/sale-leads", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
      body: "not-json",
    }),
    createFailingDependencies(),
  );

  assert.equal(response.status, 415);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Sale lead create requires application/json",
  });
});

test("sale lead create rejects untrusted origins before auth", async (t) => {
  setupSaleLeadEnv(t);

  const response = await handleSaleLeadCreatePost(
    new Request("http://localhost:3000/api/sale-leads", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://evil.example",
      },
      body: JSON.stringify(validPayload),
    }),
    createFailingDependencies(),
  );

  assert.equal(response.status, 403);
});

test("sale lead create rejects unauthenticated requests", async (t) => {
  setupSaleLeadEnv(t);

  const response = await handleSaleLeadCreatePost(
    createJsonRequest(validPayload),
    createDependencies({ userId: null }),
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Authentication required",
  });
});

test("sale lead create rejects invalid payloads", async (t) => {
  setupSaleLeadEnv(t);

  const response = await handleSaleLeadCreatePost(
    createJsonRequest({ ...validPayload, listing_id: "not-a-uuid" }),
    createDependencies({
      rpc: () => {
        throw new Error("rpc should not be called for invalid input");
      },
    }),
  );

  assert.equal(response.status, 400);
});

test("sale lead create returns 201 for a valid sale listing payload", async (t) => {
  setupSaleLeadEnv(t);
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];

  const response = await handleSaleLeadCreatePost(
    createJsonRequest(validPayload),
    createDependencies({
      rpc: (name, args) => {
        calls.push({ name, args });
        return {
          data: {
            result: "created",
            lead_id: "22222222-2222-4222-8222-222222222222",
            listing_id: VALID_LISTING_ID,
            status: "new",
          },
          error: null,
        };
      },
    }),
  );

  assert.equal(response.status, 201);
  assert.deepEqual(calls, [
    {
      name: "create_sale_lead",
      args: {
        p_listing_id: VALID_LISTING_ID,
        p_contact_name: "Ada User",
        p_contact_email: "ada@example.com",
        p_contact_phone: "+90 555 111 22 33",
        p_message: "Bu ilanla ilgileniyorum",
      },
    },
  ]);
  assert.deepEqual(await response.json(), {
    success: true,
    data: {
      lead: {
        id: "22222222-2222-4222-8222-222222222222",
        listingId: VALID_LISTING_ID,
        status: "new",
      },
    },
  });
});

test("sale lead create rejects rent listings with 409", async (t) => {
  setupSaleLeadEnv(t);

  const response = await handleSaleLeadCreatePost(
    createJsonRequest(validPayload),
    createDependencies({
      rpc: () => ({
        data: null,
        error: { code: "P0001", message: "listing is not sale" },
      }),
    }),
  );

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Sale leads are only available for sale listings",
  });
});

function createJsonRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/sale-leads", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify(body),
  });
}

function createFailingDependencies(): SaleLeadCreateRouteDependencies {
  return {
    createServerSupabaseClient: async () => {
      throw new Error("auth should not be reached");
    },
  };
}

function createDependencies(options: {
  userId?: string | null;
  rpc?: (
    name: "create_sale_lead",
    args: Record<string, unknown>,
  ) => { data: unknown; error: { code?: string | null; message?: string | null } | null };
} = {}): SaleLeadCreateRouteDependencies {
  return {
    createServerSupabaseClient: async () => ({
      auth: {
        getUser: async () => ({
          data: {
            user: options.userId === null ? null : { id: options.userId ?? USER_ID },
          },
          error: null,
        }),
      },
      rpc: async (name: "create_sale_lead", args: Record<string, unknown>) =>
        options.rpc?.(name, args) ?? {
          data: {
            result: "created",
            lead_id: "22222222-2222-4222-8222-222222222222",
            listing_id: VALID_LISTING_ID,
            status: "new",
          },
          error: null,
        },
    }),
  };
}

function setupSaleLeadEnv(t: TestContext): void {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousSiteUrl = process.env.SITE_URL;
  const previousPublicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const previousVercelUrl = process.env.VERCEL_URL;

  process.env.NODE_ENV = "test";
  delete process.env.SITE_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.VERCEL_URL;

  t.after(() => {
    process.env.NODE_ENV = previousNodeEnv;
    if (previousSiteUrl !== undefined) process.env.SITE_URL = previousSiteUrl;
    if (previousPublicSiteUrl !== undefined) process.env.NEXT_PUBLIC_SITE_URL = previousPublicSiteUrl;
    if (previousVercelUrl !== undefined) process.env.VERCEL_URL = previousVercelUrl;
  });
}
