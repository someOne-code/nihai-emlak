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

test("admin management pages expose their primary read controls", async () => {
  const context = await createAdminE2EPage();
  const { browser, page } = context;

  try {
    await loginAsAdmin(page);

    await clickAdminSidebarLink(page, "/admin/users");
    await fillVisiblePlaceholder(page, "admin@example.com", "qa-admin@example.test");
    await assertNoAdminRegressionText(page);

    await clickAdminSidebarLink(page, "/admin/communications");
    await fillVisiblePlaceholder(page, "İlan, kullanıcı veya ID ara...", "Phase");
    await assertNoAdminRegressionText(page);

    await clickAdminSidebarLink(page, "/admin/sale-leads");
    await fillVisiblePlaceholder(page, "İlan, müşteri, telefon veya ID ara...", "Phase");
    await assertNoAdminRegressionText(page);

    await clickAdminSidebarLink(page, "/admin/listing-catalog");
    await clickFirstVisible(page, "button", "Ek Hizmetler");
    await assertBodyContains(page, "Ek Hizmetler");
    await assertNoAdminRegressionText(page);

    await clickAdminSidebarLink(page, "/admin/system");
    await clickFirstVisible(page, "button", "Yenile");
    await assertNoAdminRegressionText(page);

    assertNoActionableBrowserErrors(context);
  } finally {
    await browser.close();
  }
});
