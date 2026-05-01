import assert from "node:assert/strict";
import test from "node:test";

import {
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
      { label: "CMS", href: "/cms" },
    ],
  );
});

test("admin sidebar links array is frozen so callers cannot mutate the nav contract", () => {
  assert.ok(Object.isFrozen(ADMIN_SIDEBAR_LINKS));
});

test("admin header title maps exact known admin paths to Turkish section labels", () => {
  assert.equal(resolveAdminHeaderTitle("/admin"), "Dashboard");
  assert.equal(resolveAdminHeaderTitle("/admin/listings"), "İlanlar");
  assert.equal(resolveAdminHeaderTitle("/admin/operations"), "Operasyonlar");
});

test("admin header title resolves nested admin paths to the parent section label", () => {
  assert.equal(resolveAdminHeaderTitle("/admin/listings/abc-123"), "İlanlar");
  assert.equal(
    resolveAdminHeaderTitle("/admin/operations/queue"),
    "Operasyonlar",
  );
});

test("admin header title falls back to Admin for unknown or empty paths", () => {
  assert.equal(resolveAdminHeaderTitle("/admin/unknown"), "Admin");
  assert.equal(resolveAdminHeaderTitle("/"), "Admin");
  assert.equal(resolveAdminHeaderTitle(""), "Admin");
});
