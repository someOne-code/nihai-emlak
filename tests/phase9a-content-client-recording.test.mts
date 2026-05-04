// Phase 9A Task 7: Content client recording-fetcher tests.
//
// Mirrors tests/admin-listings-client.test.mts pattern: captures URL, method,
// headers, body, credentials, and cache to verify the HTTP contract.
// Supplements phase9a-content-client.test.mts (which only tested envelope errors).

import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchAdminPostsListFiltered,
  fetchAdminPost,
  createAdminPost,
  updateAdminPost,
  deleteAdminPost,
  fetchAdminCategoriesList,
  fetchAdminCategory,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
  fetchAdminConsultantsList,
  fetchAdminConsultant,
  createAdminConsultant,
  updateAdminConsultant,
  deleteAdminConsultant,
  fetchAdminCategoryOptions,
  ContentAdminClientError,
} from "../lib/admin-ui/content-client.ts";

// ── Recording fetcher ────────────────────────────────────────────────────────

type Capture = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  credentials: RequestCredentials | undefined;
  cache: RequestCache | undefined;
};

function recordingFetcher(responder: (input: Capture) => Response): {
  fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  calls: Capture[];
} {
  const calls: Capture[] = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const capture: Capture = {
      url: String(input),
      method: init?.method ?? "GET",
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: init?.body ? safeJsonParse(String(init.body)) : null,
      credentials: init?.credentials,
      cache: init?.cache,
    };
    calls.push(capture);
    return responder(capture);
  };
  return { fetcher, calls };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return Response.json(payload, { status, headers: { "content-type": "application/json" } });
}

function safeJsonParse(value: string): unknown {
  try { return JSON.parse(value); } catch { return value; }
}

// ── Posts client HTTP contract ───────────────────────────────────────────────

test("fetchAdminPostsListFiltered builds query string correctly", async () => {
  const { fetcher, calls } = recordingFetcher(() =>
    jsonResponse({ success: true, data: { items: [], total: 0, page: 1, totalPages: 0 } }),
  );

  await fetchAdminPostsListFiltered(
    { status: "draft", category: "c1", page: 2, limit: 10 },
    { fetcher },
  );

  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.includes("status=draft"));
  assert.ok(calls[0].url.includes("category=c1"));
  assert.ok(calls[0].url.includes("page=2"));
  assert.ok(calls[0].url.includes("limit=10"));
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].credentials, "same-origin");
  assert.equal(calls[0].cache, "no-store");
});

test("fetchAdminPostsListFiltered with no filters omits query string", async () => {
  const { fetcher, calls } = recordingFetcher(() =>
    jsonResponse({ success: true, data: { items: [], total: 0, page: 1, totalPages: 0 } }),
  );

  await fetchAdminPostsListFiltered({}, { fetcher });

  assert.equal(calls[0].url, "/api/admin/content/posts");
});

test("fetchAdminPost encodes id and uses GET", async () => {
  const { fetcher, calls } = recordingFetcher(() =>
    jsonResponse({ success: true, data: { id: "p1", title: "T", slug: "t", content: "body", status: "draft", createdAt: "2024-01-01", updatedAt: "2024-01-01" } }),
  );

  await fetchAdminPost("p1", { fetcher });

  assert.equal(calls[0].url, "/api/admin/content/posts/p1");
  assert.equal(calls[0].method, "GET");
});

test("createAdminPost POSTs JSON with content-type header", async () => {
  const { fetcher, calls } = recordingFetcher(() =>
    jsonResponse({ success: true, data: { id: "p1" } }, 201),
  );

  await createAdminPost({ title: "T", slug: "t", content: "body" }, { fetcher });

  assert.equal(calls[0].url, "/api/admin/content/posts");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].headers["content-type"], "application/json");
  assert.deepEqual(calls[0].body, { title: "T", slug: "t", content: "body" });
});

test("updateAdminPost PATCHes the correct resource", async () => {
  const { fetcher, calls } = recordingFetcher(() =>
    jsonResponse({ success: true, data: { id: "p1" } }),
  );

  await updateAdminPost("p1", { title: "New" }, { fetcher });

  assert.equal(calls[0].url, "/api/admin/content/posts/p1");
  assert.equal(calls[0].method, "PATCH");
  assert.deepEqual(calls[0].body, { title: "New" });
});

test("deleteAdminPost DELETEs the resource", async () => {
  const { fetcher, calls } = recordingFetcher(() =>
    new Response(null, { status: 200 }),
  );

  await deleteAdminPost("p1", { fetcher });

  assert.equal(calls[0].url, "/api/admin/content/posts/p1");
  assert.equal(calls[0].method, "DELETE");
});

test("deleteAdminPost throws ContentAdminClientError on non-ok response", async () => {
  const { fetcher } = recordingFetcher(() =>
    jsonResponse({ success: false, error: "Post not found" }, 404),
  );

  await assert.rejects(
    () => deleteAdminPost("p1", { fetcher }),
    (err: unknown) => {
      assert.ok(err instanceof ContentAdminClientError);
      assert.equal(err.status, 404);
      assert.equal(err.message, "Post not found");
      return true;
    },
  );
});

// ── Categories client HTTP contract ─────────────────────────────────────────

test("fetchAdminCategoriesList uses GET /api/admin/content/categories", async () => {
  const { fetcher, calls } = recordingFetcher(() =>
    jsonResponse({ success: true, data: { items: [], total: 0, page: 1, totalPages: 0 } }),
  );

  await fetchAdminCategoriesList({ fetcher });

  assert.equal(calls[0].url, "/api/admin/content/categories");
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].credentials, "same-origin");
});

