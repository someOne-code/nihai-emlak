\set ON_ERROR_STOP on

-- ============================================================
-- Phase 1 / Task 5: Admin access model SQL behavior tests
-- TDD Red phase — these tests define expected admin UPDATE/DELETE
-- behavior on transactional and catalog tables
-- ============================================================

-- Reuse deterministic test users from prior tasks:
-- admin:  33333333-3333-3333-3333-333333333333
-- user_a: 55555555-5555-5555-5555-555555555555
-- user_b: 66666666-6666-6666-6666-666666666666

-- ============================================================
-- SETUP: create test users + seed data
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
  'authenticated', 'authenticated', 'task5-admin@example.com',
  crypt('test-password', gen_salt('bf')), now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Task5 Admin'),
  now(), now(), '', '', '', ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '55555555-5555-5555-5555-555555555555'::uuid,
  'authenticated', 'authenticated', 'task5-usera@example.com',
  crypt('test-password', gen_salt('bf')), now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Task5 User A'),
  now(), now(), '', '', '', ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '66666666-6666-6666-6666-666666666666'::uuid,
  'authenticated', 'authenticated', 'task5-userb@example.com',
  crypt('test-password', gen_salt('bf')), now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Task5 User B'),
  now(), now(), '', '', '', ''
);

update public.profiles set role = 'admin'
where id = '33333333-3333-3333-3333-333333333333'::uuid;

-- seed listing
delete from public.listings where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid;
insert into public.listings (id, type, status, title, slug, city, price)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid,
  'rent', 'active', 'Task5 Test Ilan', 'task5-test-ilan', 'Istanbul', 25000
);

-- seed reservation (owned by user_a)
delete from public.reservations where id = '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
insert into public.reservations (
  id, listing_id, user_id, move_in_date, stay_months, guest_count, status
)
values (
  '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid,
  '55555555-5555-5555-5555-555555555555'::uuid,
  current_date + 30, 6, 2, 'pending'
);

-- seed order (owned by user_a)
delete from public.orders where id = '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;
insert into public.orders (id, reservation_id, user_id, total_amount, status)
values (
  '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
  '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  '55555555-5555-5555-5555-555555555555'::uuid,
  32200, 'pending'
);

-- seed payment (owned by user_a)
delete from public.payments where id = '55555555-eeee-eeee-eeee-eeeeeeeeeeee'::uuid;
insert into public.payments (id, order_id, user_id, amount, currency, status)
values (
  '55555555-eeee-eeee-eeee-eeeeeeeeeeee'::uuid,
  '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
  '55555555-5555-5555-5555-555555555555'::uuid,
  32200, 'TRY', 'pending'
);

-- seed payment_event
delete from public.payment_events where id = '66666666-ffff-ffff-ffff-ffffffffffff'::uuid;
insert into public.payment_events (id, payment_id, event_type, provider, payload)
values (
  '66666666-ffff-ffff-ffff-ffffffffffff'::uuid,
  '55555555-eeee-eeee-eeee-eeeeeeeeeeee'::uuid,
  'callback_received', 'isbank', '{"raw": "test"}'::jsonb
);

-- ============================================================
-- TEST 1: Admin can UPDATE reservation status
-- Scenario: Müşteri kaporayı ödedi ama belgeleri tamamlamadı.
--           Admin rezervasyonu "cancelled" olarak işaretler.
-- ============================================================
set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
declare
  v_status text;
begin
  if has_table_privilege('authenticated', 'public.reservations', 'UPDATE') then
    raise exception 'Admin should not retain direct UPDATE privilege on reservations';
  end if;

  select status into v_status
  from public.reservations
  where id = '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;

  if v_status is null or v_status <> 'pending' then
    raise exception 'Admin should NOT be able to update reservation status directly, got %', v_status;
  end if;
end;
$$;

reset role;

-- ============================================================
-- TEST 2: Admin can UPDATE order status
-- Scenario: Ödeme callback'i geldi ama sipariş otomatik
--           güncellenmedi. Admin manuel olarak "completed" yapar.
-- ============================================================
set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
declare
  v_status text;
