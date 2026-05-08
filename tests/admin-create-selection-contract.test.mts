import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const CREATE_VIEWS = [
  {
    path: "components/admin-posts/AdminPostsView.tsx",
    createCall: "createAdminPost",
    forbiddenReturn: "readIdFromMutation",
  },
  {
    path: "components/admin-categories/AdminCategoriesView.tsx",
    createCall: "createAdminCategory",
    forbiddenReturn: "readIdFromMutation",
  },
  {
    path: "components/admin-consultants/AdminConsultantsView.tsx",
    createCall: "createAdminConsultant",
    forbiddenReturn: "readIdFromMutation",
  },
  {
    path: "components/admin-listings/AdminListingsView.tsx",
    createCall: "createAdminListing",
    forbiddenReturn: "readListingIdFromMutation",
  },
];

test("admin create flows do not auto-select the newly created item", () => {
  for (const view of CREATE_VIEWS) {
    const source = readFileSync(resolve(import.meta.dirname, "..", view.path), "utf-8");
    const createBlockPattern = new RegExp(`${view.createCall}[\\s\\S]*?setShowCreate\\(false\\);[\\s\\S]*?return null;`);
    const forbiddenPattern = new RegExp(`${view.createCall}[\\s\\S]*?return ${view.forbiddenReturn}\\(`);

    assert.match(source, createBlockPattern, `${view.path} create flow must return null after create`);
    assert.doesNotMatch(source, forbiddenPattern, `${view.path} must not return created id from create flow`);
  }
});
