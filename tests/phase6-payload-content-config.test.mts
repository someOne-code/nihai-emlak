import assert from "node:assert/strict";
import test from "node:test";

import { BlogCategories } from "../payload/collections/BlogCategories.ts";
import { BlogPosts } from "../payload/collections/BlogPosts.ts";
import { Consultants } from "../payload/collections/Consultants.ts";

type TestContext = { after: (fn: () => void) => void };

async function importPayloadConfigForTest(t: TestContext) {
  const previousEnv = {
    DATABASE_URI: process.env.DATABASE_URI,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NODE_ENV: process.env.NODE_ENV,
    PAYLOAD_SECRET: process.env.PAYLOAD_SECRET,
    SITE_URL: process.env.SITE_URL,
    VERCEL_URL: process.env.VERCEL_URL,
  };

  process.env.NODE_ENV = "test";
  delete process.env.DATABASE_URI;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.PAYLOAD_SECRET;
  delete process.env.SITE_URL;
  delete process.env.VERCEL_URL;

  t.after(() => {
    restoreEnv("DATABASE_URI", previousEnv.DATABASE_URI);
    restoreEnv("NEXT_PUBLIC_SITE_URL", previousEnv.NEXT_PUBLIC_SITE_URL);
    restoreEnv("NODE_ENV", previousEnv.NODE_ENV);
    restoreEnv("PAYLOAD_SECRET", previousEnv.PAYLOAD_SECRET);
    restoreEnv("SITE_URL", previousEnv.SITE_URL);
    restoreEnv("VERCEL_URL", previousEnv.VERCEL_URL);
  });

  const payloadConfigModule = await import("../payload.config.ts");
  return payloadConfigModule.default;
}

test("blog_categories collection exists with correct slug", () => {
  assert.equal(BlogCategories.slug, "blog_categories");
});

test("blog_categories collection has required title field", () => {
  const fields = BlogCategories.fields ?? [];
  const titleField = fields.find((f: { name?: string }) => f.name === "title");

  assert.ok(titleField, "title field should exist");
  assert.equal(titleField.type, "text");
  assert.equal(titleField.required, true);
});

test("blog_categories collection has required unique slug field", () => {
  const fields = BlogCategories.fields ?? [];
  const slugField = fields.find((f: { name?: string }) => f.name === "slug");

  assert.ok(slugField, "slug field should exist");
  assert.equal(slugField.type, "text");
  assert.equal(slugField.required, true);
  assert.equal(slugField.unique, true);
});

test("blog_categories collection has description, isActive, and sortOrder fields", () => {
  const fields = BlogCategories.fields ?? [];

  const descriptionField = fields.find((f: { name?: string }) => f.name === "description");
  assert.ok(descriptionField, "description field should exist");
  assert.equal(descriptionField.type, "textarea");

  const isActiveField = fields.find((f: { name?: string }) => f.name === "isActive");
  assert.ok(isActiveField, "isActive field should exist");
  assert.equal(isActiveField.type, "checkbox");
  assert.equal(isActiveField.defaultValue, true);

  const sortOrderField = fields.find((f: { name?: string }) => f.name === "sortOrder");
  assert.ok(sortOrderField, "sortOrder field should exist");
  assert.equal(sortOrderField.type, "number");
  assert.equal(sortOrderField.defaultValue, 0);
});

test("blog_categories uses active category access helper for public read", () => {
  assert.ok(BlogCategories.access, "access configuration should exist");
  assert.equal(typeof BlogCategories.access?.read, "function");
});

test("blog_posts collection exists with correct slug", () => {
  assert.equal(BlogPosts.slug, "blog_posts");
});

test("blog_posts collection has required title field", () => {
  const fields = BlogPosts.fields ?? [];
  const titleField = fields.find((f: { name?: string }) => f.name === "title");

  assert.ok(titleField, "title field should exist");
  assert.equal(titleField.type, "text");
  assert.equal(titleField.required, true);
});

