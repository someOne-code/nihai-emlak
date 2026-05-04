// Phase 9A Task 7: Content controller tests.
//
// Mirrors tests/admin-listings-controller.test.mts pattern exactly.
// Tests the orchestration layer: controller fetches via injected client
// functions and feeds results through the view-model layer.

import assert from "node:assert/strict";
import test from "node:test";

import type { PostsListFilters } from "../lib/admin-ui/content-client.ts";
import {
  loadPostsModel,
  loadCategoriesModel,
  loadConsultantsModel,
  loadContentDetailModel,
  ContentControllerError,
} from "../lib/admin-ui/content-controller.ts";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makePostsListData(overrides: Record<string, unknown> = {}) {
  return {
    items: [
      {
        id: "p1",
        title: "Test Post",
        slug: "test-post",
        status: "published",
        category: { id: "c1", title: "News" },
        updatedAt: "2024-01-01T00:00:00Z",
        publishedAt: "2024-01-01T00:00:00Z",
      },
    ],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
    ...overrides,
  };
}

function makeCategoriesListData(overrides: Record<string, unknown> = {}) {
  return {
    items: [
      { id: "c1", title: "News", slug: "news", isActive: true, sortOrder: 0, updatedAt: "2024-01-01" },
    ],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
    ...overrides,
  };
}

function makeConsultantsListData(overrides: Record<string, unknown> = {}) {
  return {
    items: [
      { id: "co1", fullName: "Ali Veli", slug: "ali", isPublished: true, sortOrder: 0, updatedAt: "2024-01-01" },
    ],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
    ...overrides,
  };
}

// ── Posts controller ─────────────────────────────────────────────────────────

test("loadPostsModel fetches list and returns populated view-model", async () => {
  const calls: string[] = [];
  const vm = await loadPostsModel(
    {
      fetchAdminPostsListFiltered: async () => {
        calls.push("list");
        return makePostsListData();
      },
    },
    {},
  );

  assert.deepEqual(calls, ["list"]);
  assert.equal(vm.isEmpty, false);
  assert.equal(vm.rows.length, 1);
  assert.equal(vm.rows[0].title, "Test Post");
  assert.equal(vm.rows[0].statusLabel, "Yayında");
});

test("loadPostsModel returns empty state when list is empty", async () => {
  const vm = await loadPostsModel(
    { fetchAdminPostsListFiltered: async () => makePostsListData({ items: [], total: 0 }) },
    {},
  );
  assert.equal(vm.isEmpty, true);
  assert.deepEqual(vm.rows, []);
});

test("loadPostsModel passes filters to the list fetcher", async () => {
  let receivedFilters: unknown = null;
  await loadPostsModel(
    {
      fetchAdminPostsListFiltered: async (filters: PostsListFilters) => {
        receivedFilters = filters;
        return makePostsListData({ items: [] });
      },
    },
    { status: "draft", page: 2 },
  );
  assert.deepEqual(receivedFilters, { status: "draft", page: 2 });
});

test("loadPostsModel propagates client error", async () => {
  await assert.rejects(
    () =>
      loadPostsModel(
        {
          fetchAdminPostsListFiltered: async () => {
            throw new Error("403 Admin role required");
          },
        },
        {},
      ),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      return true;
    },
  );
});

// ── Categories controller ────────────────────────────────────────────────────

test("loadCategoriesModel fetches list and returns populated view-model", async () => {
  const calls: string[] = [];
  const vm = await loadCategoriesModel({
    fetchAdminCategoriesList: async () => {
      calls.push("list");
      return makeCategoriesListData();
    },
  });

  assert.deepEqual(calls, ["list"]);
  assert.equal(vm.isEmpty, false);
  assert.equal(vm.rows.length, 1);
  assert.equal(vm.rows[0].title, "News");
  assert.equal(vm.rows[0].isActiveLabel, "Aktif");
});

test("loadCategoriesModel returns empty state when list is empty", async () => {
  const vm = await loadCategoriesModel({
    fetchAdminCategoriesList: async () => makeCategoriesListData({ items: [], total: 0 }),
  });
  assert.equal(vm.isEmpty, true);
});

test("loadCategoriesModel propagates client error", async () => {
  await assert.rejects(
    () =>
      loadCategoriesModel({
        fetchAdminCategoriesList: async () => {
          throw new Error("401 Authentication required");
        },
      }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      return true;
    },
  );
});

// ── Consultants controller ───────────────────────────────────────────────────

