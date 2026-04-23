\set ON_ERROR_STOP on

-- Phase 4/5: admin workflow RPCs for cancel / reopen / confirm

-- deterministic users
-- admin:  aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb001
-- user:   aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb002

-- deterministic listings
-- cancel-pending:  cccccccc-dddd-4ddd-8ddd-ddddddddd001
-- cancel-success:  cccccccc-dddd-4ddd-8ddd-ddddddddd002
-- confirm-repair:  cccccccc-dddd-4ddd-8ddd-ddddddddd003
-- reopen-blocked:  cccccccc-dddd-4ddd-8ddd-ddddddddd004

-- deterministic reservations
-- pending cancel:   eeeeeeee-ffff-4fff-8fff-fffffffff001
-- success cancel:   eeeeeeee-ffff-4fff-8fff-fffffffff002
-- confirm repair:   eeeeeeee-ffff-4fff-8fff-fffffffff003
-- reopen blocked:   eeeeeeee-ffff-4fff-8fff-fffffffff004

-- deterministic orders
-- pending cancel:   11111111-2222-4222-8222-222222222001
-- success cancel:   11111111-2222-4222-8222-222222222002
-- confirm repair:   11111111-2222-4222-8222-222222222003
-- reopen blocked:   11111111-2222-4222-8222-222222222004

-- deterministic payments
-- pending cancel:   33333333-4444-4444-8444-444444444001
-- success cancel:   33333333-4444-4444-8444-444444444002
-- confirm repair:   33333333-4444-4444-8444-444444444003
-- reopen blocked:   33333333-4444-4444-8444-444444444004

delete from public.admin_workflow_events
where id in (
  '55555555-6666-4666-8666-666666666001'::uuid,
  '55555555-6666-4666-8666-666666666002'::uuid,
  '55555555-6666-4666-8666-666666666003'::uuid
);

delete from public.payment_events
where payment_id in (
  '33333333-4444-4444-8444-444444444001'::uuid,
  '33333333-4444-4444-8444-444444444002'::uuid,
  '33333333-4444-4444-8444-444444444003'::uuid,
  '33333333-4444-4444-8444-444444444004'::uuid
);

delete from public.payments
where id in (
  '33333333-4444-4444-8444-444444444001'::uuid,
  '33333333-4444-4444-8444-444444444002'::uuid,
  '33333333-4444-4444-8444-444444444003'::uuid,
  '33333333-4444-4444-8444-444444444004'::uuid
);

delete from public.orders
where id in (
  '11111111-2222-4222-8222-222222222001'::uuid,
  '11111111-2222-4222-8222-222222222002'::uuid,
  '11111111-2222-4222-8222-222222222003'::uuid,
  '11111111-2222-4222-8222-222222222004'::uuid
);

delete from public.reservations
where id in (
  'eeeeeeee-ffff-4fff-8fff-fffffffff001'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff002'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff003'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff004'::uuid
);

delete from public.listings
where id in (
  'cccccccc-dddd-4ddd-8ddd-ddddddddd001'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd002'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd003'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd004'::uuid
);

