import assert from "node:assert/strict";
import test from "node:test";

import { isProtectedPath } from "../lib/supabase/proxy-auth-guard.ts";

// ─── T8: middleware dashboard/account/checkout guard ───────────────────────

test("T8 – /dashboard requires auth", () => {
  assert.equal(isProtectedPath("/dashboard"), true);
  assert.equal(isProtectedPath("/dashboard/overview"), true);
});

test("T8 – /account requires auth", () => {
  assert.equal(isProtectedPath("/account"), true);
  assert.equal(isProtectedPath("/account/settings"), true);
});

test("T8 – /checkout requires auth", () => {
  assert.equal(isProtectedPath("/checkout"), true);
  assert.equal(isProtectedPath("/checkout/some-listing"), true);
});

test("T8 – /protected requires auth (existing behaviour)", () => {
  assert.equal(isProtectedPath("/protected"), true);
  assert.equal(isProtectedPath("/protected/page"), true);
});

test("T8 – /admin requires auth", () => {
  assert.equal(isProtectedPath("/admin"), true);
  assert.equal(isProtectedPath("/admin/listings"), true);
  assert.equal(isProtectedPath("/admin/operations"), true);
});

// ─── Public checkout return paths ──────────────────────────────────────────

test("T8 – /checkout/success is public", () => {
  assert.equal(isProtectedPath("/checkout/success"), false);
  assert.equal(isProtectedPath("/checkout/success?orderId=123"), false);
});

test("T8 – /checkout/fail is public", () => {
  assert.equal(isProtectedPath("/checkout/fail"), false);
  assert.equal(isProtectedPath("/checkout/fail?reason=timeout"), false);
});

// ─── Public paths ──────────────────────────────────────────────────────────

test("T8 – / (root) is public", () => {
  assert.equal(isProtectedPath("/"), false);
});

test("T8 – /auth/* is public", () => {
  assert.equal(isProtectedPath("/auth/login"), false);
  assert.equal(isProtectedPath("/auth/sign-up"), false);
  assert.equal(isProtectedPath("/auth/confirm"), false);
});

test("T8 – /api/* is not affected by page guard", () => {
  assert.equal(isProtectedPath("/api/checkout/init"), false);
  assert.equal(isProtectedPath("/api/blogs"), false);
});

test("T8 – /cms/* (Payload admin) is not affected by page guard", () => {
  assert.equal(isProtectedPath("/cms"), false);
  assert.equal(isProtectedPath("/cms/admin"), false);
});
