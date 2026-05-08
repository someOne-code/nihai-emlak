import test from "node:test";

import {
  assertNoActionableBrowserErrors,
  assertNoAdminRegressionText,
  clickAdminSidebarLink,
  createAdminE2EPage,
  fillVisiblePlaceholder,
  loginAsAdmin,
} from "./helpers/admin-e2e.ts";

test("admin content pages expose searchable controls", async () => {
  const context = await createAdminE2EPage();
  const { browser, page } = context;

  try {
    await loginAsAdmin(page);

    await clickAdminSidebarLink(page, "/admin/content/posts");
    await fillVisiblePlaceholder(page, "Başlıkta ara...", "phase");
    await assertNoAdminRegressionText(page);

    await clickAdminSidebarLink(page, "/admin/content/categories");
    await fillVisiblePlaceholder(page, "Başlıkta ara...", "phase");
    await assertNoAdminRegressionText(page);

    await clickAdminSidebarLink(page, "/admin/content/consultants");
    await fillVisiblePlaceholder(page, "Ada göre ara...", "phase");
    await assertNoAdminRegressionText(page);

    assertNoActionableBrowserErrors(context);
  } finally {
    await browser.close();
  }
});
