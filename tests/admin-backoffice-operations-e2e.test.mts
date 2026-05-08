import test from "node:test";

import {
  assertBodyContains,
  assertNoActionableBrowserErrors,
  assertNoAdminRegressionText,
  clickAdminSidebarLink,
  clickFirstVisible,
  createAdminE2EPage,
  fillVisiblePlaceholder,
  loginAsAdmin,
} from "./helpers/admin-e2e.ts";

test("admin operations filters and queue controls are clickable", async () => {
  const context = await createAdminE2EPage();
  const { browser, page } = context;

  try {
    await loginAsAdmin(page);

    await clickAdminSidebarLink(page, "/admin/operations");
    await fillVisiblePlaceholder(page, "İlan, müşteri, telefon, e-posta veya rezervasyon no ara...", "Kadikoy");
    await assertBodyContains(page, "Phase 5 Active Listing");
    await clickFirstVisible(page, "button", "Belge Bekleyenler");
    await assertNoAdminRegressionText(page);

    assertNoActionableBrowserErrors(context);
  } finally {
    await browser.close();
  }
});
