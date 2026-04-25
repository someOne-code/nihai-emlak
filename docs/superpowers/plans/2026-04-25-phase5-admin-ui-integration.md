# Faz 5 Admin UI Entegrasyon Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Payload Admin içine operasyon paneli ekleyip mevcut backend read model ve admin workflow route'larını güvenli şekilde tükettirmek.

**Architecture:** Supabase/RPC operational source of truth olarak kalır. Payload Admin yalnızca kullanıcı arayüzü sağlar; eligibility veya state transition kararlarını kendisi hesaplamaz. Next.js API route'ları auth/origin/body boundary olarak kalır.

**Tech Stack:** Next.js 16 App Router, React 19, Payload CMS 3, Supabase RPC/read models, Node test runner, npm.

---

## Summary

Payload Admin içine `/admin/operations` özel view'i eklenecek. Bu view mevcut backend read route'larını okuyacak, yeni eklenecek snapshot GET route'larıyla workflow eligibility bilgisini gösterecek ve mevcut `admin_cancel_reservation`, `admin_confirm_reservation`, `admin_reopen_listing` proxy route'larına buton bağlayacak.

## Key Changes

- Payload Admin config'e custom view ve nav link eklenecek:
  - View path: `/admin/operations`
  - Payload config: `admin.components.views.operations`
  - Nav link: `admin.components.afterNavLinks`
  - Componentler: `payload/admin/OperationsView.tsx`, `payload/admin/OperationsNavLink.tsx`

- Yeni snapshot API route'ları eklenecek:
  - `GET /api/admin/workflows/reservations/:reservationId/snapshot`
  - `GET /api/admin/workflows/listings/:listingId/snapshot`
  - Bu route'lar mevcut RPC'leri çağıracak:
    - `get_admin_reservation_workflow_snapshot`
    - `get_admin_listing_workflow_snapshot`
  - Auth/admin guard, UUID validation, `cache-control: no-store`, SQLSTATE mapping mevcut admin read route semantiğiyle aynı olacak.

- Operations UI veri akışı:
  - İlk yükleme:
    - `GET /api/admin/read/reservations?status=pending&limit=20&offset=0`
    - `GET /api/admin/read/orders?limit=100&offset=0`
    - `GET /api/admin/read/payments?limit=100&offset=0`
  - Reservation seçilince:
    - `GET /api/admin/workflows/reservations/{reservationId}/snapshot`
    - Snapshot'ta gösterilecek alanlar: `reservation.status`, `order.status`, `payment.status`, `listing.status`, `latest_event`, `eligibility.can_cancel`, `eligibility.can_confirm`
    - Phase 5.6 sonrasi intake/contact alanlari: `contact.fullName`, `contact.phone`, `contact.email`, `contact.preferredContactMethod`, `contact.preferredContactTime`, `contact.occupantFullName`, `contact.documentReadiness`, `contact.note`
  - Listing workflow paneli:
    - Seçili reservation'ın `listing.id` değeriyle `GET /api/admin/workflows/listings/{listingId}/snapshot`
    - Gösterilecek alan: `eligibility.can_reopen`

- Buton bağlantıları:
  - Cancel Reservation:
    - Enabled: `reservationSnapshot.eligibility.can_cancel === true`
    - POST: `/api/admin/workflows/reservations/{reservationId}/cancel`
    - Body: `{ reason, note }`
    - Reason seçenekleri: `customer_withdrew`, `documents_failed`, `admin_manual_resolution`
  - Confirm Reservation:
    - Enabled: `reservationSnapshot.eligibility.can_confirm === true`
    - POST: `/api/admin/workflows/reservations/{reservationId}/confirm`
    - Body: `{ note }`
  - Reopen Listing:
    - Enabled: `listingSnapshot.eligibility.can_reopen === true`
    - POST: `/api/admin/workflows/listings/{listingId}/reopen`
    - Body: `{ reason, note }`
    - Reason seçenekleri: `reservation_cancelled`, `documents_failed`, `admin_manual_reopen`

## TDD Implementation Plan

### Task 1: Snapshot Route Contract

