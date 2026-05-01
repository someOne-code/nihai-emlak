# Phase 8.6 Admin UI Productization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current `/admin/listings` surface from a technically working but confusing screen into a professional, understandable admin product surface.

**Architecture:** Keep Supabase/RPC/RLS and the existing admin route/client/view-model contracts as the source of truth. Use TailAdmin and shadcn sources only as UI references/donor kits; do not migrate the app to Tailwind v4 or replace backend logic.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase/Postgres/RLS/RPC, Tailwind CSS v3, shadcn/ui, Node test runner, npm.

---

## Summary

Phase 8.6 is a product-quality gate for Phase 8. Phase 8.5 can prove that listing configuration works functionally, but Phase 8 is not complete until an admin can understand and use the listing configuration flow without guessing.

This plan is intentionally limited to:

- `/admin` shell and dashboard skeleton
- `/admin/listings` UX/productization
- existing main item and service catalog attach flows
- existing image/general listing forms
- checkout readiness clarity

This plan does not redesign `/admin/operations`, does not remove Payload CMS, and does not add global catalog management.

## Files and Responsibilities

- `docs/IMPLEMENTATION_PLAN.md`: records Phase 8.6 and moves Phase 8 closure to 8.7.
- `docs/ADMIN_LISTING_CONFIG_CONTRACT.md`: records UI behavior and out-of-scope catalog creation.
- `app/(site)/admin/layout.tsx`: shared admin shell for `/admin`, `/admin/listings`, and future admin routes.
- `app/(site)/admin/page.tsx`: dashboard skeleton.
- `app/(site)/admin/listings/page.tsx`: remains the server access gate and renders the listing UI.
- `components/admin-shell/*`: new admin shell/sidebar/header components.
- `components/admin-dashboard/*`: dashboard cards and dashboard view component.
- `components/admin-listings/*`: split the current large listing UI into focused panels.
- `lib/admin-ui/listings-*`: keep existing client/controller/view-model logic; add display helpers only when needed.
- `tests/*admin-listings*`: keep existing tests and add helper/view-model tests for UI display state.

## Task 1: Document Phase 8.6 Gate

**Files:**
- Modify: `docs/IMPLEMENTATION_PLAN.md`
- Modify: `docs/ADMIN_LISTING_CONFIG_CONTRACT.md`

- [ ] Add Phase 8.6 as "Admin UI productization" after Phase 8 functional scope.
- [ ] Add Phase 8.7 as hardening/docs/closure.
- [ ] State that Phase 8 is not done until browser smoke proves main item and service attach flows are understandable and usable.
- [ ] State that global catalog management is out of scope; Phase 8.6 only attaches existing catalog rows to listings.

**Validation:**

```powershell
Select-String -Path docs\IMPLEMENTATION_PLAN.md -Pattern "Faz 8.6|Faz 8.7"
Select-String -Path docs\ADMIN_LISTING_CONFIG_CONTRACT.md -Pattern "UI Behavior|catalog"
```

Expected: both docs contain the new Phase 8.6 / UI behavior language.

## Task 2: Build Shared Admin Shell

**Files:**
- Create: `components/admin-shell/AdminShell.tsx`
- Create: `components/admin-shell/AdminSidebar.tsx`
- Create: `components/admin-shell/AdminHeader.tsx`
- Create: `app/(site)/admin/layout.tsx`
- Test: add or update a narrow admin shell render/access test if current test style supports it

**Design:**

- Sidebar items:
  - Dashboard -> `/admin`
  - Ilanlar -> `/admin/listings`
  - Operasyonlar -> `/admin/operations`
  - CMS -> `/cms`
- Header shows page title from route segment or an explicit prop.
- Shell must not perform auth or admin checks; page-level access gates stay in existing pages.
- Use TailAdmin/shadcn as visual reference, but implement with repo Tailwind v3 classes and existing `lucide-react`.

**Steps:**

- [ ] Write a failing test or static render check that verifies sidebar labels and links.
- [ ] Create shell components.
- [ ] Add `app/(site)/admin/layout.tsx` wrapping `children` with `AdminShell`.
- [ ] Keep `/admin/listings/page.tsx` and `/admin/operations/page.tsx` access guards unchanged.
- [ ] Run the narrow test.

**Validation:**

```powershell
npm run typecheck
```

Expected: typecheck passes or reports only pre-existing unrelated errors.

