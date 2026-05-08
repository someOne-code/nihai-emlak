\set ON_ERROR_STOP on

create extension if not exists dblink;

-- Phase 3 / Task 4: create_checkout must atomically create reservation/order/items/payment.

-- deterministic users
-- admin:  66666666-7777-4777-8777-777777777761
-- user:   66666666-7777-4777-8777-777777777762

-- deterministic listings
-- valid listing:    77777777-7777-4777-8777-777777777761
-- rollback listing: 77777777-7777-4777-8777-777777777762

-- deterministic main item ids
-- deposit:          88888888-7777-4777-8777-777777777761
-- first rent:       88888888-7777-4777-8777-777777777762
-- dup label one:    88888888-7777-4777-8777-777777777763
-- dup label two:    88888888-7777-4777-8777-777777777764

-- deterministic service ids
-- cleaning:         99999999-7777-4777-8777-777777777761

delete from auth.users
where id in (
  '66666666-7777-4777-8777-777777777761'::uuid,
  '66666666-7777-4777-8777-777777777762'::uuid
);

delete from public.listing_service_options
where id in (
  'aaaaaaaa-7777-4777-8777-777777777761'::uuid,
  'aaaaaaaa-7777-4777-8777-777777777762'::uuid
);

delete from public.service_catalog
where id = '99999999-7777-4777-8777-777777777761'::uuid;

delete from public.listing_main_item_options
where id in (
  'bbbbbbbb-7777-4777-8777-777777777761'::uuid,
  'bbbbbbbb-7777-4777-8777-777777777762'::uuid,
  'bbbbbbbb-7777-4777-8777-777777777763'::uuid,
  'bbbbbbbb-7777-4777-8777-777777777764'::uuid
);

delete from public.main_item_catalog
where id in (
  '88888888-7777-4777-8777-777777777761'::uuid,
  '88888888-7777-4777-8777-777777777762'::uuid,
  '88888888-7777-4777-8777-777777777763'::uuid,
  '88888888-7777-4777-8777-777777777764'::uuid
);