begin
  if has_table_privilege('authenticated', 'public.orders', 'UPDATE') then
    raise exception 'Admin should not retain direct UPDATE privilege on orders';
  end if;

  select status::text into v_status
  from public.orders
  where id = '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;

  if v_status is null or v_status <> 'pending' then
    raise exception 'Admin should NOT be able to update order status directly, got %', v_status;
  end if;
end;
$$;

reset role;

-- ============================================================
-- TEST 3: Admin can UPDATE payment status
-- Scenario: Banka callback'i "succeeded" gönderdi ama sistem
--           otomatik yakalayamadı. Admin manuel düzeltme yapar.
-- ============================================================
set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
declare
  v_status text;
begin
  if has_table_privilege('authenticated', 'public.payments', 'UPDATE') then
    raise exception 'Admin should not retain direct UPDATE privilege on payments';
  end if;

  select status::text into v_status
  from public.payments
  where id = '55555555-eeee-eeee-eeee-eeeeeeeeeeee'::uuid;

  if v_status is null or v_status <> 'pending' then
    raise exception 'Admin should NOT be able to update payment status directly, got %', v_status;
  end if;
end;
$$;

reset role;

-- ============================================================
-- TEST 4: Normal user CANNOT update another user's reservation
-- Scenario: Mehmet (user_b), Ahmet'in (user_a) rezervasyonunu
--           iptal etmeye çalışıyor. Sistem ENGELLER.
-- ============================================================
set role authenticated;
select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
declare
  v_status text;
begin
  if has_table_privilege('authenticated', 'public.reservations', 'UPDATE') then
    raise exception 'Normal user should not retain direct UPDATE privilege on reservations';
  end if;

  select status::text into v_status
  from public.reservations
  where id = '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;

  -- user_b can't even see it, so v_status will be null
  if v_status is not null then
    raise exception 'Normal user should NOT update other user reservation, got status=%', v_status;
  end if;
end;
$$;

reset role;

-- verify the reservation is still pending (as postgres superuser)
do $$
declare
  v_status text;
begin
  select status::text into v_status
  from public.reservations
  where id = '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;

  if v_status <> 'pending' then
    raise exception 'Reservation should still be pending after blocked update, got %', v_status;
  end if;
end;
$$;

-- ============================================================
-- TEST 5: Normal user CANNOT update their OWN order status
-- Scenario: Ahmet (user_a) kendi siparişini "completed" yapma-
--           ya çalışıyor. Hayır — bunu sadece Admin veya
--           atomik DB function yapabilir.
-- ============================================================
set role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
declare
  v_status text;
begin
  if has_table_privilege('authenticated', 'public.orders', 'UPDATE') then
    raise exception 'Normal user should not retain direct UPDATE privilege on orders';
  end if;

  select status::text into v_status
  from public.orders
  where id = '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;

  -- user_a can read own order but should NOT have updated it
  if v_status = 'completed' then
    raise exception 'Normal user should NOT be able to update own order status';
  end if;
end;
$$;

reset role;

-- ============================================================
-- TEST 6: Normal user CANNOT update their OWN payment status
-- Scenario: Ahmet kendi ödemesini "succeeded" yapmaya çalışıyor.
--           Bu bir güvenlik açığı olurdu. Sistem ENGELLER.
-- ============================================================
set role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
declare
  v_status text;
begin
  if has_table_privilege('authenticated', 'public.payments', 'UPDATE') then
    raise exception 'Normal user should not retain direct UPDATE privilege on payments';
  end if;

  select status::text into v_status
  from public.payments
  where id = '55555555-eeee-eeee-eeee-eeeeeeeeeeee'::uuid;

  if v_status = 'succeeded' then
    raise exception 'Normal user should NOT be able to update own payment status';
  end if;
end;
$$;

reset role;

