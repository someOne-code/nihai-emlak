import assert from "node:assert/strict";
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

test("admin users page validates and sends a real admin invite", async () => {
  const context = await createAdminE2EPage();
  const { browser, page } = context;
  const inviteEmail = `e2e-admin-${Date.now()}@example.test`;

  try {
    await loginAsAdmin(page);
    await clickAdminSidebarLink(page, "/admin/users");

    const emailInput = page.locator("#admin-email");
    await emailInput.fill("not-an-email");
    await page.getByRole("button", { name: /Davet gönder/i }).click();

    const validationMessage = await emailInput.evaluate(
      (input) => (input as HTMLInputElement).validationMessage,
    );
    assert.notEqual(validationMessage, "");

    await emailInput.fill(inviteEmail);
    const inviteResponsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/admin/users/invite") &&
        response.request().method() === "POST",
      { timeout: 15_000 },
    );
    await page.getByRole("button", { name: /Davet gönder/i }).click();
    const inviteResponse = await inviteResponsePromise;

    assert.equal(inviteResponse.status(), 200);
    await page
      .getByText(`${inviteEmail} için admin daveti gönderildi.`)
      .waitFor({ timeout: 15_000 });
    await page.locator("table").getByText(inviteEmail).waitFor({ timeout: 15_000 });
    await assertNoAdminRegressionText(page);
    assertNoActionableBrowserErrors(context);
  } finally {
    await browser.close();
  }
});
