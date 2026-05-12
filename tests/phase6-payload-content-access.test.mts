import assert from "node:assert/strict";
import test from "node:test";

import {
  canCreateContent,
  canDeleteContent,
  canUpdateContent,
  isAdminContentManager,
  publishedBlogReadFilter,
  activeCategoryReadFilter,
  publishedConsultantReadFilter,
} from "../payload/access/content.ts";

test("admin users can create, update, and delete content", () => {
  const adminUser = { collection: "users", id: "admin-1", role: "admin" };
  const req = { user: adminUser };

  assert.equal(canCreateContent({ req }), true);
  assert.equal(canUpdateContent({ req }), true);
  assert.equal(canDeleteContent({ req }), true);
  assert.equal(isAdminContentManager({ req }), true);
});

test("legacy users with null role are denied content management after backfill", () => {
  const legacyAdmin = { collection: "users", id: "legacy-1", role: null };
  const req = { user: legacyAdmin };

  assert.equal(canCreateContent({ req }), false);
  assert.equal(canUpdateContent({ req }), false);
  assert.equal(canDeleteContent({ req }), false);
  assert.equal(isAdminContentManager({ req }), false);
});

test("non-admin users cannot create, update, or delete content", () => {
  const nonAdmin = { collection: "users", id: "user-1", role: "editor" };
  const req = { user: nonAdmin };

  assert.equal(canCreateContent({ req }), false);
  assert.equal(canUpdateContent({ req }), false);
  assert.equal(canDeleteContent({ req }), false);
  assert.equal(isAdminContentManager({ req }), false);
});

test("anonymous users cannot create, update, or delete content", () => {
  const req = { user: null };

  assert.equal(canCreateContent({ req }), false);
  assert.equal(canUpdateContent({ req }), false);
  assert.equal(canDeleteContent({ req }), false);
  assert.equal(isAdminContentManager({ req }), false);
});

test("users from other collections cannot manage content", () => {
  const otherCollectionUser = { collection: "customers", id: "cust-1", role: "admin" };
  const req = { user: otherCollectionUser };

  assert.equal(canCreateContent({ req }), false);
  assert.equal(canUpdateContent({ req }), false);
  assert.equal(canDeleteContent({ req }), false);
  assert.equal(isAdminContentManager({ req }), false);
});

test("public blog post read access returns status equals published filter", () => {
  const req = { user: null };
  const filter = publishedBlogReadFilter({ req });

  assert.deepEqual(filter, {
    status: {
      equals: "published",
    },
  });
});

test("public category read access returns isActive equals true filter", () => {
  const req = { user: null };
  const filter = activeCategoryReadFilter({ req });

  assert.deepEqual(filter, {
    isActive: {
      equals: true,
    },
  });
});

test("public consultant read access returns isPublished equals true filter", () => {
  const req = { user: null };
  const filter = publishedConsultantReadFilter({ req });

  assert.deepEqual(filter, {
    isPublished: {
      equals: true,
    },
  });
});

test("public read filters work with anonymous requests", () => {
  const req = { user: null };

  const blogFilter = publishedBlogReadFilter({ req });
  const categoryFilter = activeCategoryReadFilter({ req });
  const consultantFilter = publishedConsultantReadFilter({ req });

  assert.equal(typeof blogFilter, "object");
  assert.equal(typeof categoryFilter, "object");
  assert.equal(typeof consultantFilter, "object");

  assert.equal(blogFilter.status?.equals, "published");
  assert.equal(categoryFilter.isActive?.equals, true);
  assert.equal(consultantFilter.isPublished?.equals, true);
});

test("admin read access returns true for all content types", () => {
  const adminUser = { collection: "users", id: "admin-1", role: "admin" };
  const req = { user: adminUser };

  const blogResult = publishedBlogReadFilter({ req });
  const categoryResult = activeCategoryReadFilter({ req });
  const consultantResult = publishedConsultantReadFilter({ req });

  assert.equal(blogResult, true);
  assert.equal(categoryResult, true);
  assert.equal(consultantResult, true);
});

test("null role read access returns public filter after backfill", () => {
  const legacyAdmin = { collection: "users", id: "legacy-1", role: null };
  const req = { user: legacyAdmin };

  const blogResult = publishedBlogReadFilter({ req });
  const categoryResult = activeCategoryReadFilter({ req });
  const consultantResult = publishedConsultantReadFilter({ req });

  assert.deepEqual(blogResult, { status: { equals: "published" } });
  assert.deepEqual(categoryResult, { isActive: { equals: true } });
  assert.deepEqual(consultantResult, { isPublished: { equals: true } });
});

test("non-admin read access returns public filter", () => {
  const nonAdmin = { collection: "users", id: "user-1", role: "editor" };
  const req = { user: nonAdmin };

  const blogFilter = publishedBlogReadFilter({ req });
  const categoryFilter = activeCategoryReadFilter({ req });
  const consultantFilter = publishedConsultantReadFilter({ req });

  assert.equal(typeof blogFilter, "object");
  assert.equal(typeof categoryFilter, "object");
  assert.equal(typeof consultantFilter, "object");

  assert.equal(blogFilter.status?.equals, "published");
  assert.equal(categoryFilter.isActive?.equals, true);
  assert.equal(consultantFilter.isPublished?.equals, true);
});
