# Phase 6 Payload Content Backend Subphase Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Phase 6 Payload CMS content backend for blog categories, blog posts, and consultant showcase profiles without touching Supabase operational flows.

**Architecture:** Payload remains the content/CMS backend under `/cms`; Supabase remains the operational backend for reservations, orders, payments, listings, and workflows. Phase 6 is split into focused subphases so each one can be implemented with TDD and verified independently.

**Tech Stack:** Payload CMS 3, Next.js 16, TypeScript, Node test runner, npm.

---

## Summary

Phase 6 is only the Payload CMS content backend. It does not add public API routes, public site UI, or operational Supabase behavior.

Target Payload collections:

- `blog_categories`
- `blog_posts`
- `consultants`

Existing invariants to preserve:

- Payload admin route stays `/cms`.
- `typescript.autoGenerate` stays `false`.
- Payload DB stays in the Payload adapter/schema boundary.
- Operational slugs such as `reservations`, `orders`, `payments`, and `listings` are not added to Payload collections.

## Phase 6.1: Content Access Foundation

**Files:**

- Create: `payload/access/content.ts`
- Test: `tests/phase6-payload-content-access.test.mts`

- [x] **Step 1: Write failing access tests**

Create `tests/phase6-payload-content-access.test.mts` with tests for:

- Admin users can create, update, and delete content.
- Non-admin users cannot create, update, or delete content.
- Public blog post read access returns a `status equals published` filter.
- Public category read access returns an `isActive equals true` filter.
- Public consultant read access returns an `isPublished equals true` filter.

- [x] **Step 2: Run failing access tests**

Run:

```bash
node --experimental-strip-types --test tests/phase6-payload-content-access.test.mts
```

Expected: fail because `payload/access/content.ts` does not exist yet.

- [x] **Step 3: Implement minimal access helpers**

Add `payload/access/content.ts` exporting explicit helpers for:

- content admin write access
- published blog read filter
- active category read filter
- published consultant read filter

Use the existing Payload user shape from `payload/collections/Users.ts`: a Payload admin is `collection === "users"` and `role === "admin"` or legacy `role === null`.

- [x] **Step 4: Verify access tests pass**

Run:

```bash
node --experimental-strip-types --test tests/phase6-payload-content-access.test.mts
```

Expected: pass.

## Phase 6.2: Blog Categories

**Files:**

- Create: `payload/collections/BlogCategories.ts`
- Modify: `payload.config.ts`
- Test: `tests/phase6-payload-content-config.test.mts`

- [x] **Step 1: Write failing config tests for categories**

Create or extend `tests/phase6-payload-content-config.test.mts` to assert:

- Payload config registers `blog_categories`.
- `blog_categories` has required `title`.
- `blog_categories` has required unique `slug`.
- `blog_categories` has `description`, `isActive`, and `sortOrder`.
- Public read uses the active category access helper.

- [x] **Step 2: Run failing config tests**

Run:

```bash
node --experimental-strip-types --test tests/phase6-payload-content-config.test.mts
```

Expected: fail because `blog_categories` is not registered.

- [x] **Step 3: Implement `BlogCategories`**

Add a Payload collection with slug `blog_categories` and fields:

- `title`: required text
- `slug`: required unique text
- `description`: optional textarea
- `isActive`: checkbox, default `true`
- `sortOrder`: number, default `0`

Register it in `payload.config.ts` after `Users`.

- [x] **Step 4: Verify category tests pass**

Run:

```bash
node --experimental-strip-types --test tests/phase6-payload-content-config.test.mts
```

Expected: pass.

## Phase 6.3: Blog Posts

**Files:**

- Create: `payload/collections/BlogPosts.ts`
- Modify: `payload.config.ts`
- Test: `tests/phase6-payload-content-config.test.mts`

- [x] **Step 1: Write failing config tests for posts**

Extend `tests/phase6-payload-content-config.test.mts` to assert:

- Payload config registers `blog_posts`.
- `blog_posts` has required `title`.
- `blog_posts` has required unique `slug`.
- `status` is a select with `draft` and `published`, default `draft`.
- `category` is a relationship to `blog_categories`.
- Public read uses the published blog access helper.

- [x] **Step 2: Run failing config tests**

Run:

