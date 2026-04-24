\set ON_ERROR_STOP on

-- Phase 5 / Task 1: backend read model contract tests.
-- This file intentionally goes red until the Phase 5 read-model RPCs are added.

-- deterministic users
-- admin:  aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb101
-- user:   aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb102

-- deterministic listings
-- active:  cccccccc-dddd-4ddd-8ddd-ddddddddd101
-- passive: cccccccc-dddd-4ddd-8ddd-ddddddddd102

-- deterministic services
-- active:   dddddddd-eeee-4eee-8eee-eeeeeeeee101
-- inactive: dddddddd-eeee-4eee-8eee-eeeeeeeee102
-- disabled: dddddddd-eeee-4eee-8eee-eeeeeeeee103

-- deterministic transactional chain
-- reservation:   eeeeeeee-ffff-4fff-8fff-fffffffff101
-- order:         11111111-2222-4222-8222-222222222101
-- payment:       33333333-4444-4444-8444-444444444101
-- payment event: 55555555-6666-4666-8666-666666666101

delete from public.admin_workflow_events
where reservation_id = 'eeeeeeee-ffff-4fff-8fff-fffffffff101'::uuid
   or listing_id in (
    'cccccccc-dddd-4ddd-8ddd-ddddddddd101'::uuid,
    'cccccccc-dddd-4ddd-8ddd-ddddddddd102'::uuid
  );

delete from public.payment_events
where id = '55555555-6666-4666-8666-666666666101'::uuid
   or payment_id = '33333333-4444-4444-8444-444444444101'::uuid;

delete from public.payments
where id = '33333333-4444-4444-8444-444444444101'::uuid;

delete from public.order_items
where order_id = '11111111-2222-4222-8222-222222222101'::uuid;

delete from public.orders
where id = '11111111-2222-4222-8222-222222222101'::uuid;

delete from public.reservations
where id = 'eeeeeeee-ffff-4fff-8fff-fffffffff101'::uuid;

delete from public.listing_service_options
where listing_id in (
  'cccccccc-dddd-4ddd-8ddd-ddddddddd101'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd102'::uuid
)
or service_id in (
  'dddddddd-eeee-4eee-8eee-eeeeeeeee101'::uuid,
  'dddddddd-eeee-4eee-8eee-eeeeeeeee102'::uuid,
  'dddddddd-eeee-4eee-8eee-eeeeeeeee103'::uuid
);

delete from public.service_catalog
where id in (
  'dddddddd-eeee-4eee-8eee-eeeeeeeee101'::uuid,
  'dddddddd-eeee-4eee-8eee-eeeeeeeee102'::uuid,
  'dddddddd-eeee-4eee-8eee-eeeeeeeee103'::uuid
);

delete from public.listing_images
where listing_id in (
  'cccccccc-dddd-4ddd-8ddd-ddddddddd101'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd102'::uuid
);

delete from public.listings
where id in (
  'cccccccc-dddd-4ddd-8ddd-ddddddddd101'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd102'::uuid
);

