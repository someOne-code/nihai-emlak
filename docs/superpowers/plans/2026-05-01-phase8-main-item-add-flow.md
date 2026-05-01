# Phase 8 Main Item / Service Add Flow

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the Phase 8.4/8.5 gap where admin can edit existing main item/service options but cannot add new ones from the catalog.

**Architecture:** Supabase RPC `admin_get_listing` enriches snapshot with `available_main_items` and `available_services`. UI uses existing `configureAdminListingMainItem` / `configureAdminListingService` with `is_enabled: true` to attach new options. No new routes.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase/Postgres/RLS/RPC, Node test runner, npm.

---

## Summary

This plan adds catalog picker controls to the admin listing UI so that:

- Admin can select an unassigned main item from `main_item_catalog` and attach it to the listing.
- Admin can select an unassigned service from `service_catalog` and attach it to the listing.
- Empty state "Bu ilana atanmis ana kalem yok" is replaced by the add control.

Backend already supports upsert via `admin_configure_listing_main_item(p_listing_id, p_code, {...})` and `admin_configure_listing_service`. The missing piece is exposing the catalog in the snapshot and rendering a picker in the UI.

---

## Implementation Changes

### Task 1: Enrich `admin_get_listing` Snapshot with Available Catalogs

**Files:**
- Modify: `supabase/migrations/20260430110000_33_phase8_admin_listing_config.sql`
- Modify: `tests/sql/phase8_admin_listing_config.sql`

- [ ] Add `available_main_items` and `available_services` to `admin_get_listing` return JSON.
- [ ] `available_main_items`: all active rows from `main_item_catalog` (`id, code, label, default_amount, default_multiplier, is_active, sort_order`).
- [ ] `available_services`: all active rows from `service_catalog` (`id, code, name, base_price, is_active`).
- [ ] Add SQL test: snapshot for an admin user contains both lists with expected catalog rows.
- [ ] Run `bash .codex/scripts/test-db-security.sh` (or equivalent Windows validation).
- [ ] Expected red: test expects new fields that do not exist yet.
- [ ] Implement fields in RPC.
- [ ] Expected green: test passes.

### Task 2: Update TypeScript Types and View Model

**Files:**
- Modify: `lib/admin-ui/listings-view-model.ts`
- Modify: `lib/admin-ui/listings-client.ts` (if response types need update)

- [ ] Add `AvailableMainItem` and `AvailableService` types.
- [ ] Extend `AdminListingDetail` with `availableMainItems` and `availableServices`.
- [ ] Map new snapshot fields in `buildDetail`.
- [ ] Add/update unit tests for view model.
- [ ] Run `node --experimental-strip-types --test tests/phase8-admin-listings-view-model.test.mts`.
- [ ] Expected red then green.

### Task 3: Add Catalog Picker to MainItemsPanel

**Files:**
- Modify: `components/admin-listings/AdminListingsView.tsx`

- [ ] Add `onAdd` callback prop to `MainItemsPanel` (receives `code`, calls `configureAdminListingMainItem` with `{ is_enabled: true }`).
- [ ] Render a `<select>` + "Ekle" button above the list.
- [ ] Filter options: exclude codes already present in `items`.
- [ ] Replace empty state with the add control (no separate "no items" message).
- [ ] Wire `onAdd` to parent component via `runAction`.
- [ ] Manual smoke: open `/admin/listings`, select a listing with no main items, pick from dropdown, click add → item appears.

### Task 4: Add Catalog Picker to ServicesPanel

**Files:**
- Modify: `components/admin-listings/AdminListingsView.tsx`

- [ ] Same pattern as Task 3 for `ServicesPanel`.
- [ ] `onAdd` calls `configureAdminListingService` with `{ is_enabled: true }`.
- [ ] Manual smoke.

### Task 5: Update Contract Documentation

**Files:**
- Modify: `docs/ADMIN_LISTING_CONFIG_CONTRACT.md`

- [ ] Document `available_main_items` and `available_services` in snapshot schema.
- [ ] Note that attach flow uses existing `admin_configure_listing_*` RPCs.

---

## Final Validation

- [ ] Run narrow route tests:

```powershell
node --experimental-strip-types --test tests\phase8-admin-listings-route.test.mts tests\phase8-admin-listings-images-route.test.mts tests\phase8-admin-listings-pricing-route.test.mts
```

- [ ] Run DB security tests (or equivalent):

```powershell
bash .codex/scripts/test-db-security.sh
```

- [ ] Run repo baseline:

```powershell
npm test
```

- [ ] Browser smoke for `/admin/listings`:
  - Login as admin.
  - Select a listing with no main items.
  - Verify dropdown shows catalog options.
  - Add a main item → appears in list.
  - Same for services.

---

## Assumptions

- Admin UI is owned by this backend workspace; frontend team is not a separate constraint here.
- Catalog tables (`main_item_catalog`, `service_catalog`) already have seed data in local dev.
- No new authorization surface; admin-only access is enforced by existing RPC guards.
