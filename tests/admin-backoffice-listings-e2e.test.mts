import assert from "node:assert/strict";
import test from "node:test";

import type { Page } from "playwright";

import {
  assertBodyContains,
  assertNoActionableBrowserErrors,
  assertNoAdminRegressionText,
  clickAdminSidebarLink,
  clickFirstVisible,
  createAdminE2EPage,
  loginAsAdmin,
} from "./helpers/admin-e2e.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function selectListing(page: Page, title: string): Promise<void> {
  await clickFirstVisible(page, "button", title);
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(400);
}

async function clickTabById(page: Page, tabId: string): Promise<void> {
  const btn = page.locator(`#lstTabButton-${tabId}`);
  await btn.waitFor({ state: "visible", timeout: 5_000 });
  await btn.click();
  await page.locator(`#lstTabPanel-${tabId}:not([hidden])`).waitFor({
    state: "visible",
    timeout: 3_000,
  }).catch(() => undefined);
  await page.waitForTimeout(200);
}

async function getButtonState(
  page: Page,
  buttonText: string,
): Promise<{ visible: boolean; disabled: boolean }> {
  const btn = page.locator("button").filter({ hasText: buttonText }).first();
  const visible = (await btn.count()) > 0 && (await btn.isVisible());
  const disabled = visible ? await btn.isDisabled() : true;
  return { visible, disabled };
}

async function panelText(page: Page, tabId: string): Promise<string> {
  const panel = page.locator(`#lstTabPanel-${tabId}:not([hidden])`);
  if ((await panel.count()) === 0) return "";
  return panel.innerText();
}