delete from auth.users
where id in (
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb101'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb102'::uuid
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
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb101'::uuid,
  'authenticated',
  'authenticated',
  'phase5-admin@example.com',
  crypt('test-password', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Phase5 Admin'),
  now(),
  now(),
  '',
  '',
  '',
  ''
),
(
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb102'::uuid,
  'authenticated',
  'authenticated',
  'phase5-user@example.com',
  crypt('test-password', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Phase5 User'),
  now(),
  now(),
  '',
  '',
  '',
  ''
);

update public.profiles
set role = 'admin'
where id = 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb101'::uuid;

insert into public.listings (
  id,
  type,
  status,
  title,
  slug,
  summary,
  description,
  city,
  district,
  price,
  currency,
  room_count,
  bathroom_count,
  gross_area_m2,
  is_furnished
)
values
(
  'cccccccc-dddd-4ddd-8ddd-ddddddddd101'::uuid,
  'rent',
  'active',
  'Phase 5 Active Listing',
  'phase-5-active-listing',
  'Active listing for Phase 5 read model tests',
  'Detailed active listing description',
  'Istanbul',
  'Kadikoy',
  42000,
  'TRY',
  2,
  1,
  95,
  true
),
(
  'cccccccc-dddd-4ddd-8ddd-ddddddddd102'::uuid,
  'rent',
  'passive',
  'Phase 5 Passive Listing',
  'phase-5-passive-listing',
  'Passive listing for Phase 5 read model tests',
  'Detailed passive listing description',
  'Istanbul',
  'Besiktas',
  39000,
  'TRY',
  1,
  1,
  70,
  false
);

insert into public.listing_images (listing_id, image_url, alt_text, sort_order, is_primary)
values
(
  'cccccccc-dddd-4ddd-8ddd-ddddddddd101'::uuid,
  'https://example.com/phase5-active.jpg',
  'Phase 5 active listing',
  0,
  true
),
(
  'cccccccc-dddd-4ddd-8ddd-ddddddddd102'::uuid,
  'https://example.com/phase5-passive.jpg',
  'Phase 5 passive listing',
  0,
  true
);

insert into public.service_catalog (id, code, name, description, base_price, is_active)
values
(
  'dddddddd-eeee-4eee-8eee-eeeeeeeee101'::uuid,
  'phase5_cleaning',
  'Phase 5 Cleaning',
  'Active service for public listing service read model',
  1500,
  true
),
(
  'dddddddd-eeee-4eee-8eee-eeeeeeeee102'::uuid,
  'phase5_inactive',
  'Phase 5 Inactive',
  'Inactive service hidden from public listing service read model',
  900,
  false
),
(
  'dddddddd-eeee-4eee-8eee-eeeeeeeee103'::uuid,
  'phase5_disabled',
  'Phase 5 Disabled',
  'Disabled listing service option hidden from public listing service read model',
  700,
  true
);

insert into public.listing_service_options (listing_id, service_id, override_price, is_enabled)
values
(
  'cccccccc-dddd-4ddd-8ddd-ddddddddd101'::uuid,
  'dddddddd-eeee-4eee-8eee-eeeeeeeee101'::uuid,
  1600,
  true
),
(
  'cccccccc-dddd-4ddd-8ddd-ddddddddd101'::uuid,
  'dddddddd-eeee-4eee-8eee-eeeeeeeee102'::uuid,
  1000,
  true
),
(
  'cccccccc-dddd-4ddd-8ddd-ddddddddd101'::uuid,
  'dddddddd-eeee-4eee-8eee-eeeeeeeee103'::uuid,
  800,
  false
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
values (
  'eeeeeeee-ffff-4fff-8fff-fffffffff101'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd101'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb102'::uuid,
  current_date + 10,
  6,
  2,
  'Phase 5 read model reservation',
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
values (
  '11111111-2222-4222-8222-222222222101'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff101'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb102'::uuid,
  42000,
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
values (
  '33333333-4444-4444-8444-444444444101'::uuid,
  '11111111-2222-4222-8222-222222222101'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb102'::uuid,
  42000,
  'TRY',
  'pending',
  'isbank',
  '33333333-4444-4444-8444-444444444101'
);

insert into public.payment_events (
  id,
  payment_id,
  event_type,
  provider,
  payload
)
values (
  '55555555-6666-4666-8666-666666666101'::uuid,
  '33333333-4444-4444-8444-444444444101'::uuid,
  'phase5_fixture_event',
  'isbank',
  jsonb_build_object('source', 'phase5_backend_read_models')
);

reset role;
set role anon;

do $$
declare
  v_list jsonb;
  v_detail jsonb;
  v_services jsonb;
  v_count integer;
begin
  v_list := public.list_public_listings(null::public.listing_type, null::text, 20, 0);

  if not (v_list ? 'items') or not (v_list ? 'limit') or not (v_list ? 'offset') then
    raise exception 'TEST FAILED: public listing list shape invalid: %', v_list;
  end if;

  select count(*)
  into v_count
  from jsonb_array_elements(v_list -> 'items') item
  where item ->> 'id' = 'cccccccc-dddd-4ddd-8ddd-ddddddddd101';

  if v_count <> 1 then
    raise exception 'TEST FAILED: active listing should appear once in public listing list, got %', v_count;
  end if;

  select count(*)
  into v_count
  from jsonb_array_elements(v_list -> 'items') item
  where item ->> 'id' = 'cccccccc-dddd-4ddd-8ddd-ddddddddd102';

  if v_count <> 0 then
    raise exception 'TEST FAILED: passive listing should be hidden from public listing list, got %', v_count;
  end if;

  v_detail := public.get_public_listing_detail('cccccccc-dddd-4ddd-8ddd-ddddddddd101'::uuid);

  if v_detail ->> 'id' <> 'cccccccc-dddd-4ddd-8ddd-ddddddddd101' then
    raise exception 'TEST FAILED: public listing detail returned wrong listing: %', v_detail;
  end if;

  if v_detail ? 'address_line' then
    raise exception 'TEST FAILED: public listing detail should not expose exact address_line: %', v_detail;
  end if;

  begin
    perform public.get_public_listing_detail('cccccccc-dddd-4ddd-8ddd-ddddddddd102'::uuid);
    raise exception 'TEST FAILED: passive listing detail should be hidden';
  exception
    when sqlstate 'P0002' then
      null;
  end;

  v_services := public.list_public_listing_services('cccccccc-dddd-4ddd-8ddd-ddddddddd101'::uuid);

  if not (v_services ? 'items') then
    raise exception 'TEST FAILED: public listing services shape invalid: %', v_services;
  end if;

  select count(*)
  into v_count
  from jsonb_array_elements(v_services -> 'items') item
  where item ->> 'code' = 'phase5_cleaning';

  if v_count <> 1 then
    raise exception 'TEST FAILED: enabled active service should appear once, got %', v_count;
  end if;

  select count(*)
  into v_count
  from jsonb_array_elements(v_services -> 'items') item
  where item ->> 'code' in ('phase5_inactive', 'phase5_disabled');

  if v_count <> 0 then
    raise exception 'TEST FAILED: inactive or disabled services should be hidden, got %', v_count;
  end if;
end $$;

reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb102', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
begin
  begin
    perform public.list_admin_reservations(null::public.reservation_status, 20, 0);
    raise exception 'TEST FAILED: non-admin should not list admin reservations';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    perform public.list_admin_orders(null::public.order_status, 20, 0);
    raise exception 'TEST FAILED: non-admin should not list admin orders';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    perform public.list_admin_payments(null::public.payment_status, 20, 0);
    raise exception 'TEST FAILED: non-admin should not list admin payments';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    perform public.list_admin_payment_events(null::uuid, 20, 0);
    raise exception 'TEST FAILED: non-admin should not list admin payment events';
  exception
    when insufficient_privilege then
      null;
  end;
end $$;

reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb101', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
declare
  v_result jsonb;
  v_count integer;
begin
  v_result := public.list_admin_reservations(null::public.reservation_status, 20, 0);

  if not (v_result ? 'items') or (v_result ->> 'limit')::integer <> 20 or (v_result ->> 'offset')::integer <> 0 then
    raise exception 'TEST FAILED: admin reservation list shape invalid: %', v_result;
  end if;

  select count(*)
  into v_count
  from jsonb_array_elements(v_result -> 'items') item
  where item ->> 'id' = 'eeeeeeee-ffff-4fff-8fff-fffffffff101';

  if v_count <> 1 then
    raise exception 'TEST FAILED: admin reservation list should include fixture reservation, got %', v_count;
  end if;

  v_result := public.list_admin_orders(null::public.order_status, 20, 0);

  if not (v_result ? 'items') or (v_result ->> 'limit')::integer <> 20 or (v_result ->> 'offset')::integer <> 0 then
    raise exception 'TEST FAILED: admin order list shape invalid: %', v_result;
  end if;

  select count(*)
  into v_count
  from jsonb_array_elements(v_result -> 'items') item
  where item ->> 'id' = '11111111-2222-4222-8222-222222222101';

  if v_count <> 1 then
    raise exception 'TEST FAILED: admin order list should include fixture order, got %', v_count;
  end if;

  v_result := public.list_admin_payments(null::public.payment_status, 20, 0);

  if not (v_result ? 'items') or (v_result ->> 'limit')::integer <> 20 or (v_result ->> 'offset')::integer <> 0 then
    raise exception 'TEST FAILED: admin payment list shape invalid: %', v_result;
  end if;

  select count(*)
  into v_count
  from jsonb_array_elements(v_result -> 'items') item
  where item ->> 'id' = '33333333-4444-4444-8444-444444444101';

  if v_count <> 1 then
    raise exception 'TEST FAILED: admin payment list should include fixture payment, got %', v_count;
  end if;

  v_result := public.list_admin_payment_events(null::uuid, 20, 0);

  if not (v_result ? 'items') or (v_result ->> 'limit')::integer <> 20 or (v_result ->> 'offset')::integer <> 0 then
    raise exception 'TEST FAILED: admin payment event list shape invalid: %', v_result;
  end if;

  select count(*)
  into v_count
  from jsonb_array_elements(v_result -> 'items') item
  where item ->> 'id' = '55555555-6666-4666-8666-666666666101';

  if v_count <> 1 then
    raise exception 'TEST FAILED: admin payment event list should include fixture event, got %', v_count;
  end if;

  select count(*)
  into v_count
  from jsonb_array_elements(v_result -> 'items') item
  where item ? 'payload';

  if v_count <> 0 then
    raise exception 'TEST FAILED: admin payment event list should not expose raw payload, got %', v_count;
  end if;

  v_result := public.list_admin_payment_events('33333333-4444-4444-8444-444444444101'::uuid, 20, 0);

  select count(*)
  into v_count
  from jsonb_array_elements(v_result -> 'items') item
  where item ->> 'id' = '55555555-6666-4666-8666-666666666101';

  if v_count <> 1 then
    raise exception 'TEST FAILED: admin payment event list should filter by payment id, got %', v_count;
  end if;
end $$;

do $$
begin
  begin
    perform public.list_public_listings(null::public.listing_type, null::text, null::integer, 0);
    raise exception 'TEST FAILED: null limit should be rejected';
  exception
    when sqlstate '22023' then
      null;
  end;

  begin
    perform public.list_public_listings(null::public.listing_type, null::text, 20, null::integer);
    raise exception 'TEST FAILED: null offset should be rejected';
  exception
    when sqlstate '22023' then
      null;
  end;

  begin
    perform public.list_public_listings(null::public.listing_type, null::text, 0, 0);
    raise exception 'TEST FAILED: limit < 1 should be rejected';
  exception
    when sqlstate '22023' then
      null;
  end;

  begin
    perform public.list_public_listings(null::public.listing_type, null::text, 101, 0);
    raise exception 'TEST FAILED: limit > 100 should be rejected';
  exception
    when sqlstate '22023' then
      null;
  end;

  begin
    perform public.list_public_listings(null::public.listing_type, null::text, 20, -1);
    raise exception 'TEST FAILED: offset < 0 should be rejected';
  exception
    when sqlstate '22023' then
      null;
  end;

  begin
    perform public.list_admin_reservations(null::public.reservation_status, null::integer, 0);
    raise exception 'TEST FAILED: admin reservation null limit should be rejected';
  exception
    when sqlstate '22023' then
      null;
  end;

  begin
    perform public.list_admin_reservations(null::public.reservation_status, 0, 0);
    raise exception 'TEST FAILED: admin reservation limit < 1 should be rejected';
  exception
    when sqlstate '22023' then
      null;
  end;

  begin
    perform public.list_admin_orders(null::public.order_status, 20, null::integer);
    raise exception 'TEST FAILED: admin order null offset should be rejected';
  exception
    when sqlstate '22023' then
      null;
  end;

  begin
    perform public.list_admin_orders(null::public.order_status, 101, 0);
    raise exception 'TEST FAILED: admin order limit > 100 should be rejected';
  exception
    when sqlstate '22023' then
      null;
  end;

  begin
    perform public.list_admin_payments(null::public.payment_status, null::integer, 0);
    raise exception 'TEST FAILED: admin payment null limit should be rejected';
  exception
    when sqlstate '22023' then
      null;
  end;

  begin
    perform public.list_admin_payments(null::public.payment_status, 20, -1);
    raise exception 'TEST FAILED: admin payment offset < 0 should be rejected';
  exception
    when sqlstate '22023' then
      null;
  end;

  begin
    perform public.list_admin_payment_events(null::uuid, 20, null::integer);
    raise exception 'TEST FAILED: admin payment event null offset should be rejected';
  exception
    when sqlstate '22023' then
      null;
  end;

  begin
    perform public.list_admin_payment_events(null::uuid, 0, 0);
    raise exception 'TEST FAILED: admin payment event limit < 1 should be rejected';
  exception
    when sqlstate '22023' then
      null;
  end;
end $$;

reset role;

select 'phase5_backend_read_models_ok' as result;
