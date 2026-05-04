import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPostsListViewModel,
  buildPostDetail,
  buildCategoriesListViewModel,
  buildCategoryDetail,
  buildConsultantsListViewModel,
  buildConsultantDetail,
} from "../lib/admin-ui/content-view-model.ts";

// ── Posts list view-model ──────────────────────────────────────────────────

test("buildPostsListViewModel returns empty state for null input", () => {
  const vm = buildPostsListViewModel(null);
  assert.equal(vm.isEmpty, true);
  assert.deepEqual(vm.rows, []);
  assert.equal(vm.total, 0);
});

test("buildPostsListViewModel maps status to Turkish label", () => {
  const data = {
    items: [
      { id: "1", title: "Test Post", slug: "test-post", status: "published", updatedAt: "2024-01-01" },
      { id: "2", title: "Draft Post", slug: "draft-post", status: "draft", updatedAt: "2024-01-02" },
    ],
    total: 2,
    page: 1,
    totalPages: 1,
  };
  const vm = buildPostsListViewModel(data);
  assert.equal(vm.isEmpty, false);
  assert.equal(vm.rows.length, 2);
  assert.equal(vm.rows[0].statusLabel, "Yayında");
  assert.equal(vm.rows[1].statusLabel, "Taslak");
});

test("buildPostsListViewModel maps category title or dash when absent", () => {
  const data = {
    items: [
      { id: "1", title: "With Cat", slug: "s1", status: "draft", category: { id: "c1", title: "Tech" }, updatedAt: "2024-01-01" },
      { id: "2", title: "No Cat", slug: "s2", status: "draft", updatedAt: "2024-01-01" },
    ],
    total: 2, page: 1, totalPages: 1,
  };
  const vm = buildPostsListViewModel(data);
  assert.equal(vm.rows[0].categoryLabel, "Tech");
  assert.equal(vm.rows[1].categoryLabel, "—");
});

test("buildPostsListViewModel falls back to Basliksiz for missing title", () => {
  const data = { items: [{ id: "1", slug: "s", status: "draft", updatedAt: "2024-01-01" }], total: 1, page: 1, totalPages: 1 };
  const vm = buildPostsListViewModel(data);
  assert.equal(vm.rows[0].title, "Başlıksız");
});

test("buildPostDetail returns null for invalid input", () => {
  assert.equal(buildPostDetail(null), null);
  assert.equal(buildPostDetail("string"), null);
});

test("buildPostDetail maps a valid document", () => {
  const doc = {
    id: "abc", title: "Hello", slug: "hello", excerpt: "short", content: "body",
    category: { id: "c1", title: "News" }, status: "published",
    publishedAt: "2024-01-01", coverImageUrl: null, seoTitle: null, seoDescription: null,
    createdAt: "2024-01-01", updatedAt: "2024-01-02",
  };
  const detail = buildPostDetail(doc);
  assert.ok(detail);
  assert.equal(detail.title, "Hello");
  assert.equal(detail.status, "published");
  assert.equal(detail.category?.title, "News");
});

// ── Categories list view-model ─────────────────────────────────────────────

test("buildCategoriesListViewModel returns empty state for null input", () => {
  const vm = buildCategoriesListViewModel(null);
  assert.equal(vm.isEmpty, true);
  assert.deepEqual(vm.rows, []);
});

test("buildCategoriesListViewModel maps isActive to Turkish label", () => {
  const data = {
    items: [
      { id: "1", title: "Active Cat", slug: "active", isActive: true, sortOrder: 1, updatedAt: "2024-01-01" },
      { id: "2", title: "Passive Cat", slug: "passive", isActive: false, sortOrder: 2, updatedAt: "2024-01-01" },
    ],
    total: 2, page: 1, totalPages: 1,
  };
  const vm = buildCategoriesListViewModel(data);
  assert.equal(vm.rows[0].isActiveLabel, "Aktif");
  assert.equal(vm.rows[1].isActiveLabel, "Pasif");
});

test("buildCategoryDetail returns null for invalid input", () => {
  assert.equal(buildCategoryDetail(null), null);
});

test("buildCategoryDetail maps a valid document", () => {
  const doc = { id: "c1", title: "Tech", slug: "tech", description: "Desc", isActive: true, sortOrder: 0, createdAt: "2024-01-01", updatedAt: "2024-01-01" };
  const detail = buildCategoryDetail(doc);
  assert.ok(detail);
  assert.equal(detail.title, "Tech");
  assert.equal(detail.isActive, true);
});

// ── Consultants list view-model ────────────────────────────────────────────

test("buildConsultantsListViewModel returns empty state for null input", () => {
  const vm = buildConsultantsListViewModel(null);
  assert.equal(vm.isEmpty, true);
  assert.deepEqual(vm.rows, []);
});

test("buildConsultantsListViewModel maps isPublished to Turkish label", () => {
  const data = {
    items: [
      { id: "1", fullName: "Ali Veli", slug: "ali", isPublished: true, sortOrder: 0, updatedAt: "2024-01-01" },
      { id: "2", fullName: "Ayse Kaya", slug: "ayse", isPublished: false, sortOrder: 1, updatedAt: "2024-01-01" },
    ],
    total: 2, page: 1, totalPages: 1,
  };
  const vm = buildConsultantsListViewModel(data);
  assert.equal(vm.rows[0].isPublishedLabel, "Yayında");
  assert.equal(vm.rows[1].isPublishedLabel, "Taslak");
});

test("buildConsultantsListViewModel falls back to İsimsiz Danışman", () => {
  const data = { items: [{ id: "1", slug: "s", isPublished: false, sortOrder: 0, updatedAt: "2024-01-01" }], total: 1, page: 1, totalPages: 1 };
  const vm = buildConsultantsListViewModel(data);
  assert.equal(vm.rows[0].fullName, "İsimsiz Danışman");
});

test("buildConsultantDetail returns null for invalid input", () => {
  assert.equal(buildConsultantDetail(null), null);
});

test("buildConsultantDetail maps a valid document", () => {
  const doc = {
    id: "co1", fullName: "Ali Veli", slug: "ali", title: "Danışman",
    photoUrl: null, shortBio: "Bio", phone: "+90555", email: "ali@x.com",
    whatsappUrl: null, linkedinUrl: null, isPublished: true, sortOrder: 1,
    createdAt: "2024-01-01", updatedAt: "2024-01-01",
  };
  const detail = buildConsultantDetail(doc);
  assert.ok(detail);
  assert.equal(detail.fullName, "Ali Veli");
  assert.equal(detail.isPublished, true);
  assert.equal(detail.phone, "+90555");
});
