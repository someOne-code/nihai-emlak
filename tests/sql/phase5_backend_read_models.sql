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
where reservation_id::text like 'eeeeeeee-ffff-4fff-8fff-fffffffff%'
   or listing_id in (
    'cccccccc-dddd-4ddd-8ddd-ddddddddd101'::uuid,
    'cccccccc-dddd-4ddd-8ddd-ddddddddd102'::uuid
  );

delete from public.payment_events
where id = '55555555-6666-4666-8666-666666666101'::uuid
   or payment_id = '33333333-4444-4444-8444-444444444101'::uuid;

delete from public.payment_finance_ops
where reservation_id::text like 'eeeeeeee-ffff-4fff-8fff-fffffffff%';

delete from public.reservation_document_tracking
where reservation_id::text like 'eeeeeeee-ffff-4fff-8fff-fffffffff%';

delete from public.payments
where id = '33333333-4444-4444-8444-444444444101'::uuid;

delete from public.order_items
where order_id::text like '11111111-2222-4222-8222-222222222%';

delete from public.orders
where id::text like '11111111-2222-4222-8222-222222222%';

delete from public.reservations
where id::text like 'eeeeeeee-ffff-4fff-8fff-fffffffff%';

delete from public.listing_main_item_options
where listing_id in (
  'cccccccc-dddd-4ddd-8ddd-ddddddddd101'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd102'::uuid
);

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
  heating_type,
  fuel_type,
  balcony_count,
  has_elevator,
  parking_type,
  in_site,
  building_age,
  floor_count,
  floor_number,
  usage_status,
  facade,
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
  'central',
  'natural_gas',
  2,
  true,
  'open_closed',
  false,
  5,
  12,
  '3. Kat',
  'tenant_occupied',
  'Guney Bati',
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
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
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

insert into public.main_item_catalog (
  id, code, label, pricing_strategy, default_amount, is_active, sort_order
)
values (
  'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1'::uuid,
  'phase5_monthly_rent',
  'Phase 5 Monthly Rent',
  'fixed',
  42000,
  true,
  1
)
on conflict (id) do nothing;

