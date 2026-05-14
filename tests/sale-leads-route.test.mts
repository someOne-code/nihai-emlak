import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import test from "node:test";

import {
  handleAdminSaleLeadsGet,
  handleAdminSaleLeadsPost,
  type AdminSaleLeadsRouteDependencies,
} from "../lib/admin/sale-leads-route.ts";
import type { RawSaleLead } from "../lib/admin-ui/sale-leads-view-model.ts";

const ADMIN_USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VALID_LEAD_ID = "22222222-2222-4222-8222-222222222222";

test("admin sale leads GET rejects unauthenticated requests", async () => {
  const response = await handleAdminSaleLeadsGet(
    new Request("http://localhost:3000/api/admin/sale-leads"),
    createDependencies({ userId: null }),
  );

  assert.equal(response.status, 401);
});

test("admin sale leads GET rejects non-admin requests", async () => {
  const response = await handleAdminSaleLeadsGet(
    new Request("http://localhost:3000/api/admin/sale-leads"),
    createDependencies({ profileRole: "user" }),
  );

  assert.equal(response.status, 403);
});

test("admin sale leads GET returns sale leads for admin", async () => {
  const response = await handleAdminSaleLeadsGet(
    new Request("http://localhost:3000/api/admin/sale-leads"),
    createDependencies({
      selectData: [
        {
          id: VALID_LEAD_ID,
          listing_id: "11111111-1111-4111-8111-111111111111",
          user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          contact_name: "Ada",
          contact_email: "ada@example.com",
          contact_phone: "+905551112233",
          message: "Bu ilanla ilgileniyorum",
          status: "new",
          updated_at: "2026-05-05T10:00:00Z",
          created_at: "2026-05-05T09:00:00Z",
          chatwoot_conversation_id: null,
          listings: { id: "11111111-1111-4111-8111-111111111111", title: "Moda Residence", city: "Istanbul", district: "Kadikoy", type: "sale" },
          profiles: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", full_name: "Ada", email: "ada@example.com" },
        },
      ],
    }),
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.data.leads.length, 1);
  assert.equal(body.data.leads[0].id, VALID_LEAD_ID);
});

test("admin sale leads GET returns guest sale leads without filtering them out", async () => {
  const guestLead: RawSaleLead = {
    id: VALID_LEAD_ID,
    listing_id: "11111111-1111-4111-8111-111111111111",
    user_id: null,
    contact_name: "Guest Buyer",
    contact_email: "guest@example.com",
    contact_phone: "+905551112233",
    message: "Misafir alici olarak detay almak istiyorum",
    status: "new",
    updated_at: "2026-05-05T10:00:00Z",
    created_at: "2026-05-05T09:00:00Z",
    chatwoot_conversation_id: null,
    listings: {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Moda Residence",
      city: "Istanbul",
      district: "Kadikoy",
      type: "sale",
    },
    profiles: null,
  };

  const response = await handleAdminSaleLeadsGet(
    new Request("http://localhost:3000/api/admin/sale-leads"),
    createDependencies({ selectData: [guestLead] }),
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.data.leads.length, 1);
  assert.equal(body.data.leads[0].id, VALID_LEAD_ID);
  assert.equal(body.data.leads[0].user_id, null);
  assert.equal(body.data.leads[0].profiles, null);
});

test("admin sale leads GET applies status search and pagination before reading rows", async () => {
  const queryCalls: Array<{ method: string; column?: string; value?: unknown; from?: number; to?: number }> = [];

  const response = await handleAdminSaleLeadsGet(
    new Request("http://localhost:3000/api/admin/sale-leads?status=actionable&search=ada&limit=25&offset=50"),
    createDependencies({ selectData: [], queryCalls }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(queryCalls, [
    { method: "in", column: "status", value: ["new", "called"] },
    {
      method: "or",
      value: "contact_name.ilike.%ada%,contact_email.ilike.%ada%,contact_phone.ilike.%ada%,message.ilike.%ada%",
    },
    { method: "order", column: "updated_at", value: { ascending: false } },
    { method: "range", from: 50, to: 74 },
  ]);
});

test("admin sale leads GET preserves Supabase query builder context when ordering rows", async () => {
  const response = await handleAdminSaleLeadsGet(
    new Request("http://localhost:3000/api/admin/sale-leads?limit=1"),
    createDependencies({ selectData: [], requireBoundOrderThis: true }),
  );

  assert.equal(response.status, 200);
});

test("admin sale leads POST rejects untrusted origins before auth", async (t) => {
  setupSaleLeadsAdminEnv(t);

  const response = await handleAdminSaleLeadsPost(
    new Request("http://localhost:3000/api/admin/sale-leads", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://evil.example",
      },
      body: JSON.stringify({ lead_id: VALID_LEAD_ID, status: "called" }),
    }),
    createDependencies({}),
  );

  assert.equal(response.status, 403);
});