## Task 3: Add `/admin` Dashboard Skeleton

**Files:**
- Create: `components/admin-dashboard/AdminDashboardView.tsx`
- Create: `app/(site)/admin/page.tsx`
- Optionally create: `lib/admin-ui/dashboard-view-model.ts`
- Test: dashboard view-model/render test if a helper is added

**Design:**

- Dashboard is not a reporting system yet; it is an orientation page.
- Cards:
  - Total ilan
  - Aktif ilan
  - Checkout hazir olmayan kiralik ilan
  - Ilan konfigurasyonuna git
  - Operasyon kuyruguna git
- Use existing admin listing list data if available through current client/helper patterns.
- If live metrics are not available without adding a new route, show static action cards and avoid fake numbers.

**Steps:**

- [ ] Add dashboard page behind the existing admin route group.
- [ ] Add action cards linking to `/admin/listings` and `/admin/operations`.
- [ ] Add empty/error copy that is human-readable and not technical.
- [ ] Run typecheck.

**Validation:**

```powershell
npm run typecheck
```

Expected: dashboard compiles.

## Task 4: Split `AdminListingsView` Into Product Panels

**Files:**
- Modify: `components/admin-listings/AdminListingsView.tsx`
- Create focused components under `components/admin-listings/` as needed:
  - `ListingsPageHeader.tsx`
  - `ListingsList.tsx`
  - `ListingDetailTabs.tsx`
  - `ListingGeneralPanel.tsx`
  - `ListingImagesPanel.tsx`
  - `ListingMainItemsPanel.tsx`
  - `ListingServicesPanel.tsx`
  - `CheckoutReadinessPanel.tsx`

**Design:**

Page structure:

```text
Header: title, explanation, Yeni ilan button
Toolbar: type/status filters
Left: listing list
Center: selected listing tabs
Right: checkout readiness/action panel
```

Tabs:

- Genel Bilgiler
- Gorseller
- Ana Odeme Kalemleri
- Ek Hizmetler
- Checkout Hazirligi

**Rules:**

- Do not change API calls.
- Do not move pricing/eligibility decisions into UI.
- Keep `loadAllAndCacheList`, `selectAdminListing`, and mutation refresh behavior.
- Preserve existing add/update/image/main-item/service behavior.

**Steps:**

- [ ] Add a failing view-model/display helper test for empty listing and selected listing states if not covered.
- [ ] Extract presentational sections without changing behavior.
- [ ] Replace scattered panels with tabbed/detail layout.
- [ ] Keep success/error banners visible near the relevant action area.
- [ ] Run existing admin listing tests.

**Validation:**

```powershell
node --experimental-strip-types --test tests\admin-listings-view-model.test.mts tests\admin-listings-controller.test.mts tests\admin-listings-client.test.mts
```

Expected: all pass.

## Task 5: Make Main Item Attach Flow Obvious

**Files:**
- Modify: `components/admin-listings/ListingMainItemsPanel.tsx` or the extracted equivalent
- Modify: `lib/admin-ui/listings-view-model.ts` only if display helper labels are needed
- Test: `tests/admin-listings-view-model.test.mts`

**UI copy:**

- Panel title: `Ana Odeme Kalemleri`
- Description: `Kira, depozito gibi ana odeme kalemlerini bu ilana bagla.`
- Add label: `Katalogdan ana odeme kalemi sec`
- Button: `Ilana ekle`
- Empty attached state: `Bu ilana henuz ana odeme kalemi baglanmadi.`
- Empty candidate state: `Eklenebilir ana odeme kalemi yok. Tum aktif katalog kalemleri bu ilana bagli olabilir veya global katalog bos olabilir.`

**Behavior:**

- Dropdown uses `available_main_items`.
- Already attached codes are excluded.
- Add calls `configureAdminListingMainItem(listingId, code, { is_enabled: true })`.
- After success, selected listing snapshot refreshes and the item appears in the attached list.

**Steps:**

- [ ] Add/confirm test for `getAvailableMainItemAddCandidates`.
- [ ] Update panel copy and layout.
- [ ] Make default label/name more visible than raw code.
- [ ] Keep override amount, override multiplier, enabled state, and save behavior.
- [ ] Run admin listing view-model/client tests.

**Validation:**

```powershell
node --experimental-strip-types --test tests\admin-listings-view-model.test.mts tests\admin-listings-client.test.mts
```

Expected: tests pass and the attach payload remains `{ is_enabled: true }`.

