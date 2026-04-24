# Phase 5 Backend Read Models Task 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Phase 5 Supabase RPC read models that make `tests/sql/phase5_backend_read_models.sql` pass.

**Architecture:** Read models stay in Supabase as public RPC functions with explicit grants and RLS-aware access. Public listing functions are executable by `anon` and `authenticated`; admin read functions require `public.is_admin()` and return `42501` for non-admin callers. No Next.js route or Payload ownership is added for this task.

**Tech Stack:** PostgreSQL, Supabase migrations, PL/pgSQL, SQL smoke/security tests, npm script `npm run test:db-security`.

---

## File Structure

- Create: `supabase/migrations/20260424100000_26_phase5_backend_read_models.sql`
  - Defines Phase 5 read-model RPCs.
  - Keeps all source of truth in versioned Supabase migrations.
  - Uses explicit pagination validation with SQLSTATE `22023`.
  - Uses explicit admin guard with SQLSTATE `42501`.
- Existing test: `tests/sql/phase5_backend_read_models.sql`
  - Added by Task 1.
  - Must stay unchanged unless the migration reveals a test contract bug.
- Existing script: `.codex/scripts/test-db-security.sh`
  - Runs all SQL tests against a clean Supabase local DB.

## Layer Decision

- `docs/SUPABASE_CAPABILITY_AUDIT.md` says public/admin read surfaces should start with `table/view/RPC + RLS`.
- `docs/IMPLEMENTATION_PLAN.md` Faz 5 says listing, service, reservation, order, payment, and event read models are backend contracts for frontend/admin teams.
- Therefore Task 2 is a Supabase migration only. Do not add Payload collections, Next route handlers, or service-role orchestration.

## RPC Contract

- `public.list_public_listings(p_type public.listing_type, p_city text, p_limit integer, p_offset integer) returns jsonb`
- `public.get_public_listing_detail(p_listing_id uuid) returns jsonb`
- `public.list_public_listing_services(p_listing_id uuid) returns jsonb`
- `public.list_admin_reservations(p_status public.reservation_status, p_limit integer, p_offset integer) returns jsonb`
- `public.list_admin_orders(p_status public.order_status, p_limit integer, p_offset integer) returns jsonb`
- `public.list_admin_payments(p_status public.payment_status, p_limit integer, p_offset integer) returns jsonb`
- `public.list_admin_payment_events(p_payment_id uuid, p_limit integer, p_offset integer) returns jsonb`

Each list response returns:

```json
{
  "items": [],
  "limit": 20,
  "offset": 0
}
```

## Task 1: Commit the Red Contract Test

**Files:**
- Add to commit: `tests/sql/phase5_backend_read_models.sql`

- [ ] **Step 1: Verify the current red state**

Run:

```bash
npm run test:db-security
```

Expected: FAIL with the first missing Phase 5 RPC, for example:

```text
function public.list_public_listings(listing_type, text, integer, integer) does not exist
```

- [ ] **Step 2: Stage the Task 1 test file**

Run:

```bash
git add tests/sql/phase5_backend_read_models.sql
```

- [ ] **Step 3: Commit the red contract**

Run:

```bash
git commit -m "test: define phase 5 backend read model contract"
```

Expected: commit contains only `tests/sql/phase5_backend_read_models.sql`.

## Task 2: Add Public Listing Read RPCs

**Files:**
- Create: `supabase/migrations/20260424100000_26_phase5_backend_read_models.sql`
- Test: `tests/sql/phase5_backend_read_models.sql`

- [ ] **Step 1: Create the migration with shared conventions**

Create `supabase/migrations/20260424100000_26_phase5_backend_read_models.sql` with this header and public listing RPCs:

