import assert from "node:assert/strict";
import test from "node:test";

import { isAbsoluteImageUrl } from "../lib/validation/image-url.ts";

// ─── T5: coverImageUrl / photoUrl absolute URL validation ──────────────────

test("T5 – null/undefined/empty is valid (field is optional)", () => {
  assert.equal(isAbsoluteImageUrl(null), true);
  assert.equal(isAbsoluteImageUrl(undefined), true);
  assert.equal(isAbsoluteImageUrl(""), true);
});

test("T5 – https:// URL is valid", () => {
  assert.equal(isAbsoluteImageUrl("https://cdn.nihaiemlak.com/blog.jpg"), true);
  assert.equal(isAbsoluteImageUrl("https://example.com/image.png"), true);
});

test("T5 – http:// URL is valid", () => {
  assert.equal(isAbsoluteImageUrl("http://localhost:3000/image.jpg"), true);
});

test("T5 – relative path /uploads/blog.jpg is rejected", () => {
  assert.equal(isAbsoluteImageUrl("/uploads/blog.jpg"), false);
});

test("T5 – relative path without slash is rejected", () => {
  assert.equal(isAbsoluteImageUrl("uploads/blog.jpg"), false);
});

test("T5 – ftp:// protocol is rejected", () => {
  assert.equal(isAbsoluteImageUrl("ftp://files.example.com/image.jpg"), false);
});

test("T5 – data: URI is rejected", () => {
  assert.equal(isAbsoluteImageUrl("data:image/png;base64,abc"), false);
});

test("T5 – random string is rejected", () => {
  assert.equal(isAbsoluteImageUrl("not-a-url"), false);
});
