import assert from "node:assert/strict";
import test from "node:test";

import {
  ADMIN_SIDEBAR_ITEMS,
  ADMIN_SIDEBAR_LINKS,
  resolveAdminHeaderTitle,
} from "../components/admin-shell/admin-shell-nav.ts";

test("admin sidebar links expose the exact product nav contract", () => {
  assert.deepEqual(
    ADMIN_SIDEBAR_LINKS.map((link) => ({ label: link.label, href: link.href })),
    [
      { label: "Dashboard", href: "/admin" },
      { label: "İlanlar", href: "/admin/listings" },
      { label: "Operasyonlar", href: "/admin/operations" },
      { label: "Adminler", href: "/admin/users" },
      { label: "CMS", href: "/cms" },
    ],
  );
});

test("admin sidebar links array is frozen so callers cannot mutate the nav contract", () => {
  assert.ok(Object.isFrozen(ADMIN_SIDEBAR_LINKS));
});

test("admin sidebar items include Icerik section with Turkish content labels", () => {
  const icerik = ADMIN_SIDEBAR_ITEMS.find(
    (item) => item.kind === "section" && item.label === "İçerik",
  );
  assert.ok(icerik, "Icerik section must exist");
  assert.equal(icerik?.kind, "section");
  if (icerik?.kind === "section") {
    const childLabels = icerik.children.map((c) => c.label);
    assert.deepEqual(childLabels, [
      "Blog Yazıları",
      "Blog Kategorileri",
      "Danışmanlar",
    ]);
    const childHrefs = icerik.children.map((c) => c.href);
    assert.deepEqual(childHrefs, [
      "/admin/content/posts",
      "/admin/content/categories",
      "/admin/content/consultants",
    ]);
  }
});

test("admin sidebar items include CMS as fallback link", () => {
  const cms = ADMIN_SIDEBAR_ITEMS.find(
    (item) => item.kind === "link" && item.label === "CMS",
  );
  assert.ok(cms, "CMS fallback link must exist");
  assert.equal(cms?.kind, "link");
  if (cms?.kind === "link") {
    assert.equal(cms.href, "/cms");
  }
});

test("admin sidebar items array is frozen", () => {
  assert.ok(Object.isFrozen(ADMIN_SIDEBAR_ITEMS));
});

test("admin header title maps exact known admin paths to Turkish section labels", () => {
  assert.equal(resolveAdminHeaderTitle("/admin"), "Dashboard");
  assert.equal(resolveAdminHeaderTitle("/admin/listings"), "İlanlar");
  assert.equal(resolveAdminHeaderTitle("/admin/operations"), "Operasyonlar");
  assert.equal(resolveAdminHeaderTitle("/admin/users"), "Adminler");
  assert.equal(
    resolveAdminHeaderTitle("/admin/content/posts"),
    "Blog Yazıları",
  );
  assert.equal(
    resolveAdminHeaderTitle("/admin/content/categories"),
    "Blog Kategorileri",
  );
  assert.equal(
    resolveAdminHeaderTitle("/admin/content/consultants"),
    "Danışmanlar",
  );
});

test("admin header title resolves nested admin paths to the parent section label", () => {
  assert.equal(resolveAdminHeaderTitle("/admin/listings/abc-123"), "İlanlar");
  assert.equal(
    resolveAdminHeaderTitle("/admin/operations/queue"),
    "Operasyonlar",
  );
  assert.equal(resolveAdminHeaderTitle("/admin/users/invites"), "Adminler");
  assert.equal(
    resolveAdminHeaderTitle("/admin/content/posts/abc-123"),
    "Blog Yazıları",
  );
  assert.equal(
    resolveAdminHeaderTitle("/admin/content/categories/abc-123"),
    "Blog Kategorileri",
  );
  assert.equal(
    resolveAdminHeaderTitle("/admin/content/consultants/abc-123"),
    "Danışmanlar",
  );
});

test("admin header title falls back to Admin for unknown or empty paths", () => {
  assert.equal(resolveAdminHeaderTitle("/admin/unknown"), "Admin");
  assert.equal(resolveAdminHeaderTitle("/"), "Admin");
  assert.equal(resolveAdminHeaderTitle(""), "Admin");
});