```sql
-- Phase 5 / Task 2: backend read model RPCs

create or replace function public.list_public_listings(
  p_type public.listing_type default null,
  p_city text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
stable
as $$
declare
  v_items jsonb;
begin
  if p_limit < 1 or p_limit > 100 or p_offset < 0 then
    raise exception 'invalid pagination'
      using errcode = '22023';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', l.id,
        'type', l.type,
        'status', l.status,
        'title', l.title,
        'slug', l.slug,
        'summary', l.summary,
        'city', l.city,
        'district', l.district,
        'price', l.price,
        'currency', l.currency,
        'room_count', l.room_count,
        'bathroom_count', l.bathroom_count,
        'gross_area_m2', l.gross_area_m2,
        'is_furnished', l.is_furnished,
        'primary_image_url', img.image_url,
        'created_at', l.created_at
      )
      order by l.created_at desc, l.id
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select *
    from public.listings
    where status = 'active'
      and (p_type is null or type = p_type)
      and (p_city is null or city = p_city)
    order by created_at desc, id
    limit p_limit
    offset p_offset
  ) l
  left join lateral (
    select li.image_url
    from public.listing_images li
    where li.listing_id = l.id
    order by li.is_primary desc, li.sort_order, li.created_at, li.id
    limit 1
  ) img on true;

  return jsonb_build_object(
    'items', v_items,
    'limit', p_limit,
    'offset', p_offset
  );
end;
$$;

create or replace function public.get_public_listing_detail(
  p_listing_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
stable
as $$
declare
  v_listing public.listings%rowtype;
  v_images jsonb;
begin
  select *
  into v_listing
  from public.listings
  where id = p_listing_id
    and status = 'active';

  if not found then
    raise exception 'listing not found'
      using errcode = 'P0002';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', li.id,
        'image_url', li.image_url,
        'alt_text', li.alt_text,
        'sort_order', li.sort_order,
        'is_primary', li.is_primary
      )
      order by li.is_primary desc, li.sort_order, li.created_at, li.id
    ),
    '[]'::jsonb
  )
  into v_images
  from public.listing_images li
  where li.listing_id = p_listing_id;

  return jsonb_build_object(
    'id', v_listing.id,
    'type', v_listing.type,
    'status', v_listing.status,
    'title', v_listing.title,
    'slug', v_listing.slug,
    'summary', v_listing.summary,
    'description', v_listing.description,
    'city', v_listing.city,
    'district', v_listing.district,
    'address_line', v_listing.address_line,
    'price', v_listing.price,
    'currency', v_listing.currency,
    'room_count', v_listing.room_count,
    'bathroom_count', v_listing.bathroom_count,
    'gross_area_m2', v_listing.gross_area_m2,
    'is_furnished', v_listing.is_furnished,
    'images', v_images,
    'created_at', v_listing.created_at,
    'updated_at', v_listing.updated_at
  );
end;
$$;

create or replace function public.list_public_listing_services(
  p_listing_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
stable
as $$
declare
  v_items jsonb;
begin
  if not exists (
    select 1
    from public.listings l
    where l.id = p_listing_id
      and l.status = 'active'
  ) then
    raise exception 'listing not found'
      using errcode = 'P0002';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', sc.id,
        'code', sc.code,
        'name', sc.name,
        'description', sc.description,
        'price', coalesce(lso.override_price, sc.base_price),
        'currency', 'TRY'
      )
      order by sc.code
    ),
    '[]'::jsonb
  )
  into v_items
  from public.listing_service_options lso
  join public.service_catalog sc on sc.id = lso.service_id
  where lso.listing_id = p_listing_id
    and lso.is_enabled = true
    and sc.is_active = true;

  return jsonb_build_object('items', v_items);
end;
$$;
```

- [ ] **Step 2: Run the SQL test and confirm the next missing admin RPC**

Run:

```bash
npm run test:db-security
```

Expected: FAIL moves past public read checks and stops at the first missing admin RPC, for example:

```text
function public.list_admin_reservations(reservation_status, integer, integer) does not exist
```

## Task 3: Add Admin Read RPCs

**Files:**
- Modify: `supabase/migrations/20260424100000_26_phase5_backend_read_models.sql`
- Test: `tests/sql/phase5_backend_read_models.sql`

