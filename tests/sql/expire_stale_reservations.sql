\set ON_ERROR_STOP on

-- Test: expire_stale_reservations function
-- Verifies that stale pending reservations are expired when no succeeded payment exists.
-- Covers both pre-checkout abandon (no order) and checkout-but-never-paid (order+pending payment).

-- ── Cleanup ──────────────────────────────────────────────────────────

delete from public.payment_finance_ops
where reservation_id in (
  'eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa301'::uuid,
  'eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa302'::uuid,
  'eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa303'::uuid,
  'eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa304'::uuid,
  'eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa305'::uuid
);
delete from public.reservation_document_tracking
where reservation_id in (
  'eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa301'::uuid,
  'eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa302'::uuid,
  'eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa303'::uuid,
  'eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa304'::uuid,
  'eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa305'::uuid
);
delete from public.admin_workflow_events
where reservation_id in (
  'eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa301'::uuid,
  'eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa302'::uuid,
  'eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa303'::uuid,
  'eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa304'::uuid,
  'eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa305'::uuid
);
delete from public.payments where order_id in (
  '11111111-aaaa-4aaa-8aaa-aaaaaaaaa301'::uuid,
  '11111111-aaaa-4aaa-8aaa-aaaaaaaaa302'::uuid
);
delete from public.order_items where order_id in (
  '11111111-aaaa-4aaa-8aaa-aaaaaaaaa301'::uuid,
  '11111111-aaaa-4aaa-8aaa-aaaaaaaaa302'::uuid
);
delete from public.orders where id in (
  '11111111-aaaa-4aaa-8aaa-aaaaaaaaa301'::uuid,
  '11111111-aaaa-4aaa-8aaa-aaaaaaaaa302'::uuid
);
delete from public.reservation_intake
where reservation_id in (
  'eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa301'::uuid,
  'eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa302'::uuid,
  'eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa303'::uuid,
  'eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa304'::uuid,
  'eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa305'::uuid
);
delete from public.reservations
where id in (
  'eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa301'::uuid,
  'eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa302'::uuid,
  'eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa303'::uuid,
  'eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa304'::uuid,
  'eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa305'::uuid
);

update public.listings
set status = 'passive'
where id in (
  'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaa301'::uuid,
  'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaa302'::uuid,
  'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaa303'::uuid,
  'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaa304'::uuid
);

delete from public.listings
where id in (
  'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaa301'::uuid,
  'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaa302'::uuid,
  'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaa303'::uuid,
  'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaa304'::uuid
);

-- ── Fixtures ─────────────────────────────────────────────────────────

insert into public.listings (id, type, status, title, slug, summary, description, city, district, price, currency)
values
  ('cccccccc-aaaa-4aaa-8aaa-aaaaaaaaa301'::uuid, 'rent', 'passive', 'Expire Test Listing A', 'expire-test-a', 'test', 'test', 'Istanbul', 'Kadikoy', 40000, 'TRY'),
  ('cccccccc-aaaa-4aaa-8aaa-aaaaaaaaa302'::uuid, 'rent', 'passive', 'Expire Test Listing B', 'expire-test-b', 'test', 'test', 'Istanbul', 'Besiktas', 45000, 'TRY'),
  ('cccccccc-aaaa-4aaa-8aaa-aaaaaaaaa303'::uuid, 'rent', 'passive', 'Expire Test Listing C', 'expire-test-c', 'test', 'test', 'Istanbul', 'Sisli', 42000, 'TRY'),
  ('cccccccc-aaaa-4aaa-8aaa-aaaaaaaaa304'::uuid, 'rent', 'passive', 'Expire Test Listing D', 'expire-test-d', 'test', 'test', 'Istanbul', 'Uskudar', 38000, 'TRY');

