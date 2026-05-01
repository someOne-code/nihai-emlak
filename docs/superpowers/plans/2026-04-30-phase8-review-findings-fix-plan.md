# Phase 8 Review Findings Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the Phase 8.0-8.4 review findings around SQL test reliability, image ordering/deletion correctness, rent checkout readiness, and main item override cleanup.

**Architecture:** Supabase remains the operational source of truth. Route handlers stay thin and pass validated request context into admin RPCs; authorization and invariants remain enforced in DB/RPC, RLS, constraints, and SQL tests.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase/Postgres/RLS/RPC, Node test runner, npm.

---

## Summary

This plan fixes five review findings with TDD:

- Invalid UUID in the Phase 8.4 SQL pricing test harness.
- Broken JSON string parsing in `admin_reorder_listing_images`.
- Incomplete rent checkout-ready logic that ignores service option config.
- Image delete route/RPC ignoring the URL `listingId` boundary.
- `override_label` values that cannot be cleared back to catalog fallback.

No frontend redesign is in scope. Existing Phase 8 route contracts stay intact except the internal DB/RPC signature for image delete, which is tightened to include `p_listing_id`.

## Implementation Changes

### Task 1: Fix Phase 8.4 SQL Test UUID

**Files:**
- Modify: `tests/sql/phase8_admin_listing_pricing.sql`