- [ ] **Step 1: Append admin read RPCs to the same migration**

Append this SQL to `supabase/migrations/20260424100000_26_phase5_backend_read_models.sql`:

```sql
create or replace function public.list_admin_reservations(
  p_status public.reservation_status default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
stable
as $$
declare
  v_items jsonb;
begin
  if p_limit < 1 or p_limit > 100 or p_offset < 0 then
    raise exception 'invalid pagination'
      using errcode = '22023';
  end if;

  if not public.is_admin() then
    raise exception 'admin role required'
      using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'listing_id', r.listing_id,
        'user_id', r.user_id,
        'move_in_date', r.move_in_date,
        'stay_months', r.stay_months,
        'guest_count', r.guest_count,
        'note', r.note,
        'status', r.status,
        'listing', jsonb_build_object(
          'id', l.id,
          'title', l.title,
          'status', l.status,
          'city', l.city,
          'district', l.district
        ),
        'created_at', r.created_at,
        'updated_at', r.updated_at
      )
      order by r.created_at desc, r.id
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select *
    from public.reservations
    where p_status is null or status = p_status
    order by created_at desc, id
    limit p_limit
    offset p_offset
  ) r
  join public.listings l on l.id = r.listing_id;

  return jsonb_build_object('items', v_items, 'limit', p_limit, 'offset', p_offset);
end;
$$;

create or replace function public.list_admin_orders(
  p_status public.order_status default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
stable
as $$
declare
  v_items jsonb;
begin
  if p_limit < 1 or p_limit > 100 or p_offset < 0 then
    raise exception 'invalid pagination'
      using errcode = '22023';
  end if;

  if not public.is_admin() then
    raise exception 'admin role required'
      using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'reservation_id', o.reservation_id,
        'user_id', o.user_id,
        'total_amount', o.total_amount,
        'currency', o.currency,
        'status', o.status,
        'reservation', jsonb_build_object(
          'id', r.id,
          'listing_id', r.listing_id,
          'status', r.status
        ),
        'created_at', o.created_at,
        'updated_at', o.updated_at
      )
      order by o.created_at desc, o.id
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select *
    from public.orders
    where p_status is null or status = p_status
    order by created_at desc, id
    limit p_limit
    offset p_offset
  ) o
  join public.reservations r on r.id = o.reservation_id;

  return jsonb_build_object('items', v_items, 'limit', p_limit, 'offset', p_offset);
end;
$$;

create or replace function public.list_admin_payments(
  p_status public.payment_status default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
stable
as $$
declare
  v_items jsonb;
begin
  if p_limit < 1 or p_limit > 100 or p_offset < 0 then
    raise exception 'invalid pagination'
      using errcode = '22023';
  end if;

  if not public.is_admin() then
    raise exception 'admin role required'
      using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'order_id', p.order_id,
        'user_id', p.user_id,
        'amount', p.amount,
        'currency', p.currency,
        'status', p.status,
        'provider', p.provider,
        'provider_ref', p.provider_ref,
        'order', jsonb_build_object(
          'id', o.id,
          'reservation_id', o.reservation_id,
          'status', o.status,
          'total_amount', o.total_amount,
          'currency', o.currency
        ),
        'created_at', p.created_at,
        'updated_at', p.updated_at
      )
      order by p.created_at desc, p.id
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select *
    from public.payments
    where p_status is null or status = p_status
    order by created_at desc, id
    limit p_limit
    offset p_offset
  ) p
  join public.orders o on o.id = p.order_id;

  return jsonb_build_object('items', v_items, 'limit', p_limit, 'offset', p_offset);
end;
$$;

create or replace function public.list_admin_payment_events(
  p_payment_id uuid default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
stable
as $$
declare
  v_items jsonb;
begin
  if p_limit < 1 or p_limit > 100 or p_offset < 0 then
    raise exception 'invalid pagination'
      using errcode = '22023';
  end if;

  if not public.is_admin() then
    raise exception 'admin role required'
      using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'payment_id', e.payment_id,
        'event_type', e.event_type,
        'provider', e.provider,
        'payload', e.payload,
        'created_at', e.created_at
      )
      order by e.created_at desc, e.id
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select *
    from public.payment_events
    where p_payment_id is null or payment_id = p_payment_id
    order by created_at desc, id
    limit p_limit
    offset p_offset
  ) e;

  return jsonb_build_object('items', v_items, 'limit', p_limit, 'offset', p_offset);
end;
$$;
```

