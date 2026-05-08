import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const guardedAdminViews = [
  "components/admin-dashboard/AdminDashboardView.tsx",
  "components/admin-users/AdminUsersView.tsx",
  "components/admin-listings/AdminListingsView.tsx",
  "components/admin-catalog/AdminCatalogView.tsx",
  "components/admin-operations/OperationsView.tsx",
  "components/admin-communications/CommunicationsView.tsx",
  "components/admin-sale-leads/SaleLeadsView.tsx",
  "components/admin-posts/AdminPostsView.tsx",
  "components/admin-categories/AdminCategoriesView.tsx",
  "components/admin-consultants/AdminConsultantsView.tsx",
];

test("admin views with mount-time data loads guard their initial fetch", () => {
  const root = process.cwd();

  for (const relativePath of guardedAdminViews) {
    const source = readFileSync(join(root, relativePath), "utf8");

    assert.match(
      source,
      /create(?:Initial|Content)LoadGuard/,
      `${relativePath} should create an initial load guard`,
    );
    assert.match(
      source,
      /shouldStart(?:Initial|Content)Load/,
      `${relativePath} should check the initial load guard before fetching`,
    );
  }
});

test("admin views with mount-time data loads revalidate when the browser tab resumes", () => {
  const root = process.cwd();

  for (const relativePath of guardedAdminViews) {
    const source = readFileSync(join(root, relativePath), "utf8");

    assert.match(
      source,
      /createContentRefreshGate/,
      `${relativePath} should create a resume refresh gate`,
    );
    assert.match(
      source,
      /shouldRefreshContentOnResume/,
      `${relativePath} should throttle resume-triggered refreshes`,
    );
    assert.match(
      source,
      /addEventListener\("focus"/,
      `${relativePath} should refresh after window focus`,
    );
    assert.match(
      source,
      /addEventListener\("visibilitychange"/,
      `${relativePath} should refresh after tab visibility changes`,
    );
  }
});
