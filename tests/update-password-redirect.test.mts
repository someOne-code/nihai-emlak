import assert from "node:assert/strict";
import test from "node:test";

import { resolveSafeAuthRedirect } from "../lib/auth/redirect.ts";

test("password update redirect accepts safe relative admin paths", () => {
  assert.equal(resolveSafeAuthRedirect("/admin"), "/admin");
  assert.equal(resolveSafeAuthRedirect("/admin/users"), "/admin/users");
});

test("password update redirect rejects external or protocol-relative targets", () => {
  assert.equal(resolveSafeAuthRedirect("https://evil.example/admin"), "/admin");
  assert.equal(resolveSafeAuthRedirect("//evil.example/admin"), "/admin");
  assert.equal(resolveSafeAuthRedirect(""), "/admin");
  assert.equal(resolveSafeAuthRedirect(null), "/admin");
});
