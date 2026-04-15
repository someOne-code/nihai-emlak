\set ON_ERROR_STOP on

-- ============================================================
-- Phase 1 / Task 4: Transactional tables SQL behavior tests
-- TDD Red phase — these tests define expected behavior
-- ============================================================

-- deterministic test users (reuse Task 3 pattern)
-- admin:  33333333-3333-3333-3333-333333333333
-- user_a: 55555555-5555-5555-5555-555555555555
-- user_b: 66666666-6666-6666-6666-666666666666

-- deterministic test data IDs
-- listing:      bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1 (active, from task 3 seed)
-- reservation:  11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa
-- order:        22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb
-- order_item_1: 33333333-cccc-cccc-cccc-cccccccccccc (main_item)
-- order_item_2: 44444444-dddd-dddd-dddd-dddddddddddd (service_item)
-- payment:      55555555-eeee-eeee-eeee-eeeeeeeeeeee
-- payment_event:66666666-ffff-ffff-ffff-ffffffffffff

-- ============================================================
-- SETUP: create test users
-- ============================================================
delete from auth.users
where id in (
  '33333333-3333-3333-3333-333333333333'::uuid,
  '55555555-5555-5555-5555-555555555555'::uuid,
  '66666666-6666-6666-6666-666666666666'::uuid
);

insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
(
  '00000000-0000-0000-0000-000000000000',
  '33333333-3333-3333-3333-333333333333'::uuid,
  'authenticated', 'authenticated', 'task4-admin@example.com',
  crypt('test-password', gen_salt('bf')), now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Task4 Admin'),
  now(), now(), '', '', '', ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '55555555-5555-5555-5555-555555555555'::uuid,
  'authenticated', 'authenticated', 'task4-usera@example.com',
  crypt('test-password', gen_salt('bf')), now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Task4 User A'),
  now(), now(), '', '', '', ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '66666666-6666-6666-6666-666666666666'::uuid,
  'authenticated', 'authenticated', 'task4-userb@example.com',
  crypt('test-password', gen_salt('bf')), now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Task4 User B'),
  now(), now(), '', '', '', ''
);

update public.profiles set role = 'admin'
where id = '33333333-3333-3333-3333-333333333333'::uuid;

-- ensure a test listing exists for FK references
delete from public.listings where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid;
insert into public.listings (id, type, status, title, slug, city, price)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid,
  'rent', 'active', 'Task4 Test Ilan', 'task4-test-ilan', 'Istanbul', 30000
);

-- ============================================================
-- TEST 1: Tables exist with correct columns
-- ============================================================
do $$
declare
  v_table text;
begin
  for v_table in
    values ('reservations'), ('orders'), ('order_items'), ('payments'), ('payment_events')
  loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = v_table
    ) then
      raise exception 'Table public.% must exist', v_table;
    end if;
  end loop;
end;
$$;

-- ============================================================
-- TEST 2: order_item_type enum exists
-- ============================================================
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'order_item_type'
  ) then
    raise exception 'Enum public.order_item_type must exist';
  end if;
end;
$$;

-- ============================================================
-- TEST 3: CHECK constraint — stay_months must be 1..12
-- ============================================================
-- 3a: stay_months = 0 must fail
do $$
begin
  begin
    insert into public.reservations (
      id, listing_id, user_id, move_in_date, stay_months, guest_count, status
    )
    values (
      extensions.gen_random_uuid(),
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid,
      '55555555-5555-5555-5555-555555555555'::uuid,
      current_date + 30,
      0,  -- invalid
      1,
      'pending'
    );
    raise exception 'stay_months=0 unexpectedly succeeded';
  exception
    when check_violation then null;
  end;
end;
$$;

-- 3b: stay_months = 13 must fail
do $$
begin
  begin
    insert into public.reservations (
      id, listing_id, user_id, move_in_date, stay_months, guest_count, status
    )
    values (
      extensions.gen_random_uuid(),
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid,
      '55555555-5555-5555-5555-555555555555'::uuid,
      current_date + 30,
      13,  -- invalid
      1,
      'pending'
    );
    raise exception 'stay_months=13 unexpectedly succeeded';
  exception
    when check_violation then null;
  end;