```bash
node --experimental-strip-types --test tests/phase6-payload-content-config.test.mts
```

Expected: fail because `blog_posts` is not registered.

- [x] **Step 3: Implement `BlogPosts`**

Add a Payload collection with slug `blog_posts` and fields:

- `title`: required text
- `slug`: required unique text
- `excerpt`: optional textarea
- `content`: required textarea
- `category`: optional relationship to `blog_categories`
- `status`: select `draft | published`, default `draft`
- `publishedAt`: optional date
- `coverImageUrl`: optional text
- `seoTitle`: optional text
- `seoDescription`: optional textarea

Register it in `payload.config.ts` after `BlogCategories`.

- [x] **Step 4: Verify post tests pass**

Run:

```bash
node --experimental-strip-types --test tests/phase6-payload-content-config.test.mts
```

Expected: pass.

## Phase 6.4: Consultants

**Files:**

- Create: `payload/collections/Consultants.ts`
- Modify: `payload.config.ts`
- Test: `tests/phase6-payload-content-config.test.mts`

- [x] **Step 1: Write failing config tests for consultants**

Extend `tests/phase6-payload-content-config.test.mts` to assert:

- Payload config registers `consultants`.
- `consultants` has required `fullName`.
- `consultants` has required unique `slug`.
- Public read uses the published consultant access helper.
- No field creates a relationship to `listings`.
- Payload config does not register operational collection slugs: `reservations`, `orders`, `payments`, `listings`.

- [x] **Step 2: Run failing config tests**

Run:

```bash
node --experimental-strip-types --test tests/phase6-payload-content-config.test.mts
```

Expected: fail because `consultants` is not registered.

- [x] **Step 3: Implement `Consultants`**

Add a Payload collection with slug `consultants` and fields:

- `fullName`: required text
- `slug`: required unique text
- `title`: optional text
- `photoUrl`: optional text
- `shortBio`: optional textarea
- `phone`: optional text
- `email`: optional email
- `whatsappUrl`: optional text
- `linkedinUrl`: optional text
- `isPublished`: checkbox, default `false`
- `sortOrder`: number, default `0`

Register it in `payload.config.ts` after `BlogPosts`.

- [x] **Step 4: Verify consultant tests pass**

Run:

```bash
node --experimental-strip-types --test tests/phase6-payload-content-config.test.mts
```

Expected: pass.

## Final Validation

- [x] **Step 1: Run Phase 6 narrow tests**

```bash
node --experimental-strip-types --test tests/phase6-payload-content-access.test.mts tests/phase6-payload-content-config.test.mts
```

Expected: pass.

- [x] **Step 2: Run Payload regressions**

```bash
node --experimental-strip-types --test tests/payload-security.test.mts tests/phase5-task3-payload-admin-config.test.mts
```

Expected: pass.

- [x] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: pass.

- [x] **Step 4: Run repo baseline**

```bash
npm test
```

Expected: pass.

## Assumptions

- Phase 6 does not add public API routes.
- Phase 6 does not add public site UI.
- Images are URL fields in v1; no media upload collection is added.
- Consultants are showcase-only and do not relate to operational listings.
- Payload editor role remains disabled until editor workflows are explicitly designed.

## Closure

Status: completed and sealed on 2026-04-30.

Implemented:

- Content access helpers for Payload CMS content collections.
- `blog_categories`, `blog_posts`, and `consultants` Payload collections.
- Payload config registration for the Phase 6 content collections.
- Guards that keep operational Supabase collection slugs out of Payload.
- Guard that keeps Phase 6 free of extra MCP/public read surfaces.

Final verification evidence:

- `node --experimental-strip-types --test tests/phase6-payload-content-config.test.mts` passed with 19/19 tests.
- `node --experimental-strip-types --test tests/phase6-payload-content-access.test.mts tests/phase6-payload-content-config.test.mts` passed with 31/31 tests.
- `node --experimental-strip-types --test tests/payload-security.test.mts tests/phase5-task3-payload-admin-config.test.mts` passed with 19/19 tests.
- `npm test` passed with 152/152 node tests, followed by typecheck and lint.

Residual notes:

- Phase 6 intentionally does not add public API routes or public site UI.
- Media upload remains out of scope; image fields are URL fields for v1.
- Payload editor role remains disabled until editor workflow design exists.