delete from public.listings
where id in (
  '77777777-7777-4777-8777-777777777761'::uuid,
  '77777777-7777-4777-8777-777777777762'::uuid
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
  '66666666-7777-4777-8777-777777777761'::uuid,
  'authenticated',
  'authenticated',
  'phase3-create-admin@example.com',
  crypt('test-password', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Phase3 Create Admin'),
  now(),
  now(),
  '',
  '',
  '',
  ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '66666666-7777-4777-8777-777777777762'::uuid,
  'authenticated',
  'authenticated',
  'phase3-create-user@example.com',
  crypt('test-password', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Phase3 Create User'),
  now(),
  now(),
  '',
  '',
  '',
  ''
);

update public.profiles
set role = 'admin'
where id = '66666666-7777-4777-8777-777777777761'::uuid;

set role authenticated;
select set_config('request.jwt.claim.sub', '66666666-7777-4777-8777-777777777761', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

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
  '77777777-7777-4777-8777-777777777761'::uuid,
  'rent',
  'active',
  'Phase3 Create Listing',
  'phase3-create-listing',
  'Istanbul',
  42000,
  'TRY'
),
(
  '77777777-7777-4777-8777-777777777762'::uuid,
  'rent',
  'active',
  'Phase3 Rollback Listing',
  'phase3-rollback-listing',
  'Istanbul',
  30000,
  'TRY'
);

insert into public.main_item_catalog (
  id,
  code,
  label,
  pricing_strategy,
  default_amount,
  default_multiplier,
  is_active,
  sort_order
)
values
(
  '88888888-7777-4777-8777-777777777761'::uuid,
  'deposit_t4',
  'Kapora',
  'fixed',
  15000,
  null,
  true,
  1
),
(
  '88888888-7777-4777-8777-777777777762'::uuid,
  'first_rent_t4',
  'Bir Aylik Kira',
  'listing_price_multiplier',
  null,
  1.0,
  true,
  2
),
(
  '88888888-7777-4777-8777-777777777763'::uuid,
  'dup_one_t4',
  'Ayni Etiket',
  'fixed',
  1000,
  null,
  true,
  3
),
(
  '88888888-7777-4777-8777-777777777764'::uuid,
  'dup_two_t4',
  'Ayni Etiket',
  'fixed',
  2000,
  null,
  true,
  4
);

insert into public.listing_main_item_options (
  id,
  listing_id,
  main_item_id,
  override_amount,
  is_enabled,
  sort_order
)
values
(
  'bbbbbbbb-7777-4777-8777-777777777761'::uuid,
  '77777777-7777-4777-8777-777777777761'::uuid,
  '88888888-7777-4777-8777-777777777761'::uuid,
  17000,
  true,
  1
),
(
  'bbbbbbbb-7777-4777-8777-777777777762'::uuid,
  '77777777-7777-4777-8777-777777777761'::uuid,
  '88888888-7777-4777-8777-777777777762'::uuid,
  null,
  true,
  2
),
(
  'bbbbbbbb-7777-4777-8777-777777777763'::uuid,
  '77777777-7777-4777-8777-777777777762'::uuid,
  '88888888-7777-4777-8777-777777777763'::uuid,
  null,
  true,
  1
),
(
  'bbbbbbbb-7777-4777-8777-777777777764'::uuid,
  '77777777-7777-4777-8777-777777777762'::uuid,
  '88888888-7777-4777-8777-777777777764'::uuid,
  null,
  true,
  2
);

insert into public.service_catalog (
  id,
  code,
  name,
  base_price,
  is_active
)
values (
  '99999999-7777-4777-8777-777777777761'::uuid,
  'cleaning_t4',
  'Temizlik',
  2500,
  true
);

insert into public.listing_service_options (
  id,
  listing_id,
  service_id,
  override_price,
  is_enabled
)
values
(
  'aaaaaaaa-7777-4777-8777-777777777761'::uuid,
  '77777777-7777-4777-8777-777777777761'::uuid,
  '99999999-7777-4777-8777-777777777761'::uuid,
  2200,
  true
),
(
  'aaaaaaaa-7777-4777-8777-777777777762'::uuid,
  '77777777-7777-4777-8777-777777777762'::uuid,
  '99999999-7777-4777-8777-777777777761'::uuid,
  2200,
  true
);

select set_config('request.jwt.claim.sub', '66666666-7777-4777-8777-777777777762', false);

-- TEST 1: valid checkout creates reservation, order, order_items and pending Isbank payment atomically
do $$
declare
  v_result jsonb;
  v_reservation_id uuid;
  v_order_id uuid;
  v_payment_id uuid;
  v_reservation public.reservations%rowtype;
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
  v_intake public.reservation_intake%rowtype;
  v_item_count integer;
  v_code_count integer;
  v_item_sum numeric(12, 2);
  v_listing_status public.listing_status;
begin
  v_result := public.create_checkout(
    '77777777-7777-4777-8777-777777777761'::uuid,
    current_date + 30,
    6,
    2,
    array['deposit_t4', 'first_rent_t4'],
    array['cleaning_t4'],
    'Havale notu',
    'Phase3 Contact User',
    '+905551112233',
    'PHASE3-CONTACT@example.com',
    'whatsapp',
    '18:00 sonrasi',
    null,
    'needs_help',
    'Evrak listesi icin arayin'
  );

  if v_result->>'result' <> 'created' then
    raise exception 'TEST 1 FAILED: expected created result, got %', v_result;
  end if;

  v_reservation_id := (v_result->>'reservation_id')::uuid;
  v_order_id := (v_result->>'order_id')::uuid;
  v_payment_id := (v_result->>'payment_id')::uuid;

  select * into v_reservation
  from public.reservations
  where id = v_reservation_id;

  select * into v_order
  from public.orders
  where id = v_order_id;

  select * into v_payment
  from public.payments
  where id = v_payment_id;

  select * into v_intake
  from public.reservation_intake
  where reservation_id = v_reservation_id;

  select count(*), coalesce(sum(amount), 0)
  into v_item_count, v_item_sum
  from public.order_items
  where order_id = v_order_id;

  select count(*)
  into v_code_count
  from public.order_items
  where order_id = v_order_id
    and code in ('deposit_t4', 'first_rent_t4', 'cleaning_t4');

  select status into v_listing_status
  from public.listings
  where id = '77777777-7777-4777-8777-777777777761'::uuid;

  if v_reservation.id is null or v_order.id is null or v_payment.id is null then
    raise exception 'TEST 1 FAILED: expected reservation/order/payment rows to exist';
  end if;

  if v_intake.reservation_id is null then
    raise exception 'TEST 1 FAILED: expected reservation_intake row to exist';
  end if;

  if v_intake.user_id <> '66666666-7777-4777-8777-777777777762'::uuid
     or v_intake.contact_full_name <> 'Phase3 Contact User'
     or v_intake.contact_phone <> '+905551112233'
     or v_intake.contact_email <> 'phase3-contact@example.com'
     or v_intake.preferred_contact_method <> 'whatsapp'
     or v_intake.preferred_contact_time <> '18:00 sonrasi'
     or v_intake.occupant_full_name is not null
     or v_intake.document_readiness <> 'needs_help'
     or v_intake.note <> 'Evrak listesi icin arayin' then
    raise exception 'TEST 1 FAILED: reservation_intake values were not normalized or linked correctly';
  end if;

  if v_reservation.user_id <> '66666666-7777-4777-8777-777777777762'::uuid
     or v_order.user_id <> '66666666-7777-4777-8777-777777777762'::uuid
     or v_payment.user_id <> '66666666-7777-4777-8777-777777777762'::uuid then
    raise exception 'TEST 1 FAILED: generated rows must belong to auth.uid()';
  end if;

  if v_reservation.status <> 'pending'
     or v_order.status <> 'pending'
     or v_payment.status <> 'pending' then
    raise exception
      'TEST 1 FAILED: expected pending statuses reservation=% order=% payment=%',
      v_reservation.status, v_order.status, v_payment.status;
  end if;

  if v_order.total_amount <> 61200
     or v_payment.amount <> 61200
     or v_item_sum <> 61200
     or v_item_count <> 3 then
    raise exception
      'TEST 1 FAILED: amount/count mismatch order=% payment=% sum=% count=%',
      v_order.total_amount, v_payment.amount, v_item_sum, v_item_count;
  end if;

  if v_code_count <> 3 then
    raise exception 'TEST 1 FAILED: expected quote item codes to be stored on order_items, got %',
      v_code_count;
  end if;

  if v_order.currency <> 'TRY' or v_payment.currency <> 'TRY' then
    raise exception 'TEST 1 FAILED: expected TRY currency order=% payment=%',
      v_order.currency, v_payment.currency;
  end if;

  if v_payment.provider <> 'isbank' or v_payment.provider_ref <> v_payment.id::text then
    raise exception 'TEST 1 FAILED: Isbank provider_ref must equal payment id';
  end if;

  if v_payment.order_id <> v_order.id or v_order.reservation_id <> v_reservation.id then
    raise exception 'TEST 1 FAILED: generated rows are not linked correctly';
  end if;

  if v_listing_status <> 'active' then
    raise exception 'TEST 1 FAILED: checkout create must not close listing, got %', v_listing_status;
  end if;
end;
$$;

-- TEST 1A: checkout intake contact fields are required and validated before writes
do $$
declare
  v_reservation_count integer;
begin
  begin
    perform public.create_checkout(
      '77777777-7777-4777-8777-777777777762'::uuid,
      current_date + 34,
      6,
      1,
      array['dup_one_t4'],
      array[]::text[],
      '   ',
      'Phase3 Contact User',
      '+905551112233',
      null,
      'phone',
      null,
      null,
      'ready',
      null
    );

    raise exception 'TEST 1A FAILED: missing payment note should have been rejected';
  exception
    when invalid_parameter_value then
      if position('p_note is required' in SQLERRM) = 0 then
        raise;
      end if;
  end;

  begin
    perform public.create_checkout(
      '77777777-7777-4777-8777-777777777762'::uuid,
      current_date + 32,
      6,
      1,
      array['deposit_t4'],
      array[]::text[],
      'Eksik contact kontrolu',
      null,
      '+905551112233',
      null,
      'phone',
      null,
      null,
      'ready',
      null
    );

    raise exception 'TEST 1A FAILED: missing contact full name should have been rejected';
  exception
    when invalid_parameter_value then
      if position('p_contact_full_name is required' in SQLERRM) = 0 then
        raise;
      end if;
  end;

  begin
    perform public.create_checkout(
      '77777777-7777-4777-8777-777777777762'::uuid,
      current_date + 33,
      6,
      1,
      array['deposit_t4'],
      array[]::text[],
      'Gecersiz contact enum kontrolu',
      'Phase3 Contact User',
      '+905551112233',
      null,
      'sms',
      null,
      null,
      'ready',
      null
    );

    raise exception 'TEST 1A FAILED: invalid contact preferred method should have been rejected';
  exception
    when invalid_parameter_value then
      if position('p_contact_preferred_method must be one of phone, whatsapp, email' in SQLERRM) = 0 then
        raise;
      end if;
  end;

  select count(*)
  into v_reservation_count
  from public.reservations
  where listing_id = '77777777-7777-4777-8777-777777777762'::uuid
    and (
      note in ('Eksik contact kontrolu', 'Gecersiz contact enum kontrolu')
      or move_in_date = current_date + 34
    );

  if v_reservation_count <> 0 then
    raise exception 'TEST 1A FAILED: invalid checkout attempts must not create reservations, got %',
      v_reservation_count;
  end if;
end;
$$;

-- TEST 1B: same listing cannot open a second pending checkout while one is already pending
do $$
begin
  begin
    perform public.create_checkout(
      '77777777-7777-4777-8777-777777777761'::uuid,
      current_date + 31,
      6,
      1,
      array['deposit_t4'],
      array[]::text[],
      'Ikinci pending checkout denemesi',
      'Phase3 Contact User',
      '+905551112233',
      null,
      'phone',
      null,
      null,
      'ready',
      null
    );
    raise exception 'TEST 1B FAILED: second pending checkout should have been rejected';
  exception
    when sqlstate 'P0002' then
      if position('listing is not available for checkout' in SQLERRM) = 0 then
        raise;
      end if;
  end;
end;
$$;

-- TEST 1C: concurrent pending-reservation conflicts map to listing unavailable
reset role;

create or replace function public.phase3_t4_force_pending_reservation_conflict()
returns trigger
language plpgsql
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if new.listing_id = '77777777-7777-4777-8777-777777777762'::uuid
     and new.status = 'pending'
     and new.note = '__phase3_t4_conflict__' then
    insert into public.reservations (
      listing_id,
      user_id,
      move_in_date,
      stay_months,
      guest_count,
      note,
      status
    )
    values (
      new.listing_id,
      new.user_id,
      new.move_in_date,
      new.stay_months,
      new.guest_count,
      '__phase3_t4_conflict_injected__',
      'pending'
    );
  end if;

  return new;
end;
$$;

create trigger trg_phase3_t4_force_pending_reservation_conflict
before insert on public.reservations
for each row
execute function public.phase3_t4_force_pending_reservation_conflict();

set role authenticated;
select set_config('request.jwt.claim.sub', '66666666-7777-4777-8777-777777777762', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
begin
  begin
    perform public.create_checkout(
      '77777777-7777-4777-8777-777777777762'::uuid,
      current_date + 44,
      6,
      1,
      array['dup_one_t4'],
      array[]::text[],
      '__phase3_t4_conflict__',
      'Phase3 Contact User',
      '+905551112233',
      null,
      'phone',
      null,
      null,
      'ready',
      null
    );
    raise exception 'TEST 1C FAILED: expected concurrent conflict to map to listing unavailable';
  exception
    when sqlstate 'P0002' then
      if position('listing is not available for checkout' in SQLERRM) = 0 then
        raise;
      end if;
  end;
end;
$$;

reset role;

drop trigger if exists trg_phase3_t4_force_pending_reservation_conflict
on public.reservations;

drop function if exists public.phase3_t4_force_pending_reservation_conflict();

delete from public.reservations
where listing_id = '77777777-7777-4777-8777-777777777762'::uuid
  and note in ('__phase3_t4_conflict__', '__phase3_t4_conflict_injected__');

-- TEST 1D: unrelated reservation unique violations are not masked as listing-unavailable conflicts
reset role;

create unique index phase3_t4_reservations_note_unique_idx
  on public.reservations (note)
  where note = '__phase3_t4_other_unique__';

insert into public.reservations (
  listing_id,
  user_id,
  move_in_date,
  stay_months,
  guest_count,
  note,
  status
)
values (
  '77777777-7777-4777-8777-777777777762'::uuid,
  '66666666-7777-4777-8777-777777777762'::uuid,
  current_date + 46,
  6,
  1,
  '__phase3_t4_other_unique__',
  'cancelled'
);

set role authenticated;
select set_config('request.jwt.claim.sub', '66666666-7777-4777-8777-777777777762', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
begin
  begin
    perform public.create_checkout(
      '77777777-7777-4777-8777-777777777762'::uuid,
      current_date + 47,
      6,
      1,
      array['dup_one_t4'],
      array[]::text[],
      '__phase3_t4_other_unique__',
      'Phase3 Contact User',
      '+905551112233',
      null,
      'phone',
      null,
      null,
      'ready',
      null
    );
    raise exception 'TEST 1D FAILED: unrelated reservation unique violation should surface as raw unique_violation';
  exception
    when unique_violation then
      null;
    when sqlstate 'P0002' then
      raise exception 'TEST 1D FAILED: unrelated reservation unique violation was incorrectly mapped to listing unavailable';
  end;
end;
$$;

reset role;

drop index if exists public.phase3_t4_reservations_note_unique_idx;

delete from public.reservations
where note = '__phase3_t4_other_unique__';

set role authenticated;
select set_config('request.jwt.claim.sub', '66666666-7777-4777-8777-777777777762', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

-- TEST 2: authenticated users cannot bypass create_checkout with direct transactional inserts
do $$
declare
  v_reservation_id uuid;
  v_order_id uuid;
begin
  select r.id, o.id
  into v_reservation_id, v_order_id
  from public.reservations r
  join public.orders o
    on o.reservation_id = r.id
  where r.listing_id = '77777777-7777-4777-8777-777777777761'::uuid
    and r.user_id = '66666666-7777-4777-8777-777777777762'::uuid
  order by r.created_at desc
  limit 1;

  if v_reservation_id is null or v_order_id is null then
    raise exception 'TEST 2 FAILED: expected checkout rows from TEST 1';
  end if;

  if has_table_privilege('authenticated', 'public.reservations', 'INSERT')
     or has_table_privilege('authenticated', 'public.orders', 'INSERT')
     or has_table_privilege('authenticated', 'public.order_items', 'INSERT')
     or has_table_privilege('authenticated', 'public.payments', 'INSERT')
     or has_table_privilege('authenticated', 'public.reservation_intake', 'INSERT') then
    raise exception 'TEST 2 FAILED: authenticated must not have direct transactional INSERT privileges';
  end if;

  begin
    insert into public.reservations (
      listing_id,
      user_id,
      move_in_date,
      stay_months,
      guest_count,
      status
    )
    values (
      '77777777-7777-4777-8777-777777777761'::uuid,
      '66666666-7777-4777-8777-777777777762'::uuid,
      current_date + 15,
      6,
      1,
      'pending'
    );
    raise exception 'TEST 2 FAILED: direct reservation insert should be denied';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    insert into public.orders (
      reservation_id,
      user_id,
      total_amount,
      currency,
      status
    )
    values (
      v_reservation_id,
      '66666666-7777-4777-8777-777777777762'::uuid,
      1,
      'TRY',
      'pending'
    );
    raise exception 'TEST 2 FAILED: direct order insert should be denied';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    insert into public.order_items (
      order_id,
      item_type,
      label,
      amount
    )
    values (
      v_order_id,
      'main_item',
      'Bypass Kalem',
      1
    );
    raise exception 'TEST 2 FAILED: direct order item insert should be denied';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    insert into public.reservation_intake (
      reservation_id,
      user_id,
      contact_full_name,
      contact_phone,
      preferred_contact_method,
      document_readiness
    )
    values (
      v_reservation_id,
      '66666666-7777-4777-8777-777777777762'::uuid,
      'Bypass Contact',
      '+905551112233',
      'phone',
      'ready'
    );
    raise exception 'TEST 2 FAILED: direct reservation intake insert should be denied';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    insert into public.payments (
      order_id,
      user_id,
      amount,
      currency,
      status,
      provider
    )
    values (
      v_order_id,
      '66666666-7777-4777-8777-777777777762'::uuid,
      1,
      'TRY',
      'pending',
      'isbank'
    );
    raise exception 'TEST 2 FAILED: direct payment insert should be denied';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;

-- TEST 3: past move-in dates are rejected before reservation creation
do $$
declare
  v_reservation_count integer;
begin
  begin
    perform public.create_checkout(
      '77777777-7777-4777-8777-777777777761'::uuid,
      current_date - 1,
      6,
      1,
      array['deposit_t4'],
      array[]::text[],
      'Gecmis tarih kontrolu',
      'Phase3 Contact User',
      '+905551112233',
      null,
      'phone',
      null,
      null,
      'ready',
      null
    );
    raise exception 'TEST 3 FAILED: past move-in date should have raised';
  exception
    when invalid_parameter_value then
      if position('p_move_in_date cannot be in the past' in SQLERRM) = 0 then
        raise;
      end if;
  end;

  select count(*)
  into v_reservation_count
  from public.reservations
  where listing_id = '77777777-7777-4777-8777-777777777761'::uuid
    and user_id = '66666666-7777-4777-8777-777777777762'::uuid
    and move_in_date = current_date - 1;

  if v_reservation_count <> 0 then
    raise exception 'TEST 3 FAILED: past-date checkout left reservation rows=%',
      v_reservation_count;
  end if;
end;
$$;

-- TEST 4: same display label with different main item codes remains a valid checkout
do $$
declare
  v_result jsonb;
  v_reservation_id uuid;
  v_order_id uuid;
  v_reservation_count integer;
  v_order_count integer;
  v_payment_count integer;
  v_order_item_count integer;
  v_duplicate_label_count integer;
  v_code_count integer;
  v_item_sum numeric(12, 2);
begin
  v_result := public.create_checkout(
    '77777777-7777-4777-8777-777777777762'::uuid,
    current_date + 45,
    6,
    1,
    array['dup_one_t4', 'dup_two_t4'],
    array[]::text[],
    'Ayni etiket farkli kod kontrolu',
    'Phase3 Contact User',
    '+905551112233',
    null,
    'phone',
    null,
    null,
    'ready',
    null
  );

  if v_result->>'result' <> 'created' then
    raise exception 'TEST 4 FAILED: expected created result for duplicate labels with distinct codes, got %',
      v_result;
  end if;

  v_reservation_id := (v_result->>'reservation_id')::uuid;
  v_order_id := (v_result->>'order_id')::uuid;

  select count(*)
  into v_reservation_count
  from public.reservations
  where listing_id = '77777777-7777-4777-8777-777777777762'::uuid
    and user_id = '66666666-7777-4777-8777-777777777762'::uuid;

  select count(*)
  into v_order_count
  from public.orders o
  join public.reservations r
    on r.id = o.reservation_id
  where r.listing_id = '77777777-7777-4777-8777-777777777762'::uuid
    and o.user_id = '66666666-7777-4777-8777-777777777762'::uuid;

  select count(*)
  into v_payment_count
  from public.payments p
  join public.orders o
    on o.id = p.order_id
  join public.reservations r
    on r.id = o.reservation_id
  where r.listing_id = '77777777-7777-4777-8777-777777777762'::uuid
    and p.user_id = '66666666-7777-4777-8777-777777777762'::uuid;

  select count(*)
  into v_order_item_count
  from public.order_items oi
  join public.orders o
    on o.id = oi.order_id
  join public.reservations r
    on r.id = o.reservation_id
  where r.listing_id = '77777777-7777-4777-8777-777777777762'::uuid;

  select count(*), coalesce(sum(amount), 0)
  into v_duplicate_label_count, v_item_sum
  from public.order_items
  where order_id = v_order_id
    and item_type = 'main_item'
    and label = 'Ayni Etiket';

  select count(*)
  into v_code_count
  from public.order_items
  where order_id = v_order_id
    and item_type = 'main_item'
    and code in ('dup_one_t4', 'dup_two_t4');

  if v_reservation_count <> 1
     or v_order_count <> 1
     or v_payment_count <> 1
     or v_order_item_count <> 2
     or v_duplicate_label_count <> 2
     or v_code_count <> 2
     or v_item_sum <> 3000 then
    raise exception
      'TEST 4 FAILED: duplicate-label checkout mismatch reservation=% order=% payment=% item=% label_count=% code_count=% sum=%',
      v_reservation_count,
      v_order_count,
      v_payment_count,
      v_order_item_count,
      v_duplicate_label_count,
      v_code_count,
      v_item_sum;
  end if;

  delete from public.payments
  where order_id = v_order_id;

  delete from public.order_items
  where order_id = v_order_id;

  delete from public.orders
  where id = v_order_id;

  delete from public.reservations
  where id = v_reservation_id;
end;
$$;

reset role;

delete from public.payments
where order_id in (
  select o.id
  from public.orders o
  join public.reservations r
    on r.id = o.reservation_id
  where r.listing_id = '77777777-7777-4777-8777-777777777762'::uuid
    and r.user_id = '66666666-7777-4777-8777-777777777762'::uuid
    and r.move_in_date = current_date + 45
);

delete from public.order_items
where order_id in (
  select o.id
  from public.orders o
  join public.reservations r
    on r.id = o.reservation_id
  where r.listing_id = '77777777-7777-4777-8777-777777777762'::uuid
    and r.user_id = '66666666-7777-4777-8777-777777777762'::uuid
    and r.move_in_date = current_date + 45
);

delete from public.orders
where reservation_id in (
  select id
  from public.reservations
  where listing_id = '77777777-7777-4777-8777-777777777762'::uuid
    and user_id = '66666666-7777-4777-8777-777777777762'::uuid
    and move_in_date = current_date + 45
);

delete from public.reservations
where listing_id = '77777777-7777-4777-8777-777777777762'::uuid
  and user_id = '66666666-7777-4777-8777-777777777762'::uuid
  and move_in_date = current_date + 45;

set role authenticated;
select set_config('request.jwt.claim.sub', '66666666-7777-4777-8777-777777777762', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

-- TEST 5: create_checkout must lock the listing row before creating checkout rows
do $$
declare
  v_reservation_count integer;
  v_order_count integer;
  v_payment_count integer;
  v_connection_name text := 'phase3_create_checkout_lock_holder';
begin
  perform dblink_connect(
    v_connection_name,
    'host=/var/run/postgresql dbname=postgres user=supabase_admin password=postgres'
  );

  perform dblink_exec(v_connection_name, 'begin');
  perform dblink_exec(
    v_connection_name,
    $dblink$
      update public.listings
      set updated_at = updated_at
      where id = '77777777-7777-4777-8777-777777777762'::uuid
    $dblink$
  );

  perform set_config('lock_timeout', '250ms', true);

  begin
    perform public.create_checkout(
      '77777777-7777-4777-8777-777777777762'::uuid,
      current_date + 60,
      6,
      1,
      array['dup_one_t4'],
      array[]::text[],
      'Lock kontrolu',
      'Phase3 Contact User',
      '+905551112233',
      null,
      'phone',
      null,
      null,
      'ready',
      null
    );
    raise exception 'TEST 5 FAILED: create_checkout should block on locked listing row';
  exception
    when lock_not_available then
      null;
  end;

  select count(*)
  into v_reservation_count
  from public.reservations
  where listing_id = '77777777-7777-4777-8777-777777777762'::uuid
    and user_id = '66666666-7777-4777-8777-777777777762'::uuid
    and move_in_date = current_date + 60;

  select count(*)
  into v_order_count
  from public.orders o
  join public.reservations r
    on r.id = o.reservation_id
  where r.listing_id = '77777777-7777-4777-8777-777777777762'::uuid
    and r.user_id = '66666666-7777-4777-8777-777777777762'::uuid
    and r.move_in_date = current_date + 60;

  select count(*)
  into v_payment_count
  from public.payments p
  join public.orders o
    on o.id = p.order_id
  join public.reservations r
    on r.id = o.reservation_id
  where r.listing_id = '77777777-7777-4777-8777-777777777762'::uuid
    and r.user_id = '66666666-7777-4777-8777-777777777762'::uuid
    and r.move_in_date = current_date + 60;

  if v_reservation_count <> 0 or v_order_count <> 0 or v_payment_count <> 0 then
    raise exception
      'TEST 5 FAILED: locked-listing checkout left partial rows reservation=% order=% payment=%',
      v_reservation_count, v_order_count, v_payment_count;
  end if;

  perform dblink_exec(v_connection_name, 'rollback');
  perform dblink_disconnect(v_connection_name);
exception
  when others then
    begin
      perform dblink_exec(v_connection_name, 'rollback');
    exception
      when others then
        null;
    end;

    begin
      perform dblink_disconnect(v_connection_name);
    exception
      when others then
        null;
    end;

    raise;
end;
$$;

-- TEST 6: create_checkout must lock requested main item configuration rows before quoting
do $$
declare
  v_reservation_count integer;
  v_order_count integer;
  v_payment_count integer;
  v_connection_name text := 'phase3_create_checkout_main_item_lock_holder';
begin
  perform dblink_connect(
    v_connection_name,
    'host=/var/run/postgresql dbname=postgres user=supabase_admin password=postgres'
  );

  perform dblink_exec(v_connection_name, 'begin');
  perform dblink_exec(
    v_connection_name,
    $dblink$
      update public.listing_main_item_options
      set updated_at = updated_at
      where id = 'bbbbbbbb-7777-4777-8777-777777777763'::uuid
    $dblink$
  );

  perform set_config('lock_timeout', '250ms', true);

  begin
    perform public.create_checkout(
      '77777777-7777-4777-8777-777777777762'::uuid,
      current_date + 75,
      6,
      1,
      array['dup_one_t4'],
      array[]::text[],
      'Main item lock kontrolu',
      'Phase3 Contact User',
      '+905551112233',
      null,
      'phone',
      null,
      null,
      'ready',
      null
    );
    raise exception 'TEST 6 FAILED: create_checkout should block on locked main item config row';
  exception
    when lock_not_available then
      null;
  end;

  select count(*)
  into v_reservation_count
  from public.reservations
  where listing_id = '77777777-7777-4777-8777-777777777762'::uuid
    and user_id = '66666666-7777-4777-8777-777777777762'::uuid
    and move_in_date = current_date + 75;

  select count(*)
  into v_order_count
  from public.orders o
  join public.reservations r
    on r.id = o.reservation_id
  where r.listing_id = '77777777-7777-4777-8777-777777777762'::uuid
    and r.user_id = '66666666-7777-4777-8777-777777777762'::uuid
    and r.move_in_date = current_date + 75;

  select count(*)
  into v_payment_count
  from public.payments p
  join public.orders o
    on o.id = p.order_id
  join public.reservations r
    on r.id = o.reservation_id
  where r.listing_id = '77777777-7777-4777-8777-777777777762'::uuid
    and r.user_id = '66666666-7777-4777-8777-777777777762'::uuid
    and r.move_in_date = current_date + 75;

  if v_reservation_count <> 0 or v_order_count <> 0 or v_payment_count <> 0 then
    raise exception
      'TEST 6 FAILED: locked-main-item checkout left partial rows reservation=% order=% payment=%',
      v_reservation_count, v_order_count, v_payment_count;
  end if;

  perform dblink_exec(v_connection_name, 'rollback');
  perform dblink_disconnect(v_connection_name);
exception
  when others then
    begin
      perform dblink_exec(v_connection_name, 'rollback');
    exception
      when others then
        null;
    end;

    begin
      perform dblink_disconnect(v_connection_name);
    exception
      when others then
        null;
    end;

    raise;
end;
$$;

-- TEST 7: anonymous clients cannot execute checkout create directly
reset role;
do $$
declare
  v_public_create_checkout_definer boolean;
begin
  select p.prosecdef
  into v_public_create_checkout_definer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'create_checkout'
  limit 1;

  if v_public_create_checkout_definer is not true then
    raise exception 'TEST 7 FAILED: public create_checkout wrapper must be SECURITY DEFINER';
  end if;

  if has_function_privilege(
    'anon',
    'public.create_checkout(uuid, date, integer, integer, text[], text[], text, text, text, text, text, text, text, text, text)',
    'EXECUTE'
  ) then
    raise exception 'TEST 7 FAILED: anon should not be allowed to execute create_checkout';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.create_checkout(uuid, date, integer, integer, text[], text[], text, text, text, text, text, text, text, text, text)',
    'EXECUTE'
  ) then
    raise exception 'TEST 7 FAILED: authenticated should be allowed to execute create_checkout';
  end if;

  if has_function_privilege(
    'authenticated',
    'internal.create_checkout(uuid, date, integer, integer, text[], text[], text, text, text, text, text, text, text, text, text)',
    'EXECUTE'
  ) then
    raise exception 'TEST 7 FAILED: authenticated should not execute internal create_checkout directly';
  end if;

  if has_function_privilege(
    'anon',
    'internal.create_checkout(uuid, date, integer, integer, text[], text[], text, text, text, text, text, text, text, text, text)',
    'EXECUTE'
  ) then
    raise exception 'TEST 7 FAILED: anon should not execute internal create_checkout directly';
  end if;

  if not has_function_privilege(
    'service_role',
    'internal.create_checkout(uuid, date, integer, integer, text[], text[], text, text, text, text, text, text, text, text, text)',
    'EXECUTE'
  ) then
    raise exception 'TEST 7 FAILED: service_role should execute internal create_checkout';
  end if;
end;
$$;

select 'phase3_task4_create_checkout_ok' as result;