test("admin sale leads POST rejects public origin when admin and public sites are split", async (t) => {
  setupSplitAdminOriginEnv(t);

  const response = await handleAdminSaleLeadsPost(
    new Request("https://admin.example.com/api/admin/sale-leads", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://www.example.com",
      },
      body: JSON.stringify({ lead_id: VALID_LEAD_ID, status: "called" }),
    }),
    createDependencies({ userId: null }),
  );

  assert.equal(response.status, 403);
});

test("admin sale leads POST rejects invalid status", async (t) => {
  setupSaleLeadsAdminEnv(t);

  const response = await handleAdminSaleLeadsPost(
    createPostRequest({ lead_id: VALID_LEAD_ID, status: "invalid" }),
    createDependencies({}),
  );

  assert.equal(response.status, 400);
});

test("admin sale leads POST updates status through RPC", async (t) => {
  setupSaleLeadsAdminEnv(t);
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];

  const response = await handleAdminSaleLeadsPost(
    createPostRequest({
      lead_id: VALID_LEAD_ID,
      status: "called",
      note: "Telefon ile ulasildi",
    }),
    createDependencies({
      rpc: (name, args) => {
        calls.push({ name, args });
        return {
          data: {
            id: VALID_LEAD_ID,
            listing_id: "11111111-1111-4111-8111-111111111111",
            status: "called",
            updated_at: "2026-05-05T10:00:00Z",
          },
          error: null,
        };
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [
    {
      name: "admin_update_sale_lead_status",
      args: {
        p_lead_id: VALID_LEAD_ID,
        p_status: "called",
        p_note: "Telefon ile ulasildi",
      },
    },
  ]);
});

function createPostRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/admin/sale-leads", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify(body),
  });
}

type DepsOptions = {
  userId?: string | null;
  profileRole?: string | null;
  selectData?: unknown[];
  selectError?: { code?: string | null; message?: string | null } | null;
  queryCalls?: Array<{ method: string; column?: string; value?: unknown; from?: number; to?: number }>;
  requireBoundOrderThis?: boolean;
  rpc?: (
    name: "admin_update_sale_lead_status",
    args: Record<string, unknown>,
  ) => {
    data: unknown;
    error: { code?: string | null; message?: string | null } | null;
  };
};

function createDependencies(options: DepsOptions): AdminSaleLeadsRouteDependencies {
  return {
    createServerSupabaseClient: async () => ({
      auth: {
        getUser: async () => ({
          data: {
            user: options.userId === null
              ? null
              : { id: options.userId ?? ADMIN_USER_ID },
          },
          error: null,
        }),
      },
      from: (table: string) => {
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { role: options.profileRole ?? "admin" },
                  error: null,
                }),
              }),
            }),
          };
        }

        assert.equal(table, "sale_leads");
        return {
          select: () => {
            const query = {
              eq: (column: string, value: string) => {
                options.queryCalls?.push({ method: "eq", column, value });
                return query;
              },
              in: (column: string, value: string[]) => {
                options.queryCalls?.push({ method: "in", column, value });
                return query;
              },
              or: (value: string) => {
                options.queryCalls?.push({ method: "or", value });
                return query;
              },
              order(column: string, value: { ascending: boolean }) {
                if (options.requireBoundOrderThis) {
                  assert.equal(this, query);
                }
                options.queryCalls?.push({ method: "order", column, value });
                return query;
              },
              range: async (from: number, to: number) => {
                options.queryCalls?.push({ method: "range", from, to });
                return {
                  data: options.selectData ?? [],
                  error: options.selectError ?? null,
                };
              },
              limit: async (value: number) => {
                options.queryCalls?.push({ method: "limit", value });
                return {
                  data: options.selectData ?? [],
                  error: options.selectError ?? null,
                };
              },
            };
            return query;
          },
        };
      },
      rpc: async (name: "admin_update_sale_lead_status", args: Record<string, unknown>) =>
        options.rpc?.(name, args) ?? {
          data: {
            id: VALID_LEAD_ID,
            status: "called",
            updated_at: "2026-05-05T10:00:00Z",
          },
          error: null,
        },
    }),
  };
}

function setupSaleLeadsAdminEnv(t: TestContext): void {
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

function setupSplitAdminOriginEnv(t: TestContext): void {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousSiteUrl = process.env.SITE_URL;
  const previousPublicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const previousVercelUrl = process.env.VERCEL_URL;

  process.env.NODE_ENV = "production";
  process.env.SITE_URL = "https://admin.example.com";
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.example.com";
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