delete from auth.users
where id in (
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb001'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb002'::uuid
);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values
(
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb001'::uuid,
  'authenticated',
  'authenticated',
  'phase45-admin@example.com',
  crypt('test-password', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Phase45 Admin'),
  now(),
  now(),
  '',
  '',
  '',
  ''
),
(
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb002'::uuid,
  'authenticated',
  'authenticated',
  'phase45-user@example.com',
  crypt('test-password', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Phase45 User'),
  now(),
  now(),
  '',
  '',
  '',
  ''
);

update public.profiles
set role = 'admin'
where id = 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb001'::uuid;

insert into public.listings (
  id,
  type,
  status,
  title,
  slug,
  city,
  price,
  currency
)
values
(
  'cccccccc-dddd-4ddd-8ddd-ddddddddd001'::uuid,
  'rent',
  'active',
  'Admin Cancel Pending Listing',
  'admin-cancel-pending-listing',
  'Istanbul',
  25000,
  'TRY'
),
(
  'cccccccc-dddd-4ddd-8ddd-ddddddddd002'::uuid,
  'rent',
  'passive',
  'Admin Cancel Success Listing',
  'admin-cancel-success-listing',
  'Istanbul',
  30000,
  'TRY'
),
(
  'cccccccc-dddd-4ddd-8ddd-ddddddddd003'::uuid,
  'rent',
  'active',
  'Admin Confirm Repair Listing',
  'admin-confirm-repair-listing',
  'Istanbul',
  28000,
  'TRY'
),
(
  'cccccccc-dddd-4ddd-8ddd-ddddddddd004'::uuid,
  'rent',
  'passive',
  'Admin Reopen Blocked Listing',
  'admin-reopen-blocked-listing',
  'Istanbul',
  32000,
  'TRY'
);

insert into public.reservations (
  id,
  listing_id,
  user_id,
  move_in_date,
  stay_months,
  guest_count,
  note,
  status
)
values
(
  'eeeeeeee-ffff-4fff-8fff-fffffffff001'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd001'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb002'::uuid,
  current_date + 7,
  6,
  1,
  'pending cancel flow',
  'pending'
),
(
  'eeeeeeee-ffff-4fff-8fff-fffffffff002'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd002'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb002'::uuid,
  current_date + 10,
  6,
  1,
  'post payment cancel flow',
  'confirmed'
),
(
  'eeeeeeee-ffff-4fff-8fff-fffffffff003'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd003'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb002'::uuid,
  current_date + 12,
  6,
  1,
  'manual confirm repair flow',
  'pending'
),
(
  'eeeeeeee-ffff-4fff-8fff-fffffffff004'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd004'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb002'::uuid,
  current_date + 14,
  6,
  1,
  'reopen blocked flow',
  'pending'
);

insert into public.orders (
  id,
  reservation_id,
  user_id,
  total_amount,
  currency,
  status
)
values
(
  '11111111-2222-4222-8222-222222222001'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff001'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb002'::uuid,
  25000,
  'TRY',
  'pending'
),
(
  '11111111-2222-4222-8222-222222222002'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff002'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb002'::uuid,
  30000,
  'TRY',
  'completed'
),
(
  '11111111-2222-4222-8222-222222222003'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff003'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb002'::uuid,
  28000,
  'TRY',
  'pending'
),
(
  '11111111-2222-4222-8222-222222222004'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff004'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb002'::uuid,
  32000,
  'TRY',
  'pending'
);

insert into public.payments (
  id,
  order_id,
  user_id,
  amount,
  currency,
  status,
  provider,
  provider_ref
)
values
(
  '33333333-4444-4444-8444-444444444001'::uuid,
  '11111111-2222-4222-8222-222222222001'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb002'::uuid,
  25000,
  'TRY',
  'pending',
  'isbank',
  '33333333-4444-4444-8444-444444444001'
),
(
  '33333333-4444-4444-8444-444444444002'::uuid,
  '11111111-2222-4222-8222-222222222002'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb002'::uuid,
  30000,
  'TRY',
  'succeeded',
  'isbank',
  '33333333-4444-4444-8444-444444444002'
),
(
  '33333333-4444-4444-8444-444444444003'::uuid,
  '11111111-2222-4222-8222-222222222003'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb002'::uuid,
  28000,
  'TRY',
  'succeeded',
  'isbank',
  '33333333-4444-4444-8444-444444444003'
),
(
  '33333333-4444-4444-8444-444444444004'::uuid,
  '11111111-2222-4222-8222-222222222004'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb002'::uuid,
  32000,
  'TRY',
  'pending',
  'isbank',
  '33333333-4444-4444-8444-444444444004'
);

-- ============================================================
-- TEST 1: non-admin cannot cancel a reservation
-- ============================================================
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb002', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
begin
  begin
    perform public.admin_cancel_reservation(
      'eeeeeeee-ffff-4fff-8fff-fffffffff001'::uuid,
      'user_cannot_cancel',
      null
    );
    raise exception 'TEST 1 FAILED: non-admin should not cancel reservation';
  exception
    when insufficient_privilege then null;
    when sqlstate '42501' then null;
  end;
end;
$$;

reset role;

-- ============================================================
-- TEST 2: admin cancel pending reservation cancels payment/order/reservation
-- ============================================================
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb001', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
declare
  v_result jsonb;
  v_reservation_status text;
  v_order_status text;
  v_payment_status text;
  v_listing_status text;
  v_event_count integer;
begin
  v_result := public.admin_cancel_reservation(
    'eeeeeeee-ffff-4fff-8fff-fffffffff001'::uuid,
    'customer_withdrew_before_payment',
    'customer changed plans'
  );

  if v_result->>'result' <> 'cancelled' then
    raise exception 'TEST 2 FAILED: expected cancelled result, got %', v_result;
  end if;

  select status::text into v_reservation_status
  from public.reservations
  where id = 'eeeeeeee-ffff-4fff-8fff-fffffffff001'::uuid;

  select status::text into v_order_status
  from public.orders
  where id = '11111111-2222-4222-8222-222222222001'::uuid;

  select status::text into v_payment_status
  from public.payments
  where id = '33333333-4444-4444-8444-444444444001'::uuid;

  select status::text into v_listing_status
  from public.listings
  where id = 'cccccccc-dddd-4ddd-8ddd-ddddddddd001'::uuid;

  if v_reservation_status <> 'cancelled'
     or v_order_status <> 'cancelled'
     or v_payment_status <> 'cancelled'
     or v_listing_status <> 'active' then
    raise exception
      'TEST 2 FAILED: unexpected statuses reservation=% order=% payment=% listing=%',
      v_reservation_status, v_order_status, v_payment_status, v_listing_status;
  end if;

  select count(*) into v_event_count
  from public.admin_workflow_events
  where workflow_name = 'admin_cancel_reservation'
    and reservation_id = 'eeeeeeee-ffff-4fff-8fff-fffffffff001'::uuid;

  if v_event_count <> 1 then
    raise exception 'TEST 2 FAILED: expected one cancel event, got %', v_event_count;
  end if;
end;
$$;

reset role;

-- ============================================================
-- TEST 3: admin cancel succeeded reservation keeps payment truth but cancels reservation/order
-- ============================================================
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb001', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
declare
  v_result jsonb;
  v_reservation_status text;
  v_order_status text;
  v_payment_status text;
  v_listing_status text;
begin
  v_result := public.admin_cancel_reservation(
    'eeeeeeee-ffff-4fff-8fff-fffffffff002'::uuid,
    'manual_documents_failed',
    'documents failed after payment'
  );

  if v_result->>'result' <> 'cancelled' then
    raise exception 'TEST 3 FAILED: expected cancelled result, got %', v_result;
  end if;

  select status::text into v_reservation_status
  from public.reservations
  where id = 'eeeeeeee-ffff-4fff-8fff-fffffffff002'::uuid;

  select status::text into v_order_status
  from public.orders
  where id = '11111111-2222-4222-8222-222222222002'::uuid;

  select status::text into v_payment_status
  from public.payments
  where id = '33333333-4444-4444-8444-444444444002'::uuid;

  select status::text into v_listing_status
  from public.listings
  where id = 'cccccccc-dddd-4ddd-8ddd-ddddddddd002'::uuid;

  if v_reservation_status <> 'cancelled'
     or v_order_status <> 'cancelled'
     or v_payment_status <> 'succeeded'
     or v_listing_status <> 'passive' then
    raise exception
      'TEST 3 FAILED: unexpected statuses reservation=% order=% payment=% listing=%',
      v_reservation_status, v_order_status, v_payment_status, v_listing_status;
  end if;
end;
$$;

reset role;

-- ============================================================
-- TEST 4: admin reopen listing after cancelled flow
-- ============================================================
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb001', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
declare
  v_result jsonb;
  v_listing_status text;
  v_event_count integer;
begin
  v_result := public.admin_reopen_listing(
    'cccccccc-dddd-4ddd-8ddd-ddddddddd002'::uuid,
    'manual_resolution_completed',
    'paperwork and refund handled offline'
  );

  if v_result->>'result' <> 'reopened' then
    raise exception 'TEST 4 FAILED: expected reopened result, got %', v_result;
  end if;

  select status::text into v_listing_status
  from public.listings
  where id = 'cccccccc-dddd-4ddd-8ddd-ddddddddd002'::uuid;

  if v_listing_status <> 'active' then
    raise exception 'TEST 4 FAILED: expected active listing, got %', v_listing_status;
  end if;

  select count(*) into v_event_count
  from public.admin_workflow_events
  where workflow_name = 'admin_reopen_listing'
    and listing_id = 'cccccccc-dddd-4ddd-8ddd-ddddddddd002'::uuid;

  if v_event_count <> 1 then
    raise exception 'TEST 4 FAILED: expected one reopen event, got %', v_event_count;
  end if;
end;
$$;

reset role;

-- ============================================================
-- TEST 5: admin cannot reopen listing with live pending checkout
-- ============================================================
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb001', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
begin
  begin
    perform public.admin_reopen_listing(
      'cccccccc-dddd-4ddd-8ddd-ddddddddd004'::uuid,
      'should_fail_pending_checkout',
      null
    );
    raise exception 'TEST 5 FAILED: reopen should fail while pending checkout exists';
  exception
    when sqlstate 'P0001' then null;
  end;
end;
$$;

reset role;

-- ============================================================
-- TEST 6: admin confirm reservation finalizes succeeded payment repair
-- ============================================================
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb001', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
declare
  v_result jsonb;
  v_reservation_status text;
  v_order_status text;
  v_payment_status text;
  v_listing_status text;
begin
  v_result := public.admin_confirm_reservation(
    'eeeeeeee-ffff-4fff-8fff-fffffffff003'::uuid,
    'documents completed in backoffice'
  );

  if v_result->>'result' <> 'confirmed' then
    raise exception 'TEST 6 FAILED: expected confirmed result, got %', v_result;
  end if;

  select status::text into v_reservation_status
  from public.reservations
  where id = 'eeeeeeee-ffff-4fff-8fff-fffffffff003'::uuid;

  select status::text into v_order_status
  from public.orders
  where id = '11111111-2222-4222-8222-222222222003'::uuid;

  select status::text into v_payment_status
  from public.payments
  where id = '33333333-4444-4444-8444-444444444003'::uuid;

  select status::text into v_listing_status
  from public.listings
  where id = 'cccccccc-dddd-4ddd-8ddd-ddddddddd003'::uuid;

  if v_reservation_status <> 'confirmed'
     or v_order_status <> 'completed'
     or v_payment_status <> 'succeeded'
     or v_listing_status <> 'passive' then
    raise exception
      'TEST 6 FAILED: unexpected statuses reservation=% order=% payment=% listing=%',
      v_reservation_status, v_order_status, v_payment_status, v_listing_status;
  end if;
end;
$$;

reset role;

-- ============================================================
-- TEST 7: admin confirm rejects non-succeeded payment
-- ============================================================
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb001', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
begin
  begin
    perform public.admin_confirm_reservation(
      'eeeeeeee-ffff-4fff-8fff-fffffffff004'::uuid,
      'should_fail_unsucceeded_payment'
    );
    raise exception 'TEST 7 FAILED: confirm should reject non-succeeded payment';
  exception
    when sqlstate 'P0001' then null;
  end;
end;
$$;

reset role;

-- ============================================================
-- TEST 8: admin read models expose latest event and eligibility
-- ============================================================
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb001', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
declare
  v_reservation_snapshot jsonb;
  v_listing_snapshot jsonb;
begin
  v_reservation_snapshot := public.get_admin_reservation_workflow_snapshot(
    'eeeeeeee-ffff-4fff-8fff-fffffffff002'::uuid
  );

  if v_reservation_snapshot #>> '{latest_event,workflow_name}' <> 'admin_cancel_reservation' then
    raise exception 'TEST 8 FAILED: expected latest reservation event to be cancel, got %', v_reservation_snapshot;
  end if;

  if v_reservation_snapshot #>> '{eligibility,can_cancel}' <> 'false' then
    raise exception 'TEST 8 FAILED: cancelled reservation should not be cancelable again, got %', v_reservation_snapshot;
  end if;

  v_listing_snapshot := public.get_admin_listing_workflow_snapshot(
    'cccccccc-dddd-4ddd-8ddd-ddddddddd002'::uuid
  );

  if v_listing_snapshot #>> '{latest_event,workflow_name}' <> 'admin_reopen_listing' then
    raise exception 'TEST 8 FAILED: expected latest listing event to be reopen, got %', v_listing_snapshot;
  end if;

  if v_listing_snapshot #>> '{eligibility,can_reopen}' <> 'false' then
    raise exception 'TEST 8 FAILED: active listing should not be reopenable, got %', v_listing_snapshot;
  end if;
end;
$$;

reset role;

-- cleanup
delete from public.admin_workflow_events
where reservation_id in (
  'eeeeeeee-ffff-4fff-8fff-fffffffff001'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff002'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff003'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff004'::uuid
)
or listing_id in (
  'cccccccc-dddd-4ddd-8ddd-ddddddddd001'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd002'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd003'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd004'::uuid
);

delete from public.payment_events
where payment_id in (
  '33333333-4444-4444-8444-444444444001'::uuid,
  '33333333-4444-4444-8444-444444444002'::uuid,
  '33333333-4444-4444-8444-444444444003'::uuid,
  '33333333-4444-4444-8444-444444444004'::uuid
);

delete from public.payments
where id in (
  '33333333-4444-4444-8444-444444444001'::uuid,
  '33333333-4444-4444-8444-444444444002'::uuid,
  '33333333-4444-4444-8444-444444444003'::uuid,
  '33333333-4444-4444-8444-444444444004'::uuid
);

delete from public.orders
where id in (
  '11111111-2222-4222-8222-222222222001'::uuid,
  '11111111-2222-4222-8222-222222222002'::uuid,
  '11111111-2222-4222-8222-222222222003'::uuid,
  '11111111-2222-4222-8222-222222222004'::uuid
);

delete from public.reservations
where id in (
  'eeeeeeee-ffff-4fff-8fff-fffffffff001'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff002'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff003'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff004'::uuid
);

delete from public.listings
where id in (
  'cccccccc-dddd-4ddd-8ddd-ddddddddd001'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd002'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd003'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd004'::uuid
);

delete from auth.users
where id in (
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb001'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb002'::uuid
);

select 'phase4_admin_workflows_ok' as result;
