import assert from "node:assert/strict";
import test from "node:test";

import {
  ADMIN_LISTING_DETAIL_TABS,
  DEFAULT_ADMIN_LISTING_DETAIL_TAB,
  getAdminListingDetailTabsForType,
  resolveAdminListingDetailTab,
  type AdminListingDetailTabId,
} from "../lib/admin-ui/listings-product-layout.ts";

test("admin listings detail tabs expose the product panel order", () => {
  assert.deepEqual(
    ADMIN_LISTING_DETAIL_TABS.map((tab) => ({ id: tab.id, label: tab.label })),
    [
      { id: "general", label: "Genel Bilgiler" },
      { id: "images", label: "Görseller" },
      { id: "main-items", label: "Ana Ödeme Kalemleri" },
      { id: "services", label: "Ek Hizmetler" },
      { id: "checkout", label: "Checkout Hazırlığı" },
    ],
  );
});

test("sale listing detail tabs hide all checkout configuration surfaces", () => {
  assert.deepEqual(
    getAdminListingDetailTabsForType("sale").map((tab) => tab.id),
    ["general", "images"],
  );
});

test("rent listing detail tabs keep checkout configuration surfaces", () => {
  assert.deepEqual(
    getAdminListingDetailTabsForType("rent").map((tab) => tab.id),
    ADMIN_LISTING_DETAIL_TABS.map((tab) => tab.id),
  );
});

test("admin listings detail tab ids stay unique so DOM panel keys do not collide", () => {
  const ids = ADMIN_LISTING_DETAIL_TABS.map((tab) => tab.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("admin listings detail tabs array is frozen so callers cannot mutate the tab contract", () => {
  assert.ok(Object.isFrozen(ADMIN_LISTING_DETAIL_TABS));
});

test("default detail tab is the general info tab", () => {
  assert.equal(DEFAULT_ADMIN_LISTING_DETAIL_TAB, "general");
});

test("resolveAdminListingDetailTab returns the requested tab when it is known", () => {
  for (const tab of ADMIN_LISTING_DETAIL_TABS) {
    assert.equal(resolveAdminListingDetailTab(tab.id), tab.id);
  }
});

test("resolveAdminListingDetailTab falls back to the default tab for unknown or empty values", () => {
  assert.equal(
    resolveAdminListingDetailTab("unknown" as AdminListingDetailTabId),
    DEFAULT_ADMIN_LISTING_DETAIL_TAB,
  );
  assert.equal(resolveAdminListingDetailTab(""), DEFAULT_ADMIN_LISTING_DETAIL_TAB);
  assert.equal(
    resolveAdminListingDetailTab(undefined),
    DEFAULT_ADMIN_LISTING_DETAIL_TAB,
  );
});
