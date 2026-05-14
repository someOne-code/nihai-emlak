// Phase 9A Task 10: Consultants UI contract tests.
//
// Pure helper / copy-constant tests only. No React, no DOM, no fetch.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { buildConsultantsListViewModel } from "../lib/admin-ui/content-view-model.ts";

// ── Empty state copy ──────────────────────────────────────────────────────────

test("CONSULTANTS_EMPTY_TEXT must be non-empty Turkish copy", async () => {
  const { CONSULTANTS_EMPTY_TEXT } = await import(
    "../lib/admin-ui/content-consultants-ui-helpers.ts"
  );
  assert.ok(CONSULTANTS_EMPTY_TEXT.length > 0, "must be non-empty");
});

test("consultant mutation refresh captures a non-null detail id before deferred detail reload", () => {
  const source = readFileSync(
    resolve(import.meta.dirname, "..", "components", "admin-consultants", "AdminConsultantsView.tsx"),
    "utf-8",
  );

  assert.match(
    source,
    /if \(consultantId\) \{\s+const selectedConsultantId = consultantId;\s+await refreshContentViews\(\[\s+\(\) => loadList\(\),\s+\(\) => loadConsultantDetail\(selectedConsultantId\),\s+\]\);/s,
  );
});

test("CONSULTANTS_FILTERED_EMPTY_TEXT must be non-empty", async () => {
  const { CONSULTANTS_FILTERED_EMPTY_TEXT } = await import(
    "../lib/admin-ui/content-consultants-ui-helpers.ts"
  );
  assert.ok(CONSULTANTS_FILTERED_EMPTY_TEXT.length > 0, "must be non-empty");
});

test("ConsultantRow carries enough detail to open the edit form without a second detail fetch", () => {
  const vm = buildConsultantsListViewModel({
    items: [{
      id: "c1",
      fullName: "Smoke Consultant",
      slug: "smoke-consultant",
      title: "Advisor",
      photoUrl: "https://example.test/photo.jpg",
      shortBio: "Bio",
      phone: "+905551112233",
      email: "smoke@example.test",
      whatsappUrl: "https://wa.me/905551112233",
      linkedinUrl: "https://linkedin.com/in/smoke",
      isPublished: true,
      sortOrder: 3,
      previewLink: "/consultants/smoke-consultant",
      relatedCounts: { contactChannels: 3, externalLinks: 1 },
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-02T00:00:00Z",
    }],
    total: 1,
    page: 1,
    totalPages: 1,
  });

  assert.equal(vm.rows[0].detail.fullName, "Smoke Consultant");
  assert.equal(vm.rows[0].detail.email, "smoke@example.test");
  assert.equal(vm.rows[0].detail.relatedCounts.externalLinks, 1);
});

test("selecting a consultant uses the row detail immediately instead of refetching detail", () => {
  const source = readFileSync(
    resolve(import.meta.dirname, "..", "components", "admin-consultants", "AdminConsultantsView.tsx"),
    "utf-8",
  );

  assert.match(source, /const handleSelectConsultant = useCallback\(\(row: ConsultantRowType\)/);
  assert.match(source, /setDetail\(row\.detail\)/);
  assert.doesNotMatch(source, /await loadConsultantDetail\(consultantId\)/);
});

// ── Slug field copy ────────────────────────────────────────────────────────────

test("SLUG_FIELD_LABEL must say 'URL adı' not 'Slug'", async () => {
  const { SLUG_FIELD_LABEL } = await import(
    "../lib/admin-ui/content-consultants-ui-helpers.ts"
  );
  assert.ok(SLUG_FIELD_LABEL.length > 0, "must be non-empty");
  assert.ok(
    !SLUG_FIELD_LABEL.toLowerCase().includes("slug"),
    `Must not contain "slug" jargon: got "${SLUG_FIELD_LABEL}"`,
  );
  assert.ok(
    SLUG_FIELD_LABEL.includes("URL") || SLUG_FIELD_LABEL.includes("url"),
    `Must contain "URL": got "${SLUG_FIELD_LABEL}"`,
  );
});

test("SLUG_FIELD_HELPER must mention auto-generation from name", async () => {
  const { SLUG_FIELD_HELPER } = await import(
    "../lib/admin-ui/content-consultants-ui-helpers.ts"
  );
  assert.ok(SLUG_FIELD_HELPER.length > 0, "must be non-empty");
  const lower = SLUG_FIELD_HELPER.toLowerCase();
  assert.ok(
    lower.includes("otomatik") || lower.includes("auto"),
    `Must mention auto-generation: got "${SLUG_FIELD_HELPER}"`,
  );
});

// ── Publish badge labels ──────────────────────────────────────────────────────

test("IS_PUBLISHED_LABELS must have published and draft keys", async () => {
  const { IS_PUBLISHED_LABELS } = await import(
    "../lib/admin-ui/content-consultants-ui-helpers.ts"
  );
  assert.ok(typeof IS_PUBLISHED_LABELS === "object", "must be an object");
  assert.ok("published" in IS_PUBLISHED_LABELS, "must have 'published' key");
  assert.ok("draft" in IS_PUBLISHED_LABELS, "must have 'draft' key");
  assert.ok(IS_PUBLISHED_LABELS.published.length > 0, "published label must be non-empty");
  assert.ok(IS_PUBLISHED_LABELS.draft.length > 0, "draft label must be non-empty");
});

// ── Photo field copy: must indicate upload is planned, not final UX ───────────

test("PHOTO_FIELD_LABEL must not contain 'URL' jargon for end users", async () => {
  const { PHOTO_FIELD_LABEL } = await import(
    "../lib/admin-ui/content-consultants-ui-helpers.ts"
  );
  assert.ok(PHOTO_FIELD_LABEL.length > 0, "must be non-empty");
  assert.ok(
    !PHOTO_FIELD_LABEL.toUpperCase().includes("URL"),
    `Photo field label must not contain URL jargon: got "${PHOTO_FIELD_LABEL}"`,
  );
});

test("PHOTO_HELPER_TEXT must show file format rules for upload UX", async () => {
  const { PHOTO_HELPER_TEXT } = await import(
    "../lib/admin-ui/content-consultants-ui-helpers.ts"
  );
  assert.ok(PHOTO_HELPER_TEXT.length > 0, "must be non-empty");
  const lower = PHOTO_HELPER_TEXT.toLowerCase();
  assert.ok(
    lower.includes("jpeg") || lower.includes("jpg"),
    `Helper text must mention accepted formats: got "${PHOTO_HELPER_TEXT}"`,
  );
  assert.ok(
    lower.includes("5 mb") || lower.includes("maks"),
    `Helper text must mention size limit: got "${PHOTO_HELPER_TEXT}"`,
  );
});

test("PHOTO_UPLOAD_TEXT must be non-technical upload button label", async () => {
  const { PHOTO_UPLOAD_TEXT } = await import(
    "../lib/admin-ui/content-consultants-ui-helpers.ts"
  );
  assert.ok(PHOTO_UPLOAD_TEXT.length > 0, "must be non-empty");
  assert.ok(
    !PHOTO_UPLOAD_TEXT.toUpperCase().includes("URL"),
    `Upload button must not contain URL jargon: got "${PHOTO_UPLOAD_TEXT}"`,
  );
});

test("PHOTO_REPLACE_TEXT must be non-technical replace button label", async () => {
  const { PHOTO_REPLACE_TEXT } = await import(
    "../lib/admin-ui/content-consultants-ui-helpers.ts"
  );
  assert.ok(PHOTO_REPLACE_TEXT.length > 0, "must be non-empty");
});

test("PHOTO_UPLOADED_STATUS must indicate successful upload", async () => {
  const { PHOTO_UPLOADED_STATUS } = await import(
    "../lib/admin-ui/content-consultants-ui-helpers.ts"
  );
  assert.ok(PHOTO_UPLOADED_STATUS.length > 0, "must be non-empty");
  const lower = PHOTO_UPLOADED_STATUS.toLowerCase();
  assert.ok(
    lower.includes("yüklen") || lower.includes("upload"),
    `Must mention upload success: got "${PHOTO_UPLOADED_STATUS}"`,
  );
});

test("buildConsultantCreatePayload includes uploaded photo URL as photoUrl", async () => {
  const { buildConsultantCreatePayload } = await import(
    "../lib/admin-ui/content-consultants-ui-helpers.ts"
  );
  const uploadedUrl = "https://storage.example.com/content-media/consultants/photos/123-profile.png";
  const payload = buildConsultantCreatePayload({
    fullName: "Test Dan\u0131\u015fman",
    slugState: { slug: "", slugManuallyEdited: false },
    photoUrl: uploadedUrl,
  });
  assert.equal(payload.photoUrl, uploadedUrl, "photoUrl must carry the uploaded URL");
});

test("buildConsultantUpdatePayload includes uploaded photo URL as photoUrl", async () => {
  const { buildConsultantUpdatePayload } = await import(
    "../lib/admin-ui/content-consultants-ui-helpers.ts"
  );
  const uploadedUrl = "https://storage.example.com/content-media/consultants/photos/456-profile.png";
  const payload = buildConsultantUpdatePayload({
    photoUrl: uploadedUrl,
  });
  assert.equal(payload.photoUrl, uploadedUrl, "photoUrl must carry the uploaded URL");
});

// ── Auto-slug UX helpers ──────────────────────────────────────────────────────

test("computeSlugFromFullName regenerates when not manually edited", async () => {
  const { computeSlugFromFullName } = await import(
    "../lib/admin-ui/content-consultants-ui-helpers.ts"
  );
  const result = computeSlugFromFullName("Ahmet Yılmaz", {
    slug: "",
    slugManuallyEdited: false,
  });
  assert.equal(result.slugManuallyEdited, false);
  assert.ok(result.slug.length > 0, "slug must be generated from full name");
});

test("computeSlugFromFullName preserves slug when manually edited", async () => {
  const { computeSlugFromFullName } = await import(
    "../lib/admin-ui/content-consultants-ui-helpers.ts"
  );
  const result = computeSlugFromFullName("Farklı İsim", {
    slug: "ozel-url",
    slugManuallyEdited: true,
  });
  assert.equal(result.slug, "ozel-url");
  assert.equal(result.slugManuallyEdited, true);
});

test("computeSlugFromManualEdit sets slugManuallyEdited flag", async () => {
  const { computeSlugFromManualEdit } = await import(
    "../lib/admin-ui/content-consultants-ui-helpers.ts"
  );
  const result = computeSlugFromManualEdit("manuel-url");
  assert.equal(result.slug, "manuel-url");
  assert.equal(result.slugManuallyEdited, true);
});

// ── Payload builders ──────────────────────────────────────────────────────────

test("buildConsultantCreatePayload sends empty slug when not manually edited", async () => {
  const { buildConsultantCreatePayload } = await import(
    "../lib/admin-ui/content-consultants-ui-helpers.ts"
  );
  const payload = buildConsultantCreatePayload({
    fullName: "Ahmet Yılmaz",
    slugState: { slug: "ahmet-yilmaz", slugManuallyEdited: false },
    title: null,
    photoUrl: null,
    shortBio: null,
    phone: null,
    email: null,
    whatsappUrl: null,
    linkedinUrl: null,
    isPublished: false,
    sortOrder: 0,
  });
  assert.equal(payload.slug, "");
  assert.equal(payload.fullName, "Ahmet Yılmaz");
  assert.equal(payload.isPublished, false);
});

test("buildConsultantCreatePayload sends explicit slug when manually edited", async () => {
  const { buildConsultantCreatePayload } = await import(
    "../lib/admin-ui/content-consultants-ui-helpers.ts"
  );
  const payload = buildConsultantCreatePayload({
    fullName: "Ahmet Yılmaz",
    slugState: { slug: "ozel-slug", slugManuallyEdited: true },
    title: "Yatırım Danışmanı",
    photoUrl: "https://example.com/photo.jpg",
    shortBio: "Kısa bio",
    phone: "+90 555 123 45 67",
    email: "ahmet@example.com",
    whatsappUrl: "https://wa.me/905551234567",
    linkedinUrl: "https://linkedin.com/in/ahmet",
    isPublished: true,
    sortOrder: 5,
  });
  assert.equal(payload.slug, "ozel-slug");
  assert.equal(payload.title, "Yatırım Danışmanı");
  assert.equal(payload.photoUrl, "https://example.com/photo.jpg");
  assert.equal(payload.email, "ahmet@example.com");
  assert.equal(payload.isPublished, true);
  assert.equal(payload.sortOrder, 5);
});

test("buildConsultantUpdatePayload only includes provided fields", async () => {
  const { buildConsultantUpdatePayload } = await import(
    "../lib/admin-ui/content-consultants-ui-helpers.ts"
  );
  const payload = buildConsultantUpdatePayload({
    fullName: "Güncellenmiş Ad",
    isPublished: true,
  });
  assert.equal(payload.fullName, "Güncellenmiş Ad");
  assert.equal(payload.isPublished, true);
  assert.ok(!("phone" in payload), "phone should not be included when not provided");
  assert.ok(!("email" in payload), "email should not be included when not provided");
});

// ── Payload round-trip through parser ─────────────────────────────────────────

test("buildConsultantCreatePayload round-trips through consultant create parser", async () => {
  const { buildConsultantCreatePayload } = await import(
    "../lib/admin-ui/content-consultants-ui-helpers.ts"
  );
  const { parseConsultantCreateBodyForTest } = await import(
    "../lib/admin/content-consultants-parsers.ts"
  );
  const payload = buildConsultantCreatePayload({
    fullName: "Test Danışman",
    slugState: { slug: "", slugManuallyEdited: false },
    title: "Uzman",
    photoUrl: null,
    shortBio: "Bio",
    phone: null,
    email: "test@example.com",
    whatsappUrl: null,
    linkedinUrl: null,
    isPublished: true,
    sortOrder: 2,
  });

  const parsed = parseConsultantCreateBodyForTest(payload);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value.fullName, "Test Danışman");
    assert.ok(parsed.value.slug.length > 0, "parser must auto-generate slug from fullName");
    assert.equal(parsed.value.title, "Uzman");
    assert.equal(parsed.value.email, "test@example.com");
    assert.equal(parsed.value.isPublished, true);
    assert.equal(parsed.value.sortOrder, 2);
  }
});

test("buildConsultantUpdatePayload with slug round-trips through update parser", async () => {
  const { buildConsultantUpdatePayload } = await import(
    "../lib/admin-ui/content-consultants-ui-helpers.ts"
  );
  const { parseConsultantUpdateBodyForTest } = await import(
    "../lib/admin/content-consultants-parsers.ts"
  );
  const payload = buildConsultantUpdatePayload({
    slug: "guncel-slug",
    isPublished: false,
  });

  const parsed = parseConsultantUpdateBodyForTest(payload);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value.slug, "guncel-slug");
    assert.equal(parsed.value.isPublished, false);
  }
});