**Files:**
- Create: `tests/admin-workflow-snapshot-route.test.mts`
- Create: `lib/admin/workflow-snapshot-route.ts`
- Create: `app/api/admin/workflows/reservations/[reservationId]/snapshot/route.ts`
- Create: `app/api/admin/workflows/listings/[listingId]/snapshot/route.ts`

- [ ] Write RED tests for unauthenticated, non-admin, profile lookup failure, invalid UUID, `P0002`, `P0004`, success payload, and `cache-control: no-store`.
- [ ] Run `node --experimental-strip-types --experimental-specifier-resolution=node --test tests/admin-workflow-snapshot-route.test.mts` and confirm expected failures.
- [ ] Implement minimal snapshot route helpers and App Router wrappers.
- [ ] Rerun the same test and commit.

### Task 2: Operations Client Helpers

**Files:**
- Create: `tests/admin-operations-client.test.mts`
- Create: `lib/admin-ui/operations-client.ts`

- [ ] Write RED tests for overview loader, reservation snapshot loader, listing snapshot loader, cancel/confirm/reopen POST helpers, and failed envelope handling.
- [ ] Run `node --experimental-strip-types --experimental-specifier-resolution=node --test tests/admin-operations-client.test.mts` and confirm expected failures.
- [ ] Implement fetch helpers with exact URLs and request bodies from this plan.
- [ ] Rerun the same test and commit.

### Task 3: Payload Admin Registration

**Files:**
- Create: `tests/payload-admin-operations.test.mts`
- Modify: `payload.config.ts`
- Modify: `app/(payload)/admin/importMap.ts`
- Create: `payload/admin/OperationsNavLink.tsx`

- [ ] Write RED tests that `payload.config.ts` registers `/operations` custom view and `afterNavLinks` includes the operations nav link.
- [ ] Keep existing Payload role tests green; editor/non-admin users must not gain admin access.
- [ ] Implement config and import map wiring.
- [ ] Run `node --experimental-strip-types --experimental-specifier-resolution=node --test tests/payload-admin-operations.test.mts tests/payload-security.test.mts` and commit.

### Task 4: Operations View UI

**Files:**
- Create: `payload/admin/OperationsView.tsx`
- Extend: `tests/admin-operations-client.test.mts` only if a pure helper is added for UI state derivation.

- [ ] Build a minimal client component that loads overview data on mount.
- [ ] Render reservation table, selected snapshot, order/payment/listing status badges, latest event summary, and action buttons.
- [ ] Disable buttons strictly from `eligibility.can_cancel`, `eligibility.can_confirm`, and `eligibility.can_reopen`.
- [ ] On successful POST, refetch selected snapshot and overview data.
- [ ] Run route/helper tests, `npm.cmd run test:db-security`, and `npm.cmd test`; commit.

## Test Plan

- Narrow:
  - `node --experimental-strip-types --experimental-specifier-resolution=node --test tests/admin-workflow-snapshot-route.test.mts`
  - `node --experimental-strip-types --experimental-specifier-resolution=node --test tests/admin-operations-client.test.mts`
  - `node --experimental-strip-types --experimental-specifier-resolution=node --test tests/payload-admin-operations.test.mts`

- Existing regression:
  - `node --experimental-strip-types --experimental-specifier-resolution=node --test tests/read-model-route.test.mts tests/admin-workflow-route.test.mts`
  - `npm.cmd run test:db-security`
  - `npm.cmd test`

- Manual smoke:
  - Start app.
  - Login to Payload Admin as admin.
  - Open `/admin/operations`.
  - Select a pending reservation.
  - Verify cancel/confirm/reopen buttons match snapshot eligibility.
  - Trigger one action in local test data and verify UI refreshes from backend response.

## Assumptions

- No new DB migration is needed for this task; snapshot RPCs already exist.
- UI is intentionally minimal and operational, not a full redesign.
- Backend remains source of truth; UI never computes eligibility beyond reading `eligibility.*`.
- Payment event raw payload stays hidden; UI only consumes sanitized read model fields.
- Checkout intake/contact data is shown only from sanitized admin read/snapshot fields; the UI must not request raw event payloads or public read surfaces for this data.
- If there is no selected reservation, listing reopen can be tested through a manual listing UUID input in v1.
