// Phase 9A Task 6: Consultants API contract tests.
//
// Strategy: handler files import @payload-config at module level (which
// requires env vars) so we test the route contract via two layers:
//   1. Guard layer (content-shared.ts) — 401/403/500 coverage
//   2. Body-parser layer (exported pure functions from consultants-body-parsers.ts)
//   3. Client layer (content-client.ts) — HTTP shape coverage
//
// Guard tests mirror phase9a-content-posts-route.test.mts but focus on
// the consultant-specific body parser exports which live in a side-effect-free module.

import assert from "node:assert/strict";
import test from "node:test";

import {
  parseConsultantCreateBodyForTest,
  parseConsultantUpdateBodyForTest,
} from "../lib/admin/content-consultants-parsers.ts";

// ── Create body parsing ─────────────────────────────────────────────────────

test("parseConsultantCreateBody returns 400 for non-object body", () => {
  const result = parseConsultantCreateBodyForTest("string");
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 400);
    assert.equal(result.error, "Invalid request body");
  }
});

test("parseConsultantCreateBody returns 400 for array body", () => {
  const result = parseConsultantCreateBodyForTest([{ fullName: "A", slug: "a" }]);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 400);
});

test("parseConsultantCreateBody returns 400 when fullName is missing", () => {
  const result = parseConsultantCreateBodyForTest({ slug: "ali-veli" });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 400);
    assert.ok(result.error.includes("fullName"));
  }
});

test("parseConsultantCreateBody returns 400 when fullName is whitespace-only", () => {
  const result = parseConsultantCreateBodyForTest({ fullName: "   ", slug: "ali" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.includes("fullName"));
});

test("parseConsultantCreateBody auto-generates slug from fullName when slug is missing", () => {
  const result = parseConsultantCreateBodyForTest({ fullName: "Ali Veli" });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.slug, "ali-veli");
  }
});

test("parseConsultantCreateBody auto-generates slug from fullName when slug is empty string", () => {
  const result = parseConsultantCreateBodyForTest({ fullName: "Ali Veli", slug: "" });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.slug, "ali-veli");
  }
});

test("parseConsultantCreateBody succeeds with fullName and slug", () => {
  const result = parseConsultantCreateBodyForTest({ fullName: "Ali Veli", slug: "ali-veli" });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.fullName, "Ali Veli");
    assert.equal(result.value.slug, "ali-veli");
  }
});

test("parseConsultantCreateBody maps optional fields correctly", () => {
  const result = parseConsultantCreateBodyForTest({
    fullName: "Ayşe Kaya",
    slug: "ayse-kaya",
    title: "Danışman",
    photoUrl: "https://example.com/photo.jpg",
    shortBio: "Bio text",
    phone: "+905551234567",
    email: "ayse@example.com",
    whatsappUrl: "https://wa.me/905551234567",
    linkedinUrl: "https://linkedin.com/in/ayse",
    isPublished: true,
    sortOrder: 3,
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.title, "Danışman");
    assert.equal(result.value.email, "ayse@example.com");
    assert.equal(result.value.isPublished, true);
    assert.equal(result.value.sortOrder, 3);
  }
});

test("parseConsultantCreateBody coerces empty optional strings to null", () => {
  const result = parseConsultantCreateBodyForTest({
    fullName: "Ali Veli",
    slug: "ali-veli",
    title: "   ",
    phone: "",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.title, null);
    assert.equal(result.value.phone, null);
  }
});

// ── Update body parsing ─────────────────────────────────────────────────────

test("parseConsultantUpdateBody returns 400 for non-object body", () => {
  const result = parseConsultantUpdateBodyForTest(null);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 400);
});

test("parseConsultantUpdateBody returns 400 when no fields provided", () => {
  const result = parseConsultantUpdateBodyForTest({});
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.includes("No fields"));
});

test("parseConsultantUpdateBody returns 400 when fullName is empty string", () => {
  const result = parseConsultantUpdateBodyForTest({ fullName: "   " });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.includes("fullName"));
});

test("parseConsultantUpdateBody returns 400 when slug is empty string", () => {
  const result = parseConsultantUpdateBodyForTest({ slug: "" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.toLowerCase().includes("slug"));
});

test("parseConsultantUpdateBody returns 400 when sortOrder is a string", () => {
  const result = parseConsultantUpdateBodyForTest({ sortOrder: "five" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.includes("sortOrder"));
});

test("parseConsultantUpdateBody succeeds with valid fullName update", () => {
  const result = parseConsultantUpdateBodyForTest({ fullName: "Updated Name" });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.fullName, "Updated Name");
});

test("parseConsultantUpdateBody succeeds with partial update of optional fields", () => {
  const result = parseConsultantUpdateBodyForTest({
    phone: "+90555",
    isPublished: false,
    sortOrder: 10,
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.phone, "+90555");
    assert.equal(result.value.isPublished, false);
    assert.equal(result.value.sortOrder, 10);
  }
});

test("parseConsultantUpdateBody allows null to clear optional fields", () => {
  const result = parseConsultantUpdateBodyForTest({ photoUrl: null, shortBio: null });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.photoUrl, null);
    assert.equal(result.value.shortBio, null);
  }
});

test("parseConsultantUpdateBody trims whitespace from non-empty string fields", () => {
  const result = parseConsultantUpdateBodyForTest({ fullName: "  Trimmed  " });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.fullName, "Trimmed");
});

test("consultant DTO exposes preview link and related contact counts", async () => {
  const { toConsultantDTOForTest } = await import("../lib/admin/content-consultants-dto.ts");

  const dto = toConsultantDTOForTest({
    id: 7,
    fullName: "Ali Veli",
    slug: "ali-veli",
    title: "Consultant",
    phone: "+90555",
    email: "ali@example.com",
    whatsappUrl: "https://wa.me/90555",
    linkedinUrl: "https://linkedin.com/in/ali",
    isPublished: true,
    createdAt: "2024-01-01",
    updatedAt: "2024-01-02",
  });

  assert.equal(dto.previewLink, "/consultants/ali-veli");
  assert.deepEqual(dto.relatedCounts, {
    contactChannels: 3,
    externalLinks: 1,
  });
});

test("consultants list query selects only fields needed to open the edit form", async () => {
  const { buildConsultantsListFindArgs } = await import(
    "../lib/admin/content-consultants-query.ts"
  );

  const args = buildConsultantsListFindArgs(1, 20);

  assert.equal(args.collection, "consultants");
  assert.equal(args.depth, 0);
  assert.equal(args.sort, "sortOrder");
  assert.equal(args.select.fullName, true);
  assert.equal(args.select.shortBio, true);
  assert.equal(args.select.email, true);
  assert.equal(args.select.updatedAt, true);
});