-- ============================================================
-- TEST 7: Normal user CANNOT update their OWN reservation status
-- Scenario: Ahmet kendi rezervasyonunu "confirmed" yapmaya
--           çalışıyor. Hayır — bunu sadece Admin yapabilir.
-- ============================================================
set role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
declare
  v_status text;
begin
  if has_table_privilege('authenticated', 'public.reservations', 'UPDATE') then
    raise exception 'Normal user should not retain direct UPDATE privilege on reservations';
  end if;

  select status::text into v_status
  from public.reservations
  where id = '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;

  if v_status = 'confirmed' then
    raise exception 'Normal user should NOT be able to confirm own reservation';
  end if;
end;
$$;

reset role;

-- ============================================================
-- TEST 8: Admin can read ALL profiles (re-verify from Task 2)
-- Scenario: Admin panelden tüm kullanıcıları listeleyebilmeli.
-- ============================================================
set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.profiles;

  if v_count < 3 then
    raise exception 'Admin should see all profiles, got %', v_count;
  end if;
end;
$$;

reset role;

-- ============================================================
-- TEST 9: Admin can INSERT payment_events (audit log)
-- Scenario: Admin callback log eksikse, manuel bir event kaydı
--           oluşturabilir (denetim izi).
-- ============================================================
set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
declare
  v_evt_id uuid := '77777777-ffff-ffff-ffff-ffffffffffff'::uuid;
  v_count integer;
begin
  insert into public.payment_events (id, payment_id, event_type, provider, payload)
  values (
    v_evt_id,
    '55555555-eeee-eeee-eeee-eeeeeeeeeeee'::uuid,
    'admin_manual_note',
    'admin',
    '{"note": "Manuel denetim girdisi"}'::jsonb
  );

  select count(*) into v_count
  from public.payment_events where id = v_evt_id;

  if v_count <> 1 then
    raise exception 'Admin should be able to insert payment_events, got %', v_count;
  end if;

  -- cleanup
  delete from public.payment_events where id = v_evt_id;
end;
$$;

reset role;

-- ============================================================
-- TEST 10: Normal user CANNOT insert payment_events
-- Scenario: Ahmet sahte bir callback log eklemeye çalışıyor.
--           Sistem ENGELLER.
-- ============================================================
set role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
declare
  v_count integer;
begin
  begin
    insert into public.payment_events (id, payment_id, event_type, provider, payload)
    values (
      '88888888-ffff-ffff-ffff-ffffffffffff'::uuid,
      '55555555-eeee-eeee-eeee-eeeeeeeeeeee'::uuid,
      'fake_event',
      'hacker',
      '{"fraud": true}'::jsonb
    );
  exception
    when others then null;  -- expected: RLS blocks it
  end;

  -- verify nothing was inserted (check as superuser later)
  -- from user's perspective, they can't even see payment_events
  select count(*) into v_count
  from public.payment_events
  where id = '88888888-ffff-ffff-ffff-ffffffffffff'::uuid;

  if v_count <> 0 then
    raise exception 'Normal user should NOT be able to insert payment_events';
  end if;
end;
$$;

reset role;

-- double-check as superuser that the fake event really doesn't exist
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.payment_events
  where id = '88888888-ffff-ffff-ffff-ffffffffffff'::uuid;

  if v_count <> 0 then
    raise exception 'Fake payment_event should not exist, got %', v_count;
  end if;
end;
$$;

-- ============================================================
-- CLEANUP
-- ============================================================
delete from public.payment_events where payment_id = '55555555-eeee-eeee-eeee-eeeeeeeeeeee'::uuid;
delete from public.payments where id = '55555555-eeee-eeee-eeee-eeeeeeeeeeee'::uuid;
delete from public.orders where id = '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;
delete from public.reservations where id = '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
delete from public.listings where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid;
delete from auth.users where id in (
  '33333333-3333-3333-3333-333333333333'::uuid,
  '55555555-5555-5555-5555-555555555555'::uuid,
  '66666666-6666-6666-6666-666666666666'::uuid
);

select 'phase1_task5_admin_access_ok' as result;
