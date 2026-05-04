import assert from "node:assert/strict";
import test from "node:test";

import {
  ContentAdminClientError,
  fetchAdminPostsListFiltered,
  createAdminPost,
  deleteAdminPost,
  fetchAdminCategoriesList,
  createAdminCategory,
  deleteAdminCategory,
  fetchAdminConsultantsList,
  createAdminConsultant,
  deleteAdminConsultant,
} from "../lib/admin-ui/content-client.ts";

// ── Helpers ────────────────────────────────────────────────────────────────

function mockFetcher(status: number, body: unknown): () => Promise<Response> {
  return async () =>
    Response.json(body, { status });
}

function mockDeleteFetcher(status: number): () => Promise<Response> {
  return async () => new Response(null, { status });
}

// ── ContentAdminClientError ────────────────────────────────────────────────

test("ContentAdminClientError stores status and message", () => {
  const err = new ContentAdminClientError("Not found", 404);
  assert.equal(err.message, "Not found");
  assert.equal(err.status, 404);
  assert.equal(err.name, "ContentAdminClientError");
});

// ── Posts client ───────────────────────────────────────────────────────────

test("fetchAdminPostsListFiltered returns data on success", async () => {
  const payload = { success: true, data: { items: [], total: 0, page: 1, totalPages: 0 } };
  const fetcher = mockFetcher(200, payload);
  const result = await fetchAdminPostsListFiltered({}, { fetcher });
  assert.deepEqual(result, payload.data);
});

test("fetchAdminPostsListFiltered throws ContentAdminClientError on 401", async () => {
  const fetcher = mockFetcher(401, { success: false, error: "Authentication required" });
  await assert.rejects(
    () => fetchAdminPostsListFiltered({}, { fetcher }),
    (err: unknown) => {
      assert.ok(err instanceof ContentAdminClientError);
      assert.equal(err.status, 401);
      return true;
    },
  );
});

test("createAdminPost returns created document on 201", async () => {
  const doc = { id: "1", title: "T", slug: "s", status: "draft" };
  const fetcher = mockFetcher(201, { success: true, data: doc });
  const result = await createAdminPost({ title: "T", slug: "s", content: "body" }, { fetcher });
  assert.deepEqual(result, doc);
});

test("createAdminPost throws on duplicate slug 409", async () => {
  const fetcher = mockFetcher(409, { success: false, error: "A post with this slug already exists" });
  await assert.rejects(
    () => createAdminPost({ title: "T", slug: "s", content: "body" }, { fetcher }),
    (err: unknown) => {
      assert.ok(err instanceof ContentAdminClientError);
      assert.equal(err.status, 409);
      return true;
    },
  );
});

test("deleteAdminPost resolves on 200", async () => {
  const fetcher = mockDeleteFetcher(200);
  await assert.doesNotReject(() => deleteAdminPost("1", { fetcher }));
});

test("deleteAdminPost throws on 404", async () => {
  const fetcher = mockFetcher(404, { success: false, error: "Post not found" });
  await assert.rejects(
    () => deleteAdminPost("1", { fetcher }),
    (err: unknown) => {
      assert.ok(err instanceof ContentAdminClientError);
      assert.equal(err.status, 404);
      return true;
    },
  );
});

// ── Categories client ──────────────────────────────────────────────────────

test("fetchAdminCategoriesList returns data on success", async () => {
  const data = { items: [], total: 0, page: 1, totalPages: 0 };
  const fetcher = mockFetcher(200, { success: true, data });
  const result = await fetchAdminCategoriesList({ fetcher });
  assert.deepEqual(result, data);
});

test("createAdminCategory throws on 403", async () => {
  const fetcher = mockFetcher(403, { success: false, error: "Admin role required" });
  await assert.rejects(
    () => createAdminCategory({ title: "T", slug: "s" }, { fetcher }),
    (err: unknown) => {
      assert.ok(err instanceof ContentAdminClientError);
      assert.equal(err.status, 403);
      return true;
    },
  );
});

test("deleteAdminCategory resolves on 200", async () => {
  const fetcher = mockDeleteFetcher(200);
  await assert.doesNotReject(() => deleteAdminCategory("c1", { fetcher }));
});

// ── Consultants client ─────────────────────────────────────────────────────

test("fetchAdminConsultantsList returns data on success", async () => {
  const data = { items: [], total: 0, page: 1, totalPages: 0 };
  const fetcher = mockFetcher(200, { success: true, data });
  const result = await fetchAdminConsultantsList({ fetcher });
  assert.deepEqual(result, data);
});

test("createAdminConsultant throws on 400 missing field", async () => {
  const fetcher = mockFetcher(400, { success: false, error: "fullName is required" });
  await assert.rejects(
    () => createAdminConsultant({ slug: "s" }, { fetcher }),
    (err: unknown) => {
      assert.ok(err instanceof ContentAdminClientError);
      assert.equal(err.status, 400);
      return true;
    },
  );
});

test("deleteAdminConsultant resolves on 200", async () => {
  const fetcher = mockDeleteFetcher(200);
  await assert.doesNotReject(() => deleteAdminConsultant("co1", { fetcher }));
});