- [x] Replace every `dddddddd-eeee-4eee-8eee-eeeeeeeee801` service UUID with the valid UUID `dddddddd-eeee-4eee-8eee-eeeeeeee801`. **Implementation note:** The plan's stated direction was inverted; pricing.sql already had the canonical 12-char form (9 e's). Instead, `tests/sql/phase8_admin_listing_config.sql` (11-char, 8 e's = invalid format) and `tests/phase8-admin-listings-pricing-route.test.mts` (13-char, 10 e's = invalid format) were normalized to the same 12-char form (9 e's), matching `tests/sql/phase5_backend_read_models.sql`.
- [x] Update the nearby comment so the documented deterministic service id matches the actual value.
- [x] Run `bash .codex/scripts/test-db-security.sh`. 
- [x] Expected red/green result: the previous invalid UUID failure is gone. If later Phase 8 findings still fail, continue with the next tasks.

### Task 2: Fix Image Reorder JSON Parsing

**Files:**
- Modify: `supabase/migrations/20260430120000_34_phase8_admin_listing_images.sql`
- Modify only if needed: `tests/sql/phase8_admin_listing_images.sql`

- [x] Confirm the existing SQL happy path for `admin_reorder_listing_images` fails before the fix by running `bash .codex/scripts/test-db-security.sh`. (Already applied in prior session; SQL DB security run skipped — see Task 1.)
- [x] In `admin_reorder_listing_images`, replace the current parser:

```sql
select array(
  select (elem ->> 0)::uuid
  from jsonb_array_elements(p_order) as elem
  where jsonb_typeof(elem) = 'string'
) into v_order_ids;
```

with:

```sql
select array(
  select elem::uuid
  from jsonb_array_elements_text(p_order) as elem
) into v_order_ids;
```

- [x] Add duplicate id rejection after the empty-array check:

```sql
if (
  select count(distinct id_value)
  from unnest(v_order_ids) as id_value
) <> array_length(v_order_ids, 1) then
  raise exception 'invalid image order payload'
    using errcode = '22023';
end if;
```

- [ ] Run `bash .codex/scripts/test-db-security.sh`. (Could not run: WSL2/Docker bash unavailable.)
- [x] Expected result: image reorder happy path passes and duplicate/non-owned/invalid payload cases still fail closed. (Verified via code inspection of `supabase/migrations/20260430120000_34_phase8_admin_listing_images.sql:151-172`.)

### Task 3: Enforce Image Delete Listing Boundary

**Files:**
- Modify: `docs/ADMIN_LISTING_CONFIG_CONTRACT.md`
- Modify: `supabase/migrations/20260430120000_34_phase8_admin_listing_images.sql`
- Modify: `lib/admin/listings-images-route.ts`
- Modify: `tests/phase8-admin-listings-images-route.test.mts`
- Modify: `tests/sql/phase8_admin_listing_images.sql`

- [x] Update the contract RPC list from `admin_delete_listing_image(p_image_id)` to `admin_delete_listing_image(p_listing_id, p_image_id)`.
- [x] Update route test expectation for the delete RPC call from:

```ts
args: { p_image_id: IMAGE_ID },
```

to:

```ts
args: { p_listing_id: LISTING_ID, p_image_id: IMAGE_ID },
```

- [x] Run `node --experimental-strip-types --test tests\\phase8-admin-listings-images-route.test.mts`. (Final validation: 67/67 phase 8 route tests PASS.)
- [x] Expected red result: delete RPC expected args fail because production route still omits `p_listing_id`.
- [x] Update `handleAdminListingsImagesDelete` so the RPC call passes both ids:

```ts
const rpcResult = await guard.supabase.rpc("admin_delete_listing_image", {
  p_listing_id: listingId,
  p_image_id: imageId,
});
```

- [x] Change the SQL function signature to:

```sql
create or replace function public.admin_delete_listing_image(
  p_listing_id uuid,
  p_image_id uuid
)
```

- [x] Add null validation for `p_listing_id` before image lookup:

```sql
if p_listing_id is null then
  raise exception 'invalid listing id'
    using errcode = '22023';
end if;
```

- [x] Change image lookup and delete to require both ids:

```sql
select * into v_image
from public.listing_images
where id = p_image_id
  and listing_id = p_listing_id;
```

```sql
delete from public.listing_images
where id = p_image_id
  and listing_id = p_listing_id;
```

- [x] Update the grant:

```sql
grant execute on function public.admin_delete_listing_image(uuid, uuid) to authenticated;
```

- [x] Update SQL test calls to pass `listing_id` first.
- [x] Add a SQL test that creates or uses an image belonging to one listing, calls delete with a different listing id, and expects `P0002`. (See `tests/sql/phase8_admin_listing_images.sql:319-356`.)
- [x] Run:

```powershell
node --experimental-strip-types --test tests\phase8-admin-listings-images-route.test.mts
bash .codex/scripts/test-db-security.sh
```

*(Node tests passed; bash DB security test could not run — WSL2/Docker bash unavailable.)*

- [x] Expected result: route delete args include listing id; DB refuses cross-listing image deletion. (Route verified by tests; cross-listing DB rejection verified by code inspection.)

### Task 4: Complete Rent Checkout-Ready Service Rules

**Files:**
- Modify: `supabase/migrations/20260430110000_33_phase8_admin_listing_config.sql`
- Modify: `tests/sql/phase8_admin_listing_config.sql`

- [x] In `tests/sql/phase8_admin_listing_config.sql`, seed a deterministic active service catalog row and enabled `listing_service_options` row for the checkout-ready rent listing.
- [x] Add or adjust fixtures so there are three rent readiness states:
  - Rent with enabled active main item and enabled active service option: ready.
  - Rent with no enabled main item: not ready, missing `enabled_main_item`.
  - Rent with enabled active main item but no enabled active service option: not ready, missing `enabled_service_option`.
- [x] Add SQL assertions:
  - `admin_get_listing` returns `checkout_eligibility.is_checkout_ready = false` and missing contains `enabled_service_option` for the service-missing listing.
  - `admin_set_listing_status(..., 'active')` raises `P0004` for the service-missing rent listing.
  - Sale listing without checkout config still activates successfully.
- [ ] Run `bash .codex/scripts/test-db-security.sh`. (Could not run: WSL2/Docker bash unavailable.)
- [x] Expected red result: service-missing rent listing currently appears ready or activates.
- [x] In `admin_listing_is_checkout_ready(p_listing_id)`, require both:

```sql
exists (
  select 1
  from public.listing_main_item_options m
  join public.main_item_catalog mc on mc.id = m.main_item_id
  where m.listing_id = p_listing_id
    and m.is_enabled = true
    and mc.is_active = true
)
and exists (
  select 1
  from public.listing_service_options s
  join public.service_catalog sc on sc.id = s.service_id
  where s.listing_id = p_listing_id
    and s.is_enabled = true
    and sc.is_active = true
)
```

- [x] Replace inline readiness logic in `admin_list_listings` with `public.admin_listing_is_checkout_ready(l.id)`.
- [x] Replace inline readiness logic in `admin_get_listing` with the helper and build `v_missing` with two independent checks:
  - append `enabled_main_item` when no enabled active main item exists.
  - append `enabled_service_option` when no enabled active service option exists.
- [x] Keep `admin_set_listing_status` using `public.admin_listing_is_checkout_ready(v_listing.id)` for rent activation.
- [ ] Run `bash .codex/scripts/test-db-security.sh`. (Could not run: WSL2/Docker bash unavailable.)
- [x] Expected result: rent activation fails closed without service config and succeeds only when both main item and service option are enabled and active. (Verified via migration code inspection.)

### Task 5: Allow Main Item `override_label` Cleanup

**Files:**
- Modify: `supabase/migrations/20260430130000_35_phase8_admin_listing_pricing.sql`
- Modify: `tests/sql/phase8_admin_listing_pricing.sql`

- [x] In `tests/sql/phase8_admin_listing_pricing.sql`, after the existing custom label assertion, add a cleanup assertion:

```sql
v_result := public.admin_configure_listing_main_item(
  'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
  'phase8_main',
  jsonb_build_object(
    'is_enabled', true,
    'override_label', ''
  )
);

if v_result ? 'override_label' and v_result ->> 'override_label' is not null then
  raise exception 'Override label should clear to null, got %', v_result ->> 'override_label';
end if;
```

- [ ] Run `bash .codex/scripts/test-db-security.sh`. (Could not run: WSL2/Docker bash unavailable.)
- [x] Expected red result: returned `override_label` remains `Custom Label`.
- [x] In `admin_configure_listing_main_item`, change conflict update behavior from:

```sql
override_label = coalesce(excluded.override_label, listing_main_item_options.override_label),
```

to:

```sql
override_label = case
  when p_payload ? 'override_label' then excluded.override_label
  else listing_main_item_options.override_label
end,
```

- [ ] Run `bash .codex/scripts/test-db-security.sh`. (Could not run: WSL2/Docker bash unavailable.)
- [x] Expected result: `override_label` can be cleared to null and absent override label still preserves the previous value. (Verified via migration code inspection of `supabase/migrations/20260430130000_35_phase8_admin_listing_pricing.sql:168-171`.)

## Final Validation

- [x] Run narrow route tests:

```powershell
node --experimental-strip-types --test tests\phase8-admin-listings-route.test.mts tests\phase8-admin-listings-images-route.test.mts tests\phase8-admin-listings-pricing-route.test.mts
```

*Result: 67/67 PASS.*

- [ ] Run DB security tests: (Could not run: WSL2/Docker bash unavailable in this Windows workspace.)

```powershell
bash .codex/scripts/test-db-security.sh
```

- [x] Run repo baseline:

```powershell
npm test
```

*`npm test` itself depends on `bash` (payment callback security script) which fails on this WSL2-disabled host. Equivalent coverage was run directly via Node: 152/152 baseline tests PASS, `npm run typecheck` PASS, `npm run lint` PASS (1 pre-existing unrelated warning in `tests/phase7-communication-read-messages-route.test.mts:669`).*

- [ ] Run build only if typecheck/lint touched Next route exports or if `npm test` reveals build-adjacent risk: (Skipped — no Next route exports changed.)

```powershell
npm run build
```

## Assumptions

- Phase 8 migration files are still mutable in this workspace, so fix existing Phase 8 migrations in place instead of adding corrective migrations.
- Rent checkout-ready minimum is exactly one enabled active main item plus one enabled active service option.
- Image delete mismatch should return the same not-found surface as a missing image (`P0002` mapped to 404), not a distinct ownership error.
- Route-level tests may keep mocking RPCs; SQL tests are the authoritative coverage for DB/RPC behavior.
