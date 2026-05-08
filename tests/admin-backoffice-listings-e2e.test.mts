import test from "node:test";

import {
  assertBodyContains,
  assertNoActionableBrowserErrors,
  assertNoAdminRegressionText,
  clickAdminSidebarLink,
  clickFirstVisible,
  createAdminE2EPage,
  loginAsAdmin,
} from "./helpers/admin-e2e.ts";

test("admin listings sidebar flow selects a listing and keeps browser errors clean", async () => {
  const context = await createAdminE2EPage();
  const { browser, page } = context;

  try {
    await loginAsAdmin(page);

    await clickAdminSidebarLink(page, "/admin/listings");
    await clickFirstVisible(page, "button", "Phase 5 Active Listing");
    await assertBodyContains(page, "Phase 5 Active Listing");
    await assertNoAdminRegressionText(page);

    assertNoActionableBrowserErrors(context);
  } finally {
    await browser.close();
  }
});