// ---------------------------------------------------------------------------
// Single parent test — guarantees sequential subtests sharing one browser
// ---------------------------------------------------------------------------
test("admin listings e2e", async (t) => {
  const context = await createAdminE2EPage();
  const { browser, page } = context;

  try {
    await loginAsAdmin(page);
    await clickAdminSidebarLink(page, "/admin/listings");

    // ----- 1) Page loads -----
    await t.test("page loads with listing list and no regression text", async () => {
      await assertNoAdminRegressionText(page);
      const text = await page.locator("body").innerText();
      assert.match(text, /Phase/i, "at least one listing should appear");
    });

    // ----- 2) Rent + Active -----
    await t.test("active rent listing: Yayında badge, Yayından kaldır enabled", async () => {
      await selectListing(page, "Phase 8 Rent With Main");
      await assertBodyContains(page, "Phase 8 Rent With Main");

      const publish = await getButtonState(page, "Yayına al");
      assert.ok(publish.disabled, "Yayına al disabled for active listing");

      const unpublish = await getButtonState(page, "Yayından kaldır");
      assert.ok(!unpublish.disabled, "Yayından kaldır enabled for active listing");
    });

    // ----- 3) Rent + Passive + Checkout Ready -----
    await t.test("passive checkout-ready rent: Yayına al enabled, no warning", async () => {
      await selectListing(page, "Phase 8 Rent Main No Service");
      await assertBodyContains(page, "Phase 8 Rent Main No Service");

      const text = await page.locator("body").innerText();
      assert.match(text, /Yayın dışı/);

      const publish = await getButtonState(page, "Yayına al");
      assert.ok(!publish.disabled, "Yayına al enabled when checkout ready");
      assert.doesNotMatch(text, /ana ödeme kalemini yapılandırın/i);
    });

    // ----- 4) Rent + Passive + Checkout NOT Ready -----
    await t.test("passive checkout-incomplete rent: Yayına al disabled + warning", async () => {
      await selectListing(page, "Phase 8 Rent Without Main");
      await assertBodyContains(page, "Phase 8 Rent Without Main");

      const text = await page.locator("body").innerText();
      assert.match(text, /Yayın dışı/);

      const publish = await getButtonState(page, "Yayına al");
      assert.ok(publish.disabled, "Yayına al disabled without checkout");
      assert.match(text, /ana ödeme kalemini yapılandırın/i);
    });

    // ----- 5) Sale listing → main-items, services, and checkout tabs absent -----
    await t.test("sale listing hides main-items, services and checkout tabs", async () => {
      await selectListing(page, "Phase E Sale Listing");
      await assertBodyContains(page, "Phase E Sale Listing");

      assert.equal(await page.locator("#lstTabButton-main-items").count(), 0);
      assert.equal(await page.locator("#lstTabButton-services").count(), 0);
      assert.equal(await page.locator("#lstTabButton-checkout").count(), 0);
      assert.ok((await page.locator("#lstTabButton-general").count()) > 0);
    });

    // ----- 6) Rent listing → all 5 tabs -----
    await t.test("rent listing shows all 5 detail tabs", async () => {
      await selectListing(page, "Phase 8 Rent With Main");
      await assertBodyContains(page, "Phase 8 Rent With Main");

      for (const id of ["general", "images", "main-items", "services", "checkout"]) {
        assert.ok(
          (await page.locator(`#lstTabButton-${id}`).count()) > 0,
          `Tab "${id}" should exist`,
        );
      }
    });

    // ----- 7) Services tab locked when no main item -----
    await t.test("services tab locked when no main item", async () => {
      await selectListing(page, "Phase 8 Rent Without Main");
      await assertBodyContains(page, "Phase 8 Rent Without Main");
      await clickTabById(page, "services");

      const text = await panelText(page, "services");
      assert.match(text, /Ana Ödeme Kalemleri/i);
      assert.match(text, /ana ödeme kalemi/i);
    });

    // ----- 8) Services tab unlocked with main item -----
    await t.test("services tab shows controls when main item exists", async () => {
      await selectListing(page, "Phase 8 Rent With Main");
      await assertBodyContains(page, "Phase 8 Rent With Main");
      await clickTabById(page, "services");

      const text = await panelText(page, "services");
      assert.doesNotMatch(text, /ana ödeme kalemi ekleyin/i);
      assert.match(text, /Ek Hizmetler/i);
    });

    // ----- 9) Checkout tab — ready + configuration summary -----
    await t.test("checkout tab shows ready status and config summary", async () => {
      await selectListing(page, "Phase 8 Rent With Main");
      await clickTabById(page, "checkout");

      const text = await panelText(page, "checkout");
      assert.match(text, /Checkout|hazır/i);
      // Configuration summary should list at least one main item
      assert.match(text, /Yapılandırma Özeti/i, "should show configuration summary");
      assert.match(text, /Ana Ödeme Kalemleri/i, "should list main items");
    });

    // ----- 10) Checkout tab — missing items + empty config -----
    await t.test("checkout tab shows missing for incomplete rent listing", async () => {
      await selectListing(page, "Phase 8 Rent Without Main");
      await assertBodyContains(page, "Phase 8 Rent Without Main");
      await clickTabById(page, "checkout");

      const text = await panelText(page, "checkout");
      assert.match(text, /eksik|Hazır değil/i);
      // No configured items — should show empty state
      assert.match(text, /Henüz yapılandırılmış|Yapılandırma Özeti/i);
    });

    // ----- 11) Publish flow -----
    await t.test("publish a checkout-ready passive rent listing", async () => {
      await selectListing(page, "Phase 8 Rent Main No Service");
      await clickTabById(page, "general");

      let text = await page.locator("body").innerText();
      assert.match(text, /Yayın dışı/, "should start passive");

      await page.locator("button").filter({ hasText: "Yayına al" }).first().click();
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
      await page.waitForTimeout(1000);

      text = await page.locator("body").innerText();
      assert.match(text, /Yayında/, "should become active");
    });

    // ----- 12) Unpublish flow (cleanup) -----
    await t.test("unpublish the listing back to passive", async () => {
      // listing is active from previous subtest
      await page.locator("button").filter({ hasText: "Yayından kaldır" }).first().click();
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
      await page.waitForTimeout(1000);

      const text = await page.locator("body").innerText();
      assert.match(text, /Yayın dışı/, "should become passive");
    });

    // ----- 13) List badges -----
    await t.test("rent cards show checkout badge, sale cards do not", async () => {
      const rentCard = page.locator("button").filter({ hasText: "Phase 8 Rent With Main" }).first();
      assert.match(await rentCard.innerText(), /Checkout/i);

      const saleCard = page.locator("button").filter({ hasText: "Phase E Sale Listing" }).first();
      assert.doesNotMatch(await saleCard.innerText(), /Checkout/i);
    });

    assertNoActionableBrowserErrors(context);
  } finally {
    await browser.close();
  }
});