-- Make Phase 5 Active Listing checkout-ready: attach an active main item
-- so the rent + active invariant is satisfied.
insert into public.listing_main_item_options (
  listing_id, main_item_id, is_enabled
)
values (
  'cccccccc-dddd-4ddd-8ddd-ddddddddd101'::uuid,
  'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1'::uuid,
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

insert into public.reservations (
  id,
  listing_id,
  user_id,
  move_in_date,
  stay_months,
  guest_count,
  note,
  status,
  created_at,
  updated_at
)
values
(
  'eeeeeeee-ffff-4fff-8fff-fffffffff102'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd101'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb102'::uuid,
  current_date + 11,
  6,
  2,
  'Phase 5 document waiting queue reservation',
  'cancelled',
  now() - interval '40 minutes',
  now() - interval '40 minutes'
),
(
  'eeeeeeee-ffff-4fff-8fff-fffffffff103'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd101'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb102'::uuid,
  current_date + 12,
  6,
  2,
  'Phase 5 refund request queue reservation',
  'cancelled',
  now() - interval '39 minutes',
  now() - interval '39 minutes'
),
(
  'eeeeeeee-ffff-4fff-8fff-fffffffff104'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd101'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb102'::uuid,
  current_date + 13,
  6,
  2,
  'Phase 5 manual refund queue reservation',
  'cancelled',
  now() - interval '38 minutes',
  now() - interval '38 minutes'
),
(
  'eeeeeeee-ffff-4fff-8fff-fffffffff105'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd101'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb102'::uuid,
  current_date + 14,
  6,
  2,
  'Phase 5 payment issue queue reservation',
  'cancelled',
  now() - interval '120 minutes',
  now() - interval '120 minutes'
),
(
  'eeeeeeee-ffff-4fff-8fff-fffffffff106'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd101'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb102'::uuid,
  current_date + 15,
  6,
  2,
  'Phase 5 completed queue reservation',
  'confirmed',
  now() - interval '37 minutes',
  now() - interval '37 minutes'
),
(
  'eeeeeeee-ffff-4fff-8fff-fffffffff107'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd102'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb102'::uuid,
  current_date + 16,
  6,
  2,
  'Phase 5 passive listing is not a queue blocker',
  'cancelled',
  now() - interval '36 minutes',
  now() - interval '36 minutes'
);

insert into public.reservations (
  id,
  listing_id,
  user_id,
  move_in_date,
  stay_months,
  guest_count,
  note,
  status,
  created_at,
  updated_at
)
select
  ('eeeeeeee-ffff-4fff-8fff-fffffffff2' || lpad(g::text, 2, '0'))::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd101'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb102'::uuid,
  current_date + 20 + g,
  6,
  2,
  'Phase 5 pagination filler reservation ' || g::text,
  'cancelled'::public.reservation_status,
  now() - make_interval(mins => g),
  now() - make_interval(mins => g)
from generate_series(1, 20) as g;

insert into public.reservation_intake (
  reservation_id,
  user_id,
  contact_full_name,
  contact_phone,
  contact_email,
  preferred_contact_method,
  preferred_contact_time,
  occupant_full_name,
  document_readiness,
  note
)
values (
  'eeeeeeee-ffff-4fff-8fff-fffffffff101'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb102'::uuid,
  'Phase5 Contact User',
  '+905551112233',
  'phase5-contact@example.com',
  'whatsapp',
  '18:00 sonrasi',
  null,
  'needs_help',
  'Evrak listesi icin arayin'
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

insert into public.orders (
  id,
  reservation_id,
  user_id,
  total_amount,
  currency,
  status
)
select
  ('11111111-2222-4222-8222-222222222' || lpad(suffix::text, 3, '0'))::uuid,
  ('eeeeeeee-ffff-4fff-8fff-fffffffff' || lpad(suffix::text, 3, '0'))::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb102'::uuid,
  42000,
  'TRY',
  'pending'::public.order_status
from unnest(array[102, 103, 104, 105, 106, 107]) as suffix;

update public.orders
set status = 'conflict'::public.order_status
where id = '11111111-2222-4222-8222-222222222105'::uuid;

insert into public.order_items (
  id,
  order_id,
  item_type,
  code,
  label,
  amount,
  listing_id
)
values (
  '22222222-3333-4333-8333-333333333101'::uuid,
  '11111111-2222-4222-8222-222222222101'::uuid,
  'main_item',
  'monthly_rent',
  'Bir Aylık Kira',
  42000,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd101'::uuid
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

insert into public.admin_workflow_events (
  id,
  workflow_name,
  admin_user_id,
  reservation_id,
  order_id,
  payment_id,
  listing_id,
  reason,
  note,
  payload,
  created_at
)
values
(
  '66666666-7777-4777-8777-777777777101'::uuid,
  'admin_request_documents',
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb101'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff101'::uuid,
  '11111111-2222-4222-8222-222222222101'::uuid,
  '33333333-4444-4444-8444-444444444101'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd101'::uuid,
  'document_request',
  'Belgeler istendi',
  jsonb_build_object('raw_callback_body', 'SECRET', 'token', 'SECRET'),
  now() - interval '2 hours'
),
(
  '66666666-7777-4777-8777-777777777102'::uuid,
  'admin_mark_documents_completed',
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb101'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff101'::uuid,
  '11111111-2222-4222-8222-222222222101'::uuid,
  '33333333-4444-4444-8444-444444444101'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd101'::uuid,
  null,
  'Belgeler tamamlandi',
  jsonb_build_object('provider_response', 'SECRET'),
  now() - interval '1 hour'
);

insert into public.reservation_document_tracking (
  reservation_id,
  order_id,
  status,
  admin_note,
  last_admin_user_id
)
values
(
  'eeeeeeee-ffff-4fff-8fff-fffffffff102'::uuid,
  '11111111-2222-4222-8222-222222222102'::uuid,
  'waiting',
  'documents are expected from customer',
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb101'::uuid
),
(
  'eeeeeeee-ffff-4fff-8fff-fffffffff106'::uuid,
  '11111111-2222-4222-8222-222222222106'::uuid,
  'completed',
  'documents completed',
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb101'::uuid
);

insert into public.payment_finance_ops (
  order_id,
  reservation_id,
  status,
  admin_note,
  last_admin_user_id,
  updated_at
)
values
(
  '11111111-2222-4222-8222-222222222103'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff103'::uuid,
  'refund_required',
  'refund request queue fixture',
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb101'::uuid,
  now() - interval '30 minutes'
),
(
  '11111111-2222-4222-8222-222222222104'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff104'::uuid,
  'refund_requested',
  'manual refund queue fixture',
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb101'::uuid,
  now() - interval '29 minutes'
),
(
  '11111111-2222-4222-8222-222222222105'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff105'::uuid,
  'manual_resolution_required',
  'payment issue queue fixture',
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb101'::uuid,
  now() - interval '120 minutes'
);

do $$
declare
  v_item_count integer;
  v_order_total numeric(12, 2);
  v_item_total numeric(12, 2);
begin
  select count(*), coalesce(sum(amount), 0)
  into v_item_count, v_item_total
  from public.order_items
  where order_id = '11111111-2222-4222-8222-222222222101'::uuid;

  select total_amount
  into v_order_total
  from public.orders
  where id = '11111111-2222-4222-8222-222222222101'::uuid;

  if v_item_count = 0 then
    raise exception 'TEST FAILED: phase5 order must include payment item rows';
  end if;

  if v_item_total <> v_order_total then
    raise exception 'TEST FAILED: phase5 order item total % should equal order total %', v_item_total, v_order_total;
  end if;
end;
$$;

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

  if (v_detail ->> 'heating_type') <> 'central'
     or (v_detail ->> 'fuel_type') <> 'natural_gas'
     or (v_detail ->> 'balcony_count')::integer <> 2
     or (v_detail ->> 'has_elevator')::boolean is not true
     or (v_detail ->> 'parking_type') <> 'open_closed'
     or (v_detail ->> 'in_site')::boolean is not false
     or (v_detail ->> 'building_age')::integer <> 5
     or (v_detail ->> 'floor_count')::integer <> 12
     or (v_detail ->> 'floor_number') <> '3. Kat'
     or (v_detail ->> 'usage_status') <> 'tenant_occupied'
     or (v_detail ->> 'facade') <> 'Guney Bati' then
    raise exception 'TEST FAILED: public detail housing fields mismatch: %', v_detail;
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

  begin
    perform public.list_admin_reservation_event_history('eeeeeeee-ffff-4fff-8fff-fffffffff101'::uuid);
    raise exception 'TEST FAILED: non-admin should not list reservation event history';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    perform public.list_admin_audit_events(null::text, null::uuid, null::uuid, null::text, null::timestamptz, null::timestamptz, 20, 0);
    raise exception 'TEST FAILED: non-admin should not list admin audit events';
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

  select count(*)
  into v_count
  from jsonb_array_elements(v_result -> 'items') item
  where item ->> 'id' = 'eeeeeeee-ffff-4fff-8fff-fffffffff101'
    and item #>> '{contact,fullName}' = 'Phase5 Contact User'
    and item #>> '{contact,phone}' = '+905551112233'
    and item #>> '{contact,email}' = 'phase5-contact@example.com'
    and item #>> '{contact,preferredContactMethod}' = 'whatsapp'
    and item #>> '{contact,preferredContactTime}' = '18:00 sonrasi'
    and item #>> '{contact,documentReadiness}' = 'needs_help'
    and item #>> '{contact,note}' = 'Evrak listesi icin arayin';

  if v_count <> 1 then
    raise exception 'TEST FAILED: admin reservation list should expose sanitized checkout intake contact, got %', v_result;
  end if;

  v_result := public.list_admin_reservations(null::public.reservation_status, 'payment_issues', 20, 0);

  if jsonb_typeof(v_result->'items') <> 'array' then
    raise exception 'TEST FAILED: queue-filtered admin reservations should return items array, got %', v_result;
  end if;

  select count(*)
  into v_count
  from jsonb_array_elements(public.list_admin_reservations(null::public.reservation_status, 'document_waiting', 20, 0)->'items') item
  where item->>'id' = 'eeeeeeee-ffff-4fff-8fff-fffffffff102'
    and item #>> '{document_tracking,status}' = 'waiting';

  if v_count <> 1 then
    raise exception 'TEST FAILED: document_waiting queue should include waiting document fixture';
  end if;

  select count(*)
  into v_count
  from jsonb_array_elements(public.list_admin_reservations(null::public.reservation_status, 'refund_requests', 20, 0)->'items') item
  where item->>'id' = 'eeeeeeee-ffff-4fff-8fff-fffffffff103'
    and item #>> '{finance_ops,status}' = 'refund_required';

  if v_count <> 1 then
    raise exception 'TEST FAILED: refund_requests queue should include refund_required fixture';
  end if;

  select count(*)
  into v_count
  from jsonb_array_elements(public.list_admin_reservations(null::public.reservation_status, 'manual_refunds', 20, 0)->'items') item
  where item->>'id' = 'eeeeeeee-ffff-4fff-8fff-fffffffff104'
    and item #>> '{finance_ops,status}' = 'refund_requested';

  if v_count <> 1 then
    raise exception 'TEST FAILED: manual_refunds queue should include refund_requested fixture';
  end if;

  select count(*)
  into v_count
  from jsonb_array_elements(public.list_admin_reservations(null::public.reservation_status, 'payment_issues', 1, 0)->'items') item
  where item->>'id' = 'eeeeeeee-ffff-4fff-8fff-fffffffff105'
    and item #>> '{finance_ops,status}' = 'manual_resolution_required';

  if v_count <> 1 then
    raise exception 'TEST FAILED: payment_issues queue pagination must apply after queue filtering';
  end if;

  select count(*)
  into v_count
  from jsonb_array_elements(public.list_admin_reservations(null::public.reservation_status, 'payment_waiting', 20, 0)->'items') item
  where item->>'id' = 'eeeeeeee-ffff-4fff-8fff-fffffffff101';

  if v_count <> 1 then
    raise exception 'TEST FAILED: payment_waiting queue should include pending order/payment fixture';
  end if;

  select count(*)
  into v_count
  from jsonb_array_elements(public.list_admin_reservations(null::public.reservation_status, 'payment_issues', 20, 0)->'items') item
  where item->>'id' = 'eeeeeeee-ffff-4fff-8fff-fffffffff101';

  if v_count <> 0 then
    raise exception 'TEST FAILED: payment_issues queue must not include payment waiting fixture';
  end if;

  select count(*)
  into v_count
  from jsonb_array_elements(public.list_admin_reservations(null::public.reservation_status, 'completed', 20, 0)->'items') item
  where item->>'id' = 'eeeeeeee-ffff-4fff-8fff-fffffffff106'
    and item #>> '{document_tracking,status}' = 'completed';

  if v_count <> 1 then
    raise exception 'TEST FAILED: completed queue should include completed document fixture';
  end if;

  select count(*)
  into v_count
  from jsonb_array_elements(public.list_admin_reservations(null::public.reservation_status, 'document_waiting', 20, 0)->'items') item
  where item->>'id' = 'eeeeeeee-ffff-4fff-8fff-fffffffff107';

  if v_count <> 0 then
    raise exception 'TEST FAILED: passive listing status alone must not enter document_waiting queue';
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

  v_result := public.list_admin_reservation_event_history(
    'eeeeeeee-ffff-4fff-8fff-fffffffff101'::uuid
  );

  if jsonb_typeof(v_result->'items') <> 'array' then
    raise exception 'TEST FAILED: admin reservation event history should return items array, got %', v_result;
  end if;

  select count(*)
  into v_count
  from jsonb_array_elements(v_result->'items') item
  where item->>'workflow_name' in ('admin_request_documents', 'admin_mark_documents_completed');

  if v_count <> 2 then
    raise exception 'TEST FAILED: admin reservation event history should include all workflow events, got %', v_result;
  end if;

  if (v_result->'items'->0->>'workflow_name') <> 'admin_request_documents'
     or (v_result->'items'->1->>'workflow_name') <> 'admin_mark_documents_completed' then
    raise exception 'TEST FAILED: admin reservation event history should be chronological, got %', v_result;
  end if;

  if v_result::text ~* 'payload|raw_callback_body|provider_response|token|SECRET' then
    raise exception 'TEST FAILED: admin reservation event history leaked raw/sensitive payload: %', v_result;
  end if;

  v_result := public.list_admin_audit_events(
    'reservation',
    'eeeeeeee-ffff-4fff-8fff-fffffffff101'::uuid,
    'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb101'::uuid,
    'admin_request_documents',
    now() - interval '1 day',
    now() + interval '1 day',
    10,
    0
  );

  if jsonb_typeof(v_result->'items') <> 'array'
     or (v_result->>'limit')::integer <> 10
     or (v_result->>'offset')::integer <> 0 then
    raise exception 'TEST FAILED: admin audit events should return paginated items shape, got %', v_result;
  end if;

  select count(*)
  into v_count
  from jsonb_array_elements(v_result->'items') item
  where item->>'source' = 'admin_workflow'
    and item->>'action' = 'admin_request_documents'
    and item->>'entity_type' = 'reservation'
    and item->>'entity_id' = 'eeeeeeee-ffff-4fff-8fff-fffffffff101'
    and item->>'actor_type' = 'admin'
    and item->>'actor_id' = 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb101'
    and item->>'summary' is not null;

  if v_count <> 1 then
    raise exception 'TEST FAILED: admin audit events should include sanitized workflow fixture, got %', v_result;
  end if;

  v_result := public.list_admin_audit_events('payment', '33333333-4444-4444-8444-444444444101'::uuid, null::uuid, null::text, null::timestamptz, null::timestamptz, 20, 0);

  select count(*)
  into v_count
  from jsonb_array_elements(v_result->'items') item
  where item->>'source' = 'payment_event'
    and item->>'entity_type' = 'payment'
    and item->>'entity_id' = '33333333-4444-4444-8444-444444444101'
    and item->>'summary' is not null;

  if v_count <> 1 then
    raise exception 'TEST FAILED: admin audit events should include sanitized payment event fixture, got %', v_result;
  end if;

  if v_result::text ~* 'payload|raw_callback_body|provider_response|token|SECRET' then
    raise exception 'TEST FAILED: admin audit events leaked raw/sensitive payload: %', v_result;
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

  begin
    perform public.list_admin_audit_events(null::text, null::uuid, null::uuid, null::text, null::timestamptz, null::timestamptz, 0, 0);
    raise exception 'TEST FAILED: admin audit event limit < 1 should be rejected';
  exception
    when sqlstate '22023' then
      null;
  end;

  begin
    perform public.list_admin_audit_events('not-valid', null::uuid, null::uuid, null::text, null::timestamptz, null::timestamptz, 20, 0);
    raise exception 'TEST FAILED: invalid admin audit entity type should be rejected';
  exception
    when sqlstate '22023' then
      null;
  end;
end $$;

reset role;

select 'phase5_backend_read_models_ok' as result;