-- Reservation 301: STALE pending, NO order → SHOULD expire
insert into public.reservations (id, listing_id, user_id, move_in_date, stay_months, guest_count, status, created_at, updated_at)
values ('eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa301'::uuid, 'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaa301'::uuid, 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb800'::uuid, current_date + 30, 6, 1, 'pending', now() - interval '2 hours', now() - interval '2 hours');

-- Reservation 302: STALE pending, HAS order + PENDING payment → SHOULD expire (DoS protection)
insert into public.reservations (id, listing_id, user_id, move_in_date, stay_months, guest_count, status, created_at, updated_at)
values ('eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa302'::uuid, 'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaa302'::uuid, 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb800'::uuid, current_date + 31, 6, 1, 'pending', now() - interval '2 hours', now() - interval '2 hours');
insert into public.orders (id, reservation_id, user_id, total_amount, currency, status)
values ('11111111-aaaa-4aaa-8aaa-aaaaaaaaa301'::uuid, 'eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa302'::uuid, 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb800'::uuid, 40000, 'TRY', 'pending');
insert into public.payments (order_id, user_id, amount, currency, status, provider)
values ('11111111-aaaa-4aaa-8aaa-aaaaaaaaa301'::uuid, 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb800'::uuid, 40000, 'TRY', 'pending', 'isbank');

-- Reservation 303: FRESH pending (just created 5 min ago), NO order → must NOT expire (not stale yet)
insert into public.reservations (id, listing_id, user_id, move_in_date, stay_months, guest_count, status, created_at, updated_at)
values ('eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa303'::uuid, 'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaa303'::uuid, 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb800'::uuid, current_date + 32, 6, 1, 'pending', now() - interval '5 minutes', now() - interval '5 minutes');

-- Reservation 304: STALE but already cancelled → must NOT expire (only pending expires)
insert into public.reservations (id, listing_id, user_id, move_in_date, stay_months, guest_count, status, created_at, updated_at)
values ('eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa304'::uuid, 'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaa302'::uuid, 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb800'::uuid, current_date + 33, 6, 1, 'cancelled', now() - interval '2 hours', now() - interval '2 hours');

-- Reservation 305: STALE pending, HAS order + SUCCEEDED payment → must NOT expire (legitimate checkout)
insert into public.reservations (id, listing_id, user_id, move_in_date, stay_months, guest_count, status, created_at, updated_at)
values ('eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa305'::uuid, 'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaa304'::uuid, 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb800'::uuid, current_date + 34, 6, 1, 'pending', now() - interval '2 hours', now() - interval '2 hours');
insert into public.orders (id, reservation_id, user_id, total_amount, currency, status)
values ('11111111-aaaa-4aaa-8aaa-aaaaaaaaa302'::uuid, 'eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa305'::uuid, 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb800'::uuid, 38000, 'TRY', 'completed');
insert into public.payments (order_id, user_id, amount, currency, status, provider)
values ('11111111-aaaa-4aaa-8aaa-aaaaaaaaa302'::uuid, 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb800'::uuid, 38000, 'TRY', 'succeeded', 'isbank');

-- ── Execute & Verify ─────────────────────────────────────────────────

do $$
declare
  v_expired integer;
  v_status_301 text;
  v_status_302 text;
  v_status_303 text;
  v_status_304 text;
  v_status_305 text;
begin
  -- Run the expire function
  v_expired := public.expire_stale_reservations();

  -- Should expire 301 (no order) and 302 (order + pending payment) = 2
  if v_expired < 2 then
    raise exception 'TEST FAILED: expected at least 2 expired reservations, got %', v_expired;
  end if;

  select status::text into v_status_301 from public.reservations where id = 'eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa301'::uuid;
  select status::text into v_status_302 from public.reservations where id = 'eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa302'::uuid;
  select status::text into v_status_303 from public.reservations where id = 'eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa303'::uuid;
  select status::text into v_status_304 from public.reservations where id = 'eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa304'::uuid;
  select status::text into v_status_305 from public.reservations where id = 'eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa305'::uuid;

  -- 301: stale + no order → must be expired
  if v_status_301 <> 'expired' then
    raise exception 'TEST FAILED: stale reservation without order must be expired, got %', v_status_301;
  end if;

  -- 302: stale + order + pending payment → must be expired (DoS protection)
  if v_status_302 <> 'expired' then
    raise exception 'TEST FAILED: stale reservation with pending payment must be expired (DoS protection), got %', v_status_302;
  end if;

  -- 303: fresh + no order → must stay pending (not stale yet)
  if v_status_303 <> 'pending' then
    raise exception 'TEST FAILED: fresh reservation must stay pending, got %', v_status_303;
  end if;

  -- 304: stale + cancelled → must stay cancelled (not pending)
  if v_status_304 <> 'cancelled' then
    raise exception 'TEST FAILED: already cancelled reservation must stay cancelled, got %', v_status_304;
  end if;

  -- 305: stale + order + succeeded payment → must stay pending (legitimate checkout)
  if v_status_305 <> 'pending' then
    raise exception 'TEST FAILED: reservation with succeeded payment must stay pending, got %', v_status_305;
  end if;
end;
$$;

-- ── Verify list_admin_reservations excludes orderless reservations ───

set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb800', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
declare
  v_rows jsonb;
  v_has_302 boolean;
  v_has_301 boolean;
  v_has_303 boolean;
begin
  v_rows := public.list_admin_reservations(null, 100, 0)->'items';

  -- Reservation 302 has an order → should appear
  v_has_302 := exists (
    select 1 from jsonb_array_elements(v_rows) item
    where item->>'id' = 'eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa302'
  );
  if not v_has_302 then
    raise exception 'TEST FAILED: reservation with order must appear in list_admin_reservations';
  end if;

  -- Reservation 301 is expired and has no order → should NOT appear
  v_has_301 := exists (
    select 1 from jsonb_array_elements(v_rows) item
    where item->>'id' = 'eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa301'
  );
  if v_has_301 then
    raise exception 'TEST FAILED: expired orderless reservation must NOT appear in list_admin_reservations';
  end if;

  -- Reservation 303 is fresh pending but no order → should NOT appear
  v_has_303 := exists (
    select 1 from jsonb_array_elements(v_rows) item
    where item->>'id' = 'eeeeeeee-aaaa-4aaa-8aaa-aaaaaaaaa303'
  );
  if v_has_303 then
    raise exception 'TEST FAILED: pending reservation without order must NOT appear in list_admin_reservations';
  end if;
end;
$$;

select 'expire_stale_reservations_test_ok' as result;
