import assert from "node:assert/strict";

import { chromium, type Browser, type Page } from "playwright";

export const ADMIN_E2E_BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
export const ADMIN_E2E_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "smoke-admin@example.test";
export const ADMIN_E2E_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "smoke-admin-2026";

export const ADMIN_ROUTES = [
  "/admin",
  "/admin/listings",
  "/admin/operations",
  "/admin/users",
  "/admin/communications",
  "/admin/system",
  "/admin/sale-leads",
  "/admin/listing-catalog",
  "/admin/content/posts",
  "/admin/content/categories",
  "/admin/content/consultants",
] as const;

export type AdminE2EContext = {
  browser: Browser;
  consoleErrors: string[];
  failedRequests: string[];
  page: Page;
};

export async function createAdminE2EPage(): Promise<AdminE2EContext> {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ baseURL: ADMIN_E2E_BASE_URL });
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("requestfailed", (request) => {
    failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`.trim());
  });

  return { browser, consoleErrors, failedRequests, page };
}

export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto(`/auth/login?redirect=${encodeURIComponent("/admin")}`, { waitUntil: "networkidle" });
  await page.locator("#email").fill(ADMIN_E2E_EMAIL);
  await page.locator("#password").fill(ADMIN_E2E_PASSWORD);
  await page.locator("form").evaluate((form) => {
    (form as HTMLFormElement).requestSubmit();
  });
  await page.waitForURL("**/admin", { timeout: 20_000 });
}

export async function clickAdminSidebarLink(page: Page, href: string): Promise<void> {
  const link = page.locator(`#admin-sidebar a[href="${href}"]:visible`);
  assert.equal(await link.count(), 1, `${href} sidebar link should be visible exactly once`);
  await Promise.all([
    page.waitForURL(`**${href}`, { timeout: 15_000, waitUntil: "domcontentloaded" }),
    link.click(),
  ]);
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  assert.equal(new URL(page.url()).pathname, href, `sidebar link should navigate to ${href}`);
}

export async function clickFirstVisible(page: Page, selector: string, text: string): Promise<void> {
  const target = page.locator(selector).filter({ hasText: text }).first();
  await target.click();
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
}

export async function fillVisiblePlaceholder(page: Page, placeholder: string, value: string): Promise<void> {
  await page.locator(`input[placeholder="${placeholder}"]:visible`).fill(value);
}

export async function assertBodyContains(page: Page, text: string): Promise<void> {
  const bodyText = await page.locator("body").innerText();
  assert.match(bodyText, new RegExp(escapeRegExp(text), "i"));
}

export async function assertNoAdminRegressionText(page: Page): Promise<void> {
  const bodyText = await page.locator("body").innerText();
  assert.doesNotMatch(bodyText, /Invalid content admin response/i);
  assert.doesNotMatch(bodyText, /Authentication required/i);
  assert.doesNotMatch(bodyText, /Admin role required/i);
  assert.doesNotMatch(bodyText, /relation "payload\./i);
}

export function assertNoActionableBrowserErrors(
  context: Pick<AdminE2EContext, "consoleErrors" | "failedRequests">,
): void {
  assert.deepEqual(context.failedRequests.filter(isActionableFailedRequest), []);
  assert.deepEqual(context.consoleErrors.filter(isActionableConsoleError), []);
}

function isActionableConsoleError(entry: string): boolean {
  return ![
    "Applying inline style violates the following Content Security Policy directive",
    "Encountered a script tag while rendering React component",
    "Failed to load resource: the server responded with a status of 404 (Not Found)",
  ].some((ignored) => entry.includes(ignored));
}

function isActionableFailedRequest(entry: string): boolean {
  return ![
    "net::ERR_ABORTED",
    "net::ERR_NETWORK_CHANGED",
  ].some((ignored) => entry.includes(ignored));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