test("blog_posts collection has required unique slug field", () => {
  const fields = BlogPosts.fields ?? [];
  const slugField = fields.find((f: { name?: string }) => f.name === "slug");

  assert.ok(slugField, "slug field should exist");
  assert.equal(slugField.type, "text");
  assert.equal(slugField.required, true);
  assert.equal(slugField.unique, true);
});

test("blog_posts status is select with draft and published, default draft", () => {
  const fields = BlogPosts.fields ?? [];
  const statusField = fields.find((f: { name?: string }) => f.name === "status");

  assert.ok(statusField, "status field should exist");
  assert.equal(statusField.type, "select");
  assert.equal(statusField.defaultValue, "draft");

  const options = statusField.options ?? [];
  const optionValues = options.map((o: { value: string }) => o.value);
  assert.ok(optionValues.includes("draft"), "should have draft option");
  assert.ok(optionValues.includes("published"), "should have published option");
});

test("blog_posts category is relationship to blog_categories", () => {
  const fields = BlogPosts.fields ?? [];
  const categoryField = fields.find((f: { name?: string }) => f.name === "category");

  assert.ok(categoryField, "category field should exist");
  assert.equal(categoryField.type, "relationship");
  assert.equal(categoryField.relationTo, "blog_categories");
});

test("blog_posts uses published blog access helper for public read", () => {
  assert.ok(BlogPosts.access, "access configuration should exist");
  assert.equal(typeof BlogPosts.access?.read, "function");
});

test("consultants collection exists with correct slug", () => {
  assert.equal(Consultants.slug, "consultants");
});

test("consultants collection has required fullName field", () => {
  const fields = Consultants.fields ?? [];
  const fullNameField = fields.find((f: { name?: string }) => f.name === "fullName");

  assert.ok(fullNameField, "fullName field should exist");
  assert.equal(fullNameField.type, "text");
  assert.equal(fullNameField.required, true);
});

test("consultants collection has required unique slug field", () => {
  const fields = Consultants.fields ?? [];
  const slugField = fields.find((f: { name?: string }) => f.name === "slug");

  assert.ok(slugField, "slug field should exist");
  assert.equal(slugField.type, "text");
  assert.equal(slugField.required, true);
  assert.equal(slugField.unique, true);
});

test("consultants uses published consultant access helper for public read", () => {
  assert.ok(Consultants.access, "access configuration should exist");
  assert.equal(typeof Consultants.access?.read, "function");
});

test("consultants has no relationship to listings", () => {
  const fields = Consultants.fields ?? [];
  const listingRelation = fields.find(
    (f: { name?: string; type?: string; relationTo?: string }) =>
      f.type === "relationship" && f.relationTo === "listings",
  );

  assert.equal(listingRelation, undefined, "should not have relationship to listings");
});

test("payload config registers Phase 6 content collection slugs", async (t) => {
  const payloadConfig = await importPayloadConfigForTest(t);
  const collections = payloadConfig.collections ?? [];
  const slugs = collections.map((c: { slug?: string }) => c.slug);

  assert.ok(slugs.includes("blog_categories"), "should register blog_categories collection");
  assert.ok(slugs.includes("blog_posts"), "should register blog_posts collection");
  assert.ok(slugs.includes("consultants"), "should register consultants collection");
});

test("payload config does not register operational collection slugs", async (t) => {
  const payloadConfig = await importPayloadConfigForTest(t);
  const collections = payloadConfig.collections ?? [];
  const slugs = collections.map((c: { slug?: string }) => c.slug);

  assert.ok(!slugs.includes("reservations"), "should not have reservations collection");
  assert.ok(!slugs.includes("orders"), "should not have orders collection");
  assert.ok(!slugs.includes("payments"), "should not have payments collection");
  assert.ok(!slugs.includes("listings"), "should not have listings collection");
});

test("payload config keeps Phase 6 free of MCP read plugins", async (t) => {
  const payloadConfig = await importPayloadConfigForTest(t);

  assert.equal(payloadConfig.plugins?.length ?? 0, 0);
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
