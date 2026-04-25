# Phase 5.6 Checkout Intake / Pre-payment Contact Info

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` and `backend-development`. Use `security-best-practices` when touching validation, PII handling, route boundaries, or read models.

## Goal

Collect the minimum operational contact/intake details before payment so the office can reach the customer quickly and prepare the real-world document process after payment.

This phase extends checkout create only. It does not introduce document upload, identity-document collection, refund automation, or a full CRM.

## Business Decision

Before payment, the product must collect enough information for backoffice follow-up:

- who the office should contact
- how the office should contact them
- whether the occupant differs from the authenticated payer
- whether the customer is ready for the post-payment document process
- a short customer note for the office

The system must avoid collecting high-risk sensitive data during checkout unless a later legal/product decision explicitly requires it.

## Intake Fields

`POST /api/checkout` will accept a `contact` object.

Required:

- `contact.full_name`: string, trimmed, 2..120 chars
- `contact.phone`: string, trimmed, 7..32 chars
- `contact.preferred_contact_method`: `phone | whatsapp | email`
- `contact.document_readiness`: `ready | needs_help | later`

Optional:

- `contact.email`: email string, trimmed, max 254 chars; may differ from auth email
- `contact.preferred_contact_time`: string, trimmed, max 120 chars
- `contact.occupant_full_name`: string, trimmed, max 120 chars; for cases where payer and occupant differ
- `contact.note`: string, trimmed, max 1000 chars

Normalization:

- Blank optional strings become `null`.
- Required strings cannot be blank after trim.
- Phone validation stays permissive in v1; do not reject valid international/operator formats with an overly strict regex.

## Explicitly Out of Scope

Do not collect these in checkout intake:

- Turkish identity number
- passport number
- residence permit number
- document uploads
- salary slips, bank statements, guarantor documents
- signed contract files
- payment card data or bank account details
- exact current home address

These belong to a later legal/document workflow, not the pre-payment checkout boundary.

## Architecture

Supabase remains the operational source of truth.

Preferred storage model:

- Add `public.reservation_intake` or equivalent one-to-one table keyed by `reservation_id`.
- Keep core `reservations` focused on reservation state and stay parameters.
- Use RLS/DB functions so users can only read their own intake and admins can read through sanitized admin read models.

Checkout create flow:

1. Route validates JSON boundary and normalizes `contact`.
2. DB/RPC creates reservation/order/order_items/payment atomically.
3. DB/RPC writes the intake row in the same authoritative create operation or under the same transaction boundary.
4. Response may include only an intake summary flag or sanitized fields; do not echo unnecessary PII unless the frontend needs it.

## Read Model Requirements

Admin-facing read/snapshot surfaces should expose sanitized intake fields needed for office operations:

- contact full name
- phone
- email
- preferred contact method
- preferred contact time
- occupant full name
- document readiness
- customer note

Public listing read models must not expose intake data.

Payment event/admin workflow event payloads must not duplicate raw intake data unless intentionally audited with a narrow sanitized subset.

## TDD Implementation Plan

### Task 1: SQL Contract Tests

Files:

- Modify: `tests/sql/phase3_task4_create_checkout.sql`
- Create if needed: `tests/sql/phase56_checkout_intake.sql`

- [ ] Add RED tests that valid checkout creates exactly one intake row for the reservation.
- [ ] Add RED tests that missing required contact fields are rejected with `22023`.
- [ ] Add RED tests that blank optional strings normalize to `null`.
- [ ] Add RED tests that overlong fields are rejected.
- [ ] Add RED tests that unauthenticated/direct table access cannot read or write another user's intake.

### Task 2: Migration / DB Function

Files:

- Create: `supabase/migrations/<timestamp>_29_phase56_checkout_intake.sql`

- [ ] Add enum/check constraints for `preferred_contact_method` and `document_readiness`.
- [ ] Add intake table with one row per reservation.
- [ ] Add RLS and grants according to existing Supabase-first patterns.
- [ ] Extend `create_checkout` to accept and persist intake data.
- [ ] Keep pricing, reservation, order, and payment invariants unchanged.

### Task 3: Route Parser Contract

Files:

- Modify: `lib/payments/checkout-create.ts`
- Modify: `tests/checkout-create-validator.test.mts`
- Modify: `lib/payments/checkout-create-route.ts`
- Modify: `tests/checkout-create-route.test.mts`

- [ ] Add RED parser tests for required/optional contact fields.
- [ ] Ensure forbidden financial fields remain rejected.
- [ ] Ensure route sends normalized contact payload to RPC.
- [ ] Keep state-changing route boundary unchanged: auth, origin, content-type, body-size.

### Task 4: Admin Read/Snapshot Surface

Files:

- Modify: `supabase/migrations/<phase5 read model migration or new forward migration>`
- Modify: `tests/sql/phase5_backend_read_models.sql`
- Modify snapshot route/read tests when those routes exist.

- [ ] Add admin reservation read/snapshot fields for intake.
- [ ] Ensure normal users cannot read other users' intake.
- [ ] Ensure public routes never expose intake data.
- [ ] Keep raw event payloads sanitized.

### Task 5: Docs and Frontend Handoff

Files:

- Modify: `docs/CHECKOUT_CONTRACT.md`
- Modify: `docs/READ_MODEL_CONTRACT.md`
- Modify: `docs/superpowers/plans/2026-04-25-phase5-admin-ui-integration.md`

- [ ] Document the final `contact` object.
- [ ] Document admin UI display requirements.
- [ ] Document explicit out-of-scope sensitive data.

## Acceptance Criteria

- Checkout cannot proceed without required contact intake fields.
- Valid checkout persists intake under the created reservation.
- Intake write happens under the checkout authoritative boundary.
- Public read models never expose intake.
- Admin read/snapshot models expose only the operational fields needed by the office.
- Sensitive identity documents and uploads remain out of scope.
- `npm run test:db-security` and `npm test` pass after implementation.

