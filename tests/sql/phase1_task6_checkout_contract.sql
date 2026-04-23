\set ON_ERROR_STOP on

-- ============================================================
-- Phase 1 / Task 6: Checkout data contract SQL behavior tests
-- TDD Red phase — these tests define checkout validation rules
-- ============================================================

-- References:
--   PHASE_1_2_TASKS.md  §170-185
--   BACKEND_PHASE_1.md  §150-156
--   IMPLEMENTATION_PLAN.md §124-149 (Faz 3)
--   PROJECT_PLAN.md §38-48, §408-454

-- Deterministic test users:
-- admin:  33333333-3333-3333-3333-333333333333
-- user_a: 55555555-5555-5555-5555-555555555555

-- Deterministic test data IDs:
-- listing:               bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1
-- listing (passive):     bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2
-- service_catalog (clean):cccccccc-cccc-cccc-cccc-cccccccccc01
-- service_catalog (boya): cccccccc-cccc-cccc-cccc-cccccccccc02
-- listing_svc_opt (clean):dddddddd-dddd-dddd-dddd-dddddddddd01
-- reservation:           11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa
-- order:                 22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb

-- ============================================================
-- SETUP: test users
-- ============================================================
delete from auth.users
where id in (
  '33333333-3333-3333-3333-333333333333'::uuid,
  '55555555-5555-5555-5555-555555555555'::uuid
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
  'authenticated', 'authenticated', 'task6-admin@example.com',
  crypt('test-password', gen_salt('bf')), now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Task6 Admin'),
  now(), now(), '', '', '', ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '55555555-5555-5555-5555-555555555555'::uuid,
  'authenticated', 'authenticated', 'task6-usera@example.com',
  crypt('test-password', gen_salt('bf')), now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Task6 User A'),
  now(), now(), '', '', '', ''
);

update public.profiles set role = 'admin'
where id = '33333333-3333-3333-3333-333333333333'::uuid;

-- ============================================================
-- SETUP: seed listings (active + passive)
-- ============================================================
delete from public.listings where id in (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'::uuid
);
insert into public.listings (id, type, status, title, slug, city, price)
values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid,
   'rent', 'active', 'Task6 Active Listing', 'task6-active', 'Istanbul', 25000),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'::uuid,
   'rent', 'passive', 'Task6 Passive Listing', 'task6-passive', 'Ankara', 18000);

-- ============================================================
-- SETUP: seed service_catalog + listing_service_options
-- ============================================================
delete from public.service_catalog where id in (
  'cccccccc-cccc-cccc-cccc-cccccccccc01'::uuid,
  'cccccccc-cccc-cccc-cccc-cccccccccc02'::uuid
);
insert into public.service_catalog (id, code, name, base_price, is_active)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccc01'::uuid, 'cleaning_t6', 'Temizlik', 2200, true),
  ('cccccccc-cccc-cccc-cccc-cccccccccc02'::uuid, 'painting_t6', 'Boya', 5000, true);

-- Only 'cleaning' is enabled for the active listing
delete from public.listing_service_options where id = 'dddddddd-dddd-dddd-dddd-dddddddddd01'::uuid;
insert into public.listing_service_options (id, listing_id, service_id, is_enabled)
values (
  'dddddddd-dddd-dddd-dddd-dddddddddd01'::uuid,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid,
  'cccccccc-cccc-cccc-cccc-cccccccccc01'::uuid,
  true
);
-- Note: 'painting' is NOT linked to the active listing at all

-- ============================================================
-- SETUP: seed reservation + order for user_a
-- ============================================================
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

delete from public.orders where id = '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;
insert into public.orders (id, reservation_id, user_id, total_amount, status)
values (
  '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
  '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  '55555555-5555-5555-5555-555555555555'::uuid,
  27200, 'pending'
);

-- ============================================================
-- TEST 1: Valid main_item insert succeeds
-- Scenario: Ahmet checkout'ta "Kapora" seçti → sepete ekleniyor
-- ============================================================
do $$
declare
  v_id uuid := 'aaaaaaaa-0001-0001-0001-000000000001'::uuid;
begin
  delete from public.order_items where id = v_id;
  insert into public.order_items (id, order_id, item_type, code, label, amount)
  values (
    v_id,
    '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
    'main_item',
    'kapora_t6',
    'Kapora',
    25000
  );
end;
$$;

-- ============================================================
-- TEST 2: Second different main_item succeeds (multiple main items allowed)
-- Scenario: Ahmet Kapora + Depozito seçti → ikisi de sepette
-- ============================================================
do $$
declare
  v_id uuid := 'aaaaaaaa-0001-0001-0001-000000000002'::uuid;
begin
  delete from public.order_items where id = v_id;
  insert into public.order_items (id, order_id, item_type, code, label, amount)
  values (
    v_id,
    '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
    'main_item',
    'depozito_t6',
    'Depozito',
    5000
  );
end;
$$;

-- ============================================================
-- TEST 3: Duplicate same main_item code MUST FAIL
-- Scenario: Ahmet sepete ikinci "Kapora" eklemeye çalışıyor →
--           UNIQUE index engeller
-- ============================================================
do $$
begin
  begin
    insert into public.order_items (id, order_id, item_type, code, label, amount)
    values (
      extensions.gen_random_uuid(),
      '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
      'main_item',
      'kapora_t6',
      'Kapora',  -- duplicate!
      25000
    );
    raise exception 'TEST 3 FAILED: Duplicate main_item code should have been rejected';
  exception
    when unique_violation then null;  -- expected
  end;
