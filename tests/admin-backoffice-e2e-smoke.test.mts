import assert from "node:assert/strict";
import test from "node:test";

import {
  ADMIN_ROUTES,
  assertNoActionableBrowserErrors,
  assertNoAdminRegressionText,
  createAdminE2EPage,
  loginAsAdmin,
} from "./helpers/admin-e2e.ts";

test("admin backoffice pages render without content response regressions", async () => {
  const context = await createAdminE2EPage();
  const { browser, page } = context;

  try {
    await loginAsAdmin(page);

    for (const route of ADMIN_ROUTES) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);

      assert.equal(new URL(page.url()).pathname, route, `${route} should not redirect away`);
      await assertNoAdminRegressionText(page);
    }

    assertNoActionableBrowserErrors(context);
  } finally {
    await browser.close();
  }
});