end;
$$;

-- 3c: stay_months = 6 must succeed
do $$
declare
  v_id uuid := '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
begin
  delete from public.reservations where id = v_id;
  insert into public.reservations (
    id, listing_id, user_id, move_in_date, stay_months, guest_count, status
  )
  values (
    v_id,
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid,
    '55555555-5555-5555-5555-555555555555'::uuid,
    current_date + 30,
    6,
    2,
    'pending'
  );
end;
$$;

-- ============================================================
-- TEST 4: CHECK constraint — order total_amount >= 0
-- ============================================================
do $$
begin
  begin
    insert into public.orders (
      id, reservation_id, user_id, total_amount, status
    )
    values (
      extensions.gen_random_uuid(),
      '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
      '55555555-5555-5555-5555-555555555555'::uuid,
      -100,  -- invalid
      'pending'
    );
    raise exception 'Negative order total_amount unexpectedly succeeded';
  exception
    when check_violation then null;
  end;
end;
$$;

-- ============================================================
-- TEST 5: Insert valid order + order_items + payment chain
-- ============================================================
do $$
begin
  delete from public.payment_events where id = '66666666-ffff-ffff-ffff-ffffffffffff'::uuid;
  delete from public.payments where id = '55555555-eeee-eeee-eeee-eeeeeeeeeeee'::uuid;
  delete from public.order_items where id in (
    '33333333-cccc-cccc-cccc-cccccccccccc'::uuid,
    '44444444-dddd-dddd-dddd-dddddddddddd'::uuid
  );
  delete from public.orders where id = '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;

  insert into public.orders (id, reservation_id, user_id, total_amount, status)
  values (
    '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
    '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    '55555555-5555-5555-5555-555555555555'::uuid,
    32200,
    'pending'
  );

  -- main_item type
  insert into public.order_items (id, order_id, item_type, label, amount)
  values (
    '33333333-cccc-cccc-cccc-cccccccccccc'::uuid,
    '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
    'main_item',
    'Kapora',
    30000
  );

  -- service_item type
  insert into public.order_items (id, order_id, item_type, label, amount)
  values (
    '44444444-dddd-dddd-dddd-dddddddddddd'::uuid,
    '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
    'service_item',
    'Temizlik Hizmeti',
    2200
  );

  insert into public.payments (id, order_id, user_id, amount, currency, status)
  values (
    '55555555-eeee-eeee-eeee-eeeeeeeeeeee'::uuid,
    '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
    '55555555-5555-5555-5555-555555555555'::uuid,
    32200,
    'TRY',
    'pending'
  );

  insert into public.payment_events (id, payment_id, event_type, provider, payload)
  values (
    '66666666-ffff-ffff-ffff-ffffffffffff'::uuid,
    '55555555-eeee-eeee-eeee-eeeeeeeeeeee'::uuid,
    'callback_received',
    'isbank',
    '{"raw": "test"}'::jsonb
  );
end;
$$;

-- ============================================================
-- TEST 6: RLS — User A can read own reservation/order/payment
-- ============================================================
set role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
declare
  v_res_count integer;
  v_ord_count integer;
  v_pay_count integer;
begin
  select count(*) into v_res_count
  from public.reservations where id = '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;

  if v_res_count <> 1 then
    raise exception 'User A should see own reservation, got %', v_res_count;
  end if;

  select count(*) into v_ord_count
  from public.orders where id = '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;

  if v_ord_count <> 1 then
    raise exception 'User A should see own order, got %', v_ord_count;
  end if;

  select count(*) into v_pay_count
  from public.payments where id = '55555555-eeee-eeee-eeee-eeeeeeeeeeee'::uuid;

  if v_pay_count <> 1 then
    raise exception 'User A should see own payment, got %', v_pay_count;
  end if;
end;
$$;

reset role;