- [ ] **Step 2: Run the SQL test and capture any shape or permission failures**

Run:

```bash
npm run test:db-security
```

Expected: if the migration is complete, this should pass and include:

```text
test-db-security: ok
```

If it fails, only adjust the migration when the failure shows a real mismatch with `tests/sql/phase5_backend_read_models.sql`.

## Task 4: Lock Function Grants

**Files:**
- Modify: `supabase/migrations/20260424100000_26_phase5_backend_read_models.sql`
- Test: `tests/sql/phase5_backend_read_models.sql`

- [ ] **Step 1: Append explicit revoke/grant statements**

Append this SQL to the migration:

```sql
revoke all on function public.list_public_listings(public.listing_type, text, integer, integer) from public;
grant execute on function public.list_public_listings(public.listing_type, text, integer, integer)
to anon, authenticated;

revoke all on function public.get_public_listing_detail(uuid) from public;
grant execute on function public.get_public_listing_detail(uuid)
to anon, authenticated;

revoke all on function public.list_public_listing_services(uuid) from public;
grant execute on function public.list_public_listing_services(uuid)
to anon, authenticated;

revoke all on function public.list_admin_reservations(public.reservation_status, integer, integer) from public;
grant execute on function public.list_admin_reservations(public.reservation_status, integer, integer)
to authenticated;

revoke all on function public.list_admin_orders(public.order_status, integer, integer) from public;
grant execute on function public.list_admin_orders(public.order_status, integer, integer)
to authenticated;

revoke all on function public.list_admin_payments(public.payment_status, integer, integer) from public;
grant execute on function public.list_admin_payments(public.payment_status, integer, integer)
to authenticated;

revoke all on function public.list_admin_payment_events(uuid, integer, integer) from public;
grant execute on function public.list_admin_payment_events(uuid, integer, integer)
to authenticated;
```

- [ ] **Step 2: Run DB security validation**

Run:

```bash
npm run test:db-security
```

Expected:

```text
test-db-security: ok
```

## Task 5: Run Focused Repo Validation and Commit

**Files:**
- Commit: `tests/sql/phase5_backend_read_models.sql`
- Commit: `supabase/migrations/20260424100000_26_phase5_backend_read_models.sql`

- [ ] **Step 1: Run full local test baseline**

Run:

```bash
npm test
```

Expected:

```text
payment-callback-security: ok
```

and `typecheck` plus `lint` pass.

- [ ] **Step 2: Check git diff**

Run:

```bash
git diff --check
git status --short
```

Expected:

```text
A  tests/sql/phase5_backend_read_models.sql
A  supabase/migrations/20260424100000_26_phase5_backend_read_models.sql
```

There may be `??` before staging; after staging both files should be `A`.

- [ ] **Step 3: Commit Phase 5 read models**

Run:

```bash
git add tests/sql/phase5_backend_read_models.sql supabase/migrations/20260424100000_26_phase5_backend_read_models.sql
git commit -m "feat: add phase 5 backend read models"
```

Expected: one commit containing the Task 1 SQL test contract and Task 2 migration implementation.

## Self-Review

- Spec coverage: The plan covers all Task 1 red-contract scenarios by implementing the seven requested RPCs and their pagination, public visibility, admin authorization, and response shape.
- Placeholder scan: No `TBD`, `TODO`, or undefined implementation steps remain.
- Type consistency: Function signatures match the calls in `tests/sql/phase5_backend_read_models.sql`.
- Boundary check: No Next.js route, Payload collection, or service-role orchestration is introduced.
