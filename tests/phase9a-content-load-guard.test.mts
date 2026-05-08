import assert from "node:assert/strict";
import test from "node:test";

import {
  createInitialLoadGuard,
  shouldStartInitialLoad,
} from "../lib/admin-ui/initial-load-guard.ts";

test("initial load guard allows exactly one initial load per component lifetime", () => {
  const guard = createInitialLoadGuard();

  assert.equal(shouldStartInitialLoad(guard), true);
  assert.equal(shouldStartInitialLoad(guard), false);
  assert.equal(shouldStartInitialLoad(guard), false);
});