-- ============================================================
-- TEST 7: RLS — User B CANNOT see User A's data
-- ============================================================
set role authenticated;
select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
declare
  v_res_count integer;
  v_ord_count integer;
  v_pay_count integer;
begin
  select count(*) into v_res_count
  from public.reservations where id = '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;

  if v_res_count <> 0 then
    raise exception 'User B should NOT see User A reservation, got %', v_res_count;
  end if;

  select count(*) into v_ord_count
  from public.orders where id = '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;

  if v_ord_count <> 0 then
    raise exception 'User B should NOT see User A order, got %', v_ord_count;
  end if;

  select count(*) into v_pay_count
  from public.payments where id = '55555555-eeee-eeee-eeee-eeeeeeeeeeee'::uuid;

  if v_pay_count <> 0 then
    raise exception 'User B should NOT see User A payment, got %', v_pay_count;
  end if;
end;
$$;

reset role;

-- ============================================================
-- TEST 8: Admin can read all transactional data
-- ============================================================
set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
declare
  v_res_count integer;
  v_ord_count integer;
  v_pay_count integer;
  v_evt_count integer;
begin
  select count(*) into v_res_count
  from public.reservations where id = '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;

  if v_res_count <> 1 then
    raise exception 'Admin should see all reservations, got %', v_res_count;
  end if;

  select count(*) into v_ord_count
  from public.orders where id = '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;

  if v_ord_count <> 1 then
    raise exception 'Admin should see all orders, got %', v_ord_count;
  end if;

  select count(*) into v_pay_count
  from public.payments where id = '55555555-eeee-eeee-eeee-eeeeeeeeeeee'::uuid;

  if v_pay_count <> 1 then
    raise exception 'Admin should see all payments, got %', v_pay_count;
  end if;

  select count(*) into v_evt_count
  from public.payment_events where id = '66666666-ffff-ffff-ffff-ffffffffffff'::uuid;

  if v_evt_count <> 1 then
    raise exception 'Admin should see all payment_events, got %', v_evt_count;
  end if;
end;
$$;

reset role;

-- ============================================================
-- TEST 9: Anon user CANNOT see any transactional data
-- ============================================================
set role anon;

do $$
declare
  v_res_count integer;
  v_ord_count integer;
begin
  select count(*) into v_res_count from public.reservations;
  if v_res_count <> 0 then
    raise exception 'Anon should NOT see reservations, got %', v_res_count;
  end if;

  select count(*) into v_ord_count from public.orders;
  if v_ord_count <> 0 then
    raise exception 'Anon should NOT see orders, got %', v_ord_count;
  end if;
end;
$$;

reset role;

-- ============================================================
-- TEST 10: payment amount must be >= 0
-- ============================================================
do $$
begin
  begin
    insert into public.payments (id, order_id, user_id, amount, currency, status)
    values (
      extensions.gen_random_uuid(),
      '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
      '55555555-5555-5555-5555-555555555555'::uuid,
      -500,
      'TRY',
      'pending'
    );
    raise exception 'Negative payment amount unexpectedly succeeded';
  exception
    when check_violation then null;
  end;
end;
$$;

-- ============================================================
-- CLEANUP
-- ============================================================
delete from public.payment_events where id = '66666666-ffff-ffff-ffff-ffffffffffff'::uuid;
delete from public.payments where id = '55555555-eeee-eeee-eeee-eeeeeeeeeeee'::uuid;
delete from public.order_items where id in (
  '33333333-cccc-cccc-cccc-cccccccccccc'::uuid,
  '44444444-dddd-dddd-dddd-dddddddddddd'::uuid
);
delete from public.orders where id = '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;
delete from public.reservations where id = '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
delete from public.listings where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid;
delete from auth.users where id in (
  '33333333-3333-3333-3333-333333333333'::uuid,
  '55555555-5555-5555-5555-555555555555'::uuid,
  '66666666-6666-6666-6666-666666666666'::uuid
);

select 'phase1_task4_transactional_tables_ok' as result;
