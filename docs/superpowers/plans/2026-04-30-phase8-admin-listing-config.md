# Phase 8 Admin Listing Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the admin listing, image, main item, and service pricing configuration surface for Phase 8 without moving operational ownership away from Supabase.

**Architecture:** Supabase remains the operational source of truth. Admin UI calls narrow Next.js admin routes, routes use authenticated user-context Supabase clients, and write behavior is enforced by DB/RPC, RLS, constraints, and tests. Public frontend changes are out of scope.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase/Postgres/RLS/RPC, Node test runner, npm.

---

## Summary

Phase 8 is split into independent, testable sub-phases. Each sub-phase follows TDD: write the failing test, run it red, implement the smallest behavior, run the narrow green test, then broaden validation only when the sub-phase is stable.

## Phase 8.0: Contract and TDD Skeleton

**Files:**
- Create: `docs/ADMIN_LISTING_CONFIG_CONTRACT.md`
- Create: Phase 8 SQL, route, and view-model test files as needed
- Modify: `docs/IMPLEMENTATION_PLAN.md` only when closing the phase

- [ ] Write the admin listing config contract draft.
- [ ] Define endpoint envelope, auth guard, status code map, validation behavior, and sale/rent rules.
- [ ] Add failing Phase 8 test skeletons for DB/RPC, route contracts, and UI view-model behavior.
- [ ] Verify the tests fail because the Phase 8 behavior is not implemented yet.

**Exit gate:** Contract expectations are explicit, the first tests fail for the right reason, and no production behavior has changed.

## Phase 8.1: Admin Listing Read Model

**Behavior:**
- Add admin-only listing list and listing config snapshot reads.
- Keep admin read shape separate from public read models.
- Do not expose raw private, service-role-only, or provider-only fields.

**API:**
- `GET /api/admin/listings`
- `GET /api/admin/listings/:listingId`

**DB/RPC:**
- Add admin list/snapshot RPC or view layer.
- Return listing details, image records, main item options, service options, and checkout eligibility summary.

**Tests:**
- Non-admin read is rejected.
- Admin can read listing list and listing snapshot.
- Snapshot does not include private/internal-only fields.
- Public read model tests continue to pass.

**Exit gate:** Phase 8 read route tests pass and existing public read model behavior is unchanged.

## Phase 8.2: Listing Lifecycle Writes

**Behavior:**
- Add admin listing create, update, deactivate, and reactivate behavior.
- Route layer handles request guard and JSON parsing.
- DB/RPC layer enforces authorization, validation, and transactional writes.

**API:**
- `POST /api/admin/listings`
- `PATCH /api/admin/listings/:listingId`

**DB/RPC:**
- Add atomic listing create/update/status RPCs.
- Reject non-admin writes at DB/RPC level.
- Reject negative price, invalid enum/status, duplicate slug/code, and invalid sale/rent state.
- Require checkout-ready config before a rent listing can be activated.
- Allow sale listing management without checkout config.

**Tests:**
- Admin create/update/status success.
- Non-admin write reject.
- Invalid price/status reject.
- Rent listing activation without checkout config reject.
- Sale listing without checkout config allowed.

**Exit gate:** Phase 8 lifecycle route and SQL tests pass; DB security harness covers the new behavior.

## Phase 8.3: Listing Image Management

**Behavior:**
- Add admin image add, delete, and reorder behavior.
- Manage existing URL-based image records only; file upload/storage is out of scope.
- Preserve one primary image and deterministic sort order.

**API:**
- `POST /api/admin/listings/:listingId/images`
- `PATCH /api/admin/listings/:listingId/images/order`
- `DELETE /api/admin/listings/:listingId/images/:imageId`

**DB/RPC:**
- Add image write/reorder RPCs.
- Enforce ownership through admin guard and DB policy.
- Ensure disabled/deleted image data does not leak through public reads.

**Tests:**
- Admin can add image.
- Admin can delete image.
- Admin can reorder images deterministically.
- Multiple primary images are prevented.
- Non-admin writes are rejected.
- Public listing reads do not leak admin-only image config.

**Exit gate:** Phase 8 image route and SQL tests pass.

## Phase 8.4: Main Item and Service Pricing Config

**Behavior:**
- Add listing-level main item and service option management.
- Support enable/disable, override label, override amount/multiplier, and sort order.
- Preserve existing checkout quote/create contract.

**API:**
- `PATCH /api/admin/listings/:listingId/main-items/:code`
- `PATCH /api/admin/listings/:listingId/services/:code`

**DB/RPC:**
- Add main item option and service option write RPCs.
- Preserve normalized catalog code uniqueness.
- Reject negative overrides.
- Ensure disabled options are not usable by checkout or public read models.

**Tests:**
- Main item enable/disable success.
- Main item override success.
- Service option enable/disable success.
- Service override success.
- Duplicate normalized catalog code reject.
- Negative override reject.
- Checkout quote regression passes with updated config.
- Disabled options are excluded from checkout and public reads.

**Exit gate:** Phase 8 pricing config tests and checkout quote regression tests pass.

## Phase 8.5: `/admin/listings` UI

**Behavior:**
- Add a separate operational admin listing management screen.
- Reuse the existing admin design language instead of introducing a public-site redesign.
- Keep all visible data flowing through typed client/controller/view-model helpers.

**UI Areas:**
- Listing table.
- Selected listing editor.
- Images panel.
- Pricing config panel.
- Main item and service option controls.

**Build Web Apps Guidance:**
- Because this is a focused admin surface inside an existing design system, do not generate a separate marketing-style concept.
- Use dense, restrained, operational UI patterns.
- Verify desktop and mobile behavior in the browser.
- Do not show raw debug/private data in UI state.

**Tests:**
- View-model tests.
- Client/controller tests.
- Admin access state tests.
- Browser smoke for `/admin/listings`.

**Exit gate:** UI helper tests pass and `npm run build` passes.

## Phase 8.6: Hardening, Docs, and Closure

**Behavior:**
- Finalize contract docs.
- Update implementation plan status.
- Run full validation.

**Validation:**
- Run Phase 8 narrow tests.
- Run `npm run test:db-security`.
- Run `npm test`.
- Run `npm run build`.
- Run browser smoke for `/admin/listings` if the dev server is available.

**Exit gate:** All relevant validation passes, or any verification gap is documented clearly with the exact command that could not be run.

## Assumptions

- Admin listing management lives at `/admin/listings`.
- Public frontend changes are out of scope.
- Payload CMS is not the operational listing source of truth.
- Listing image upload is out of scope; Phase 8 manages `image_url` records only.
- `service_role` is not used for admin listing writes.
- Each sub-phase can be committed independently, but Phase 8 is complete only after Phase 8.6 validation.