test("fetchAdminCategoryOptions uses GET /api/admin/content/categories/options", async () => {
  const { fetcher, calls } = recordingFetcher(() =>
    jsonResponse({ success: true, data: [] }),
  );

  await fetchAdminCategoryOptions({ fetcher });

  assert.equal(calls[0].url, "/api/admin/content/categories/options");
  assert.equal(calls[0].method, "GET");
});

test("fetchAdminCategory encodes id correctly", async () => {
  const { fetcher, calls } = recordingFetcher(() =>
    jsonResponse({ success: true, data: { id: "c1", title: "Tech" } }),
  );

  await fetchAdminCategory("c1", { fetcher });

  assert.equal(calls[0].url, "/api/admin/content/categories/c1");
});

test("createAdminCategory POSTs JSON body", async () => {
  const { fetcher, calls } = recordingFetcher(() =>
    jsonResponse({ success: true, data: { id: "c1" } }, 201),
  );

  await createAdminCategory({ title: "Tech", slug: "tech" }, { fetcher });

  assert.equal(calls[0].url, "/api/admin/content/categories");
  assert.equal(calls[0].method, "POST");
  assert.deepEqual(calls[0].body, { title: "Tech", slug: "tech" });
});

test("updateAdminCategory PATCHes the resource", async () => {
  const { fetcher, calls } = recordingFetcher(() =>
    jsonResponse({ success: true, data: { id: "c1" } }),
  );

  await updateAdminCategory("c1", { isActive: false }, { fetcher });

  assert.equal(calls[0].url, "/api/admin/content/categories/c1");
  assert.equal(calls[0].method, "PATCH");
  assert.deepEqual(calls[0].body, { isActive: false });
});

test("deleteAdminCategory DELETEs the resource and resolves", async () => {
  const { fetcher, calls } = recordingFetcher(() => new Response(null, { status: 200 }));
  await assert.doesNotReject(() => deleteAdminCategory("c1", { fetcher }));
  assert.equal(calls[0].url, "/api/admin/content/categories/c1");
  assert.equal(calls[0].method, "DELETE");
});

// ── Consultants client HTTP contract ─────────────────────────────────────────

test("fetchAdminConsultantsList uses GET /api/admin/content/consultants", async () => {
  const { fetcher, calls } = recordingFetcher(() =>
    jsonResponse({ success: true, data: { items: [], total: 0, page: 1, totalPages: 0 } }),
  );

  await fetchAdminConsultantsList({ fetcher });

  assert.equal(calls[0].url, "/api/admin/content/consultants");
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].credentials, "same-origin");
});

test("fetchAdminConsultant encodes id correctly", async () => {
  const { fetcher, calls } = recordingFetcher(() =>
    jsonResponse({ success: true, data: { id: "co1" } }),
  );

  await fetchAdminConsultant("co1", { fetcher });

  assert.equal(calls[0].url, "/api/admin/content/consultants/co1");
  assert.equal(calls[0].method, "GET");
});

test("createAdminConsultant POSTs JSON body", async () => {
  const { fetcher, calls } = recordingFetcher(() =>
    jsonResponse({ success: true, data: { id: "co1" } }, 201),
  );

  await createAdminConsultant({ fullName: "Ali Veli", slug: "ali" }, { fetcher });

  assert.equal(calls[0].url, "/api/admin/content/consultants");
  assert.equal(calls[0].method, "POST");
  assert.deepEqual(calls[0].body, { fullName: "Ali Veli", slug: "ali" });
});

test("updateAdminConsultant PATCHes the resource", async () => {
  const { fetcher, calls } = recordingFetcher(() =>
    jsonResponse({ success: true, data: { id: "co1" } }),
  );

  await updateAdminConsultant("co1", { isPublished: true, sortOrder: 1 }, { fetcher });

  assert.equal(calls[0].url, "/api/admin/content/consultants/co1");
  assert.equal(calls[0].method, "PATCH");
  assert.deepEqual(calls[0].body, { isPublished: true, sortOrder: 1 });
});

test("deleteAdminConsultant DELETEs the resource", async () => {
  const { fetcher, calls } = recordingFetcher(() => new Response(null, { status: 200 }));
  await assert.doesNotReject(() => deleteAdminConsultant("co1", { fetcher }));
  assert.equal(calls[0].url, "/api/admin/content/consultants/co1");
  assert.equal(calls[0].method, "DELETE");
});

test("content admin client throws typed error from failed envelope", async () => {
  const { fetcher } = recordingFetcher(() =>
    jsonResponse({ success: false, error: "Admin role required" }, 403),
  );

  await assert.rejects(
    () => fetchAdminConsultantsList({ fetcher }),
    (err: unknown) => {
      assert.ok(err instanceof ContentAdminClientError);
      assert.equal(err.message, "Admin role required");
      assert.equal(err.status, 403);
      return true;
    },
  );
});

test("content admin client handles non-JSON response as error", async () => {
  const { fetcher } = recordingFetcher(() => new Response("not-json", { status: 200 }));
  await assert.rejects(
    () => fetchAdminPostsListFiltered({}, { fetcher }),
    (err: unknown) => {
      assert.ok(err instanceof ContentAdminClientError);
      return true;
    },
  );
});