test("loadConsultantsModel fetches list and returns populated view-model", async () => {
  const calls: string[] = [];
  const vm = await loadConsultantsModel({
    fetchAdminConsultantsList: async () => {
      calls.push("list");
      return makeConsultantsListData();
    },
  });

  assert.deepEqual(calls, ["list"]);
  assert.equal(vm.isEmpty, false);
  assert.equal(vm.rows.length, 1);
  assert.equal(vm.rows[0].fullName, "Ali Veli");
  assert.equal(vm.rows[0].isPublishedLabel, "Yayında");
});

test("loadConsultantsModel returns empty state when list is empty", async () => {
  const vm = await loadConsultantsModel({
    fetchAdminConsultantsList: async () => makeConsultantsListData({ items: [], total: 0 }),
  });
  assert.equal(vm.isEmpty, true);
});

test("loadConsultantsModel propagates client error", async () => {
  await assert.rejects(
    () =>
      loadConsultantsModel({
        fetchAdminConsultantsList: async () => {
          throw new Error("403");
        },
      }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      return true;
    },
  );
});

// ── loadContentDetailModel ───────────────────────────────────────────────────

test("loadContentDetailModel fetches post detail and returns mapped detail", async () => {
  const doc = {
    id: "p1",
    title: "Hello",
    slug: "hello",
    excerpt: null,
    content: "body",
    category: { id: "c1", title: "News" },
    status: "published",
    publishedAt: "2024-01-01",
    coverImageUrl: null,
    seoTitle: null,
    seoDescription: null,
    createdAt: "2024-01-01",
    updatedAt: "2024-01-01",
  };

  const result = await loadContentDetailModel("posts", "p1", {
    fetchAdminPost: async (id: string) => {
      assert.equal(id, "p1");
      return doc;
    },
    fetchAdminCategory: async () => { throw new Error("should not be called"); },
    fetchAdminConsultant: async () => { throw new Error("should not be called"); },
  });

  assert.ok(result !== null);
  assert.equal(result.type, "post");
  if (result.type === "post") {
    assert.equal(result.detail.title, "Hello");
    assert.equal(result.detail.status, "published");
  }
});

test("loadContentDetailModel fetches category detail", async () => {
  const doc = {
    id: "c1", title: "Tech", slug: "tech", description: null,
    isActive: true, sortOrder: 0, createdAt: "2024-01-01", updatedAt: "2024-01-01",
  };

  const result = await loadContentDetailModel("categories", "c1", {
    fetchAdminPost: async () => { throw new Error("should not be called"); },
    fetchAdminCategory: async (id: string) => {
      assert.equal(id, "c1");
      return doc;
    },
    fetchAdminConsultant: async () => { throw new Error("should not be called"); },
  });

  assert.ok(result !== null);
  assert.equal(result.type, "category");
  if (result.type === "category") {
    assert.equal(result.detail.title, "Tech");
    assert.equal(result.detail.isActive, true);
  }
});

test("loadContentDetailModel fetches consultant detail", async () => {
  const doc = {
    id: "co1", fullName: "Ali Veli", slug: "ali", title: "Danışman",
    photoUrl: null, shortBio: "Bio", phone: "+90555", email: "ali@x.com",
    whatsappUrl: null, linkedinUrl: null, isPublished: true, sortOrder: 0,
    createdAt: "2024-01-01", updatedAt: "2024-01-01",
  };

  const result = await loadContentDetailModel("consultants", "co1", {
    fetchAdminPost: async () => { throw new Error("should not be called"); },
    fetchAdminCategory: async () => { throw new Error("should not be called"); },
    fetchAdminConsultant: async (id: string) => {
      assert.equal(id, "co1");
      return doc;
    },
  });

  assert.ok(result !== null);
  assert.equal(result.type, "consultant");
  if (result.type === "consultant") {
    assert.equal(result.detail.fullName, "Ali Veli");
    assert.equal(result.detail.isPublished, true);
  }
});

test("loadContentDetailModel returns null for unknown collection", async () => {
  const result = await loadContentDetailModel("unknown-collection" as "posts", "id1", {
    fetchAdminPost: async () => ({}),
    fetchAdminCategory: async () => ({}),
    fetchAdminConsultant: async () => ({}),
  });
  assert.equal(result, null);
});

test("loadContentDetailModel propagates fetch error", async () => {
  await assert.rejects(
    () =>
      loadContentDetailModel("posts", "p1", {
        fetchAdminPost: async () => {
          throw new Error("404 not found");
        },
        fetchAdminCategory: async () => ({}),
        fetchAdminConsultant: async () => ({}),
      }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.ok((err as Error).message.includes("404"));
      return true;
    },
  );
});

// ── ContentControllerError type guard test ───────────────────────────────────

test("ContentControllerError carries status and message", () => {
  const err = new ContentControllerError("Not found", 404);
  assert.equal(err.status, 404);
  assert.equal(err.message, "Not found");
  assert.equal(err.name, "ContentControllerError");
});