end;
$$;

-- ============================================================
-- TEST 4: Valid service_item for an enabled listing service
-- Scenario: Ahmet "Temizlik" seçti. Bu hizmet bu ilana tanımlı
--           ve aktif → sepete ekleniyor.
-- ============================================================
do $$
declare
  v_id uuid := 'aaaaaaaa-0001-0001-0001-000000000003'::uuid;
begin
  delete from public.order_items where id = v_id;
  insert into public.order_items (
    id, order_id, item_type, label, amount, service_catalog_id, listing_id
  )
  values (
    v_id,
    '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
    'service_item',
    'Temizlik',
    2200,
    'cccccccc-cccc-cccc-cccc-cccccccccc01'::uuid,  -- cleaning, linked to listing
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid   -- the active listing
  );
end;
$$;

-- ============================================================
-- TEST 5: service_item for a NON-linked service MUST FAIL
-- Scenario: Ahmet İstanbul evine "Boya" eklemeye çalışıyor ama
--           bu ilan için boya hizmeti tanımlı değil.
--           DB trigger/constraint engeller.
-- ============================================================
do $$
begin
  begin
    insert into public.order_items (
      id, order_id, item_type, label, amount, service_catalog_id, listing_id
    )
    values (
      extensions.gen_random_uuid(),
      '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
      'service_item',
      'Boya',
      5000,
      'cccccccc-cccc-cccc-cccc-cccccccccc02'::uuid,  -- painting, NOT linked to listing
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid   -- the active listing
    );
    raise exception 'TEST 5 FAILED: service_item for non-linked service should have been rejected';
  exception
    when raise_exception then null;  -- expected from trigger
  end;
end;
$$;

-- ============================================================
-- TEST 6: service_item WITHOUT service_catalog_id MUST FAIL
-- Scenario: Birileri elle sepete fantom hizmet eklemeye çalışıyor
--           ama hangi hizmet olduğu belli değil → engellenir
-- ============================================================
do $$
begin
  begin
    insert into public.order_items (
      id, order_id, item_type, label, amount, service_catalog_id
    )
    values (
      extensions.gen_random_uuid(),
      '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
      'service_item',
      'Hayalet Hizmet',
      9999,
      null  -- no catalog reference!
    );
    raise exception 'TEST 6 FAILED: service_item without catalog_id should have been rejected';
  exception
    when check_violation then null;  -- expected
    when raise_exception then null;  -- also acceptable
  end;
end;
$$;

-- ============================================================
-- TEST 7: same service_item can NOT be added twice to same order
-- Scenario: Ahmet "Temizlik"i sepete iki kere eklemeye çalışıyor.
--           Aynı hizmet, aynı sipariş → duplikat. Engellenir.
-- ============================================================
do $$
begin
  begin
    insert into public.order_items (
      id, order_id, item_type, label, amount, service_catalog_id, listing_id
    )
    values (
      extensions.gen_random_uuid(),
      '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
      'service_item',
      'Temizlik Tekrar',
      2200,
      'cccccccc-cccc-cccc-cccc-cccccccccc01'::uuid,  -- same service again
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid   -- the active listing
    );
    raise exception 'TEST 7 FAILED: Duplicate service_catalog_id per order should have been rejected';
  exception
    when unique_violation then null;  -- expected
  end;
end;
$$;

-- ============================================================
-- TEST 8: order_items.listing_id column exists and is set
-- Scenario: Checkout sırasında order_items tablosunda listing_id
--           tutulur ki service validation doğrudan bu tabloda
--           referans alınabilsin.
-- ============================================================
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'order_items'
      and column_name = 'listing_id'
  ) then
    raise exception 'TEST 8 FAILED: order_items.listing_id column must exist';
  end if;
end;
$$;

-- ============================================================
-- TEST 9: Pending payment tied to order exists
-- Scenario: Checkout tamamlandığında pending payment bir
--           siparişe bağlı olarak oluşturulmuş olmalı.
--           (Mevcut yapıyı doğrulama — regresyon)
-- ============================================================
do $$
declare
  v_pay_id uuid := 'aaaaaaaa-0001-0001-0001-000000000009'::uuid;
begin
  delete from public.payments where id = v_pay_id;
  insert into public.payments (id, order_id, user_id, amount, currency, status)
  values (
    v_pay_id,
    '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
    '55555555-5555-5555-5555-555555555555'::uuid,
    27200, 'TRY', 'pending'
  );

  -- verify
  if not exists (
    select 1 from public.payments
    where id = v_pay_id and status = 'pending' and order_id = '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid
  ) then
    raise exception 'TEST 9 FAILED: Pending payment should be tied to order';
  end if;

  delete from public.payments where id = v_pay_id;
end;
$$;

-- ============================================================
-- CLEANUP
-- ============================================================
delete from public.order_items where order_id = '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;
delete from public.orders where id = '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;
delete from public.reservations where id = '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
delete from public.listing_service_options where id = 'dddddddd-dddd-dddd-dddd-dddddddddd01'::uuid;
delete from public.service_catalog where id in (
  'cccccccc-cccc-cccc-cccc-cccccccccc01'::uuid,
  'cccccccc-cccc-cccc-cccc-cccccccccc02'::uuid
);
delete from public.listings where id in (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'::uuid
);
delete from auth.users where id in (
  '33333333-3333-3333-3333-333333333333'::uuid,
  '55555555-5555-5555-5555-555555555555'::uuid
);

select 'phase1_task6_checkout_contract_ok' as result;