## Task 6: Make Service Attach Flow Obvious

**Files:**
- Modify: `components/admin-listings/ListingServicesPanel.tsx` or the extracted equivalent
- Modify: `lib/admin-ui/listings-view-model.ts` only if display helper labels are needed
- Test: `tests/admin-listings-view-model.test.mts`

**UI copy:**

- Panel title: `Ek Hizmetler`
- Description: `Temizlik, tasima gibi ek hizmetleri bu ilana bagla.`
- Add label: `Katalogdan ek hizmet sec`
- Button: `Ilana ekle`
- Empty attached state: `Bu ilana henuz ek hizmet baglanmadi.`
- Empty candidate state: `Eklenebilir hizmet yok. Tum aktif katalog hizmetleri bu ilana bagli olabilir veya global katalog bos olabilir.`

**Behavior:**

- Dropdown uses `available_services`.
- Already attached codes are excluded.
- Add calls `configureAdminListingService(listingId, code, { is_enabled: true })`.
- After success, selected listing snapshot refreshes and the service appears in the attached list.

**Steps:**

- [ ] Add/confirm test for `getAvailableServiceAddCandidates`.
- [ ] Update panel copy and layout.
- [ ] Make service `name` more visible than raw code.
- [ ] Keep override price, enabled state, and save behavior.
- [ ] Run admin listing view-model/client tests.

**Validation:**

```powershell
node --experimental-strip-types --test tests\admin-listings-view-model.test.mts tests\admin-listings-client.test.mts
```

Expected: tests pass and the attach payload remains `{ is_enabled: true }`.

## Task 7: Improve General Info, Images, and Readiness UX

**Files:**
- Modify extracted listing panels under `components/admin-listings/`
- Test: `tests/admin-listings-view-model.test.mts` if display helpers are added

**General info:**

- Group fields:
  - Temel: title, slug, type, status
  - Konum: city, district
  - Fiyat: price, currency
  - Ozellikler: room, bathroom, gross area, furnished
  - Aciklama: summary, description
- Avoid unclear labels like only `Fiyat (kucuk birim)` without helper copy.

**Images:**

- Show image cards in a grid.
- Show primary image badge clearly.
- URL add form is separate from the image list.
- Do not build fake upload UI; binary upload remains out of scope.

**Readiness:**

- Show `Checkout hazir` / `Hazir degil` badge.
- Show missing checklist from `checkout_eligibility.missing`.
- For sale listings, show that checkout configuration is not required.
- If eligibility is unavailable, show `Hazirlik durumu alinamadi`; do not assume ready.

**Validation:**

```powershell
node --experimental-strip-types --test tests\admin-listings-view-model.test.mts
```

Expected: any new display helper tests pass.

## Task 8: Browser Smoke and Phase 8.6 Closure

**Files:**
- Modify: `docs/IMPLEMENTATION_PLAN.md` only when closing Phase 8.6
- Optionally add smoke notes under `docs/superpowers/plans/` or a short closure note

**Manual browser smoke:**

1. Start dev server.
2. Login as admin.
3. Open `/admin`.
4. Confirm dashboard shell and links render.
5. Open `/admin/listings`.
6. Select a rent listing.
7. Confirm checkout readiness panel is understandable.
8. Add a main item from catalog.
9. Confirm it appears in attached main item list.
10. Add a service from catalog.
11. Confirm it appears in attached service list.
12. Toggle/update override fields and confirm success state.
13. Check mobile viewport.

**Final validation:**

```powershell
npm run test:phase8-admin-listings
npm test
npm run build
```

Expected: all pass. If a command cannot be run, record the exact command and reason.

## Execution Order

Implement in this order:

1. Task 1: Docs and done gate.
2. Task 2: Admin shell.
3. Task 3: Dashboard skeleton.
4. Task 4: Split listings UI into panels.
5. Task 5: Main item attach UX.
6. Task 6: Service attach UX.
7. Task 7: General/images/readiness polish.
8. Task 8: Browser smoke and closure.

Do not start Phase 9 before Task 8 is complete.

## Assumptions

- `/admin/operations` redesign is not part of Phase 8.6.
- Payload CMS stays under `/cms`.
- TailAdmin and shadcn are donor/reference kits, not new architecture.
- Tailwind v4 migration is out of scope.
- Global main item/service catalog management is out of scope.
- Existing admin route/RPC contracts remain authoritative.
