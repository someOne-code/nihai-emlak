\set ON_ERROR_STOP on

-- Phase 1 / Task 7: atomic process_payment_checkout behavior tests.

-- Deterministic ids
-- user:            77777777-7777-4777-8777-777777777801
-- listing_succ:    77777777-7777-4777-8777-777777777811
-- reservation_succ:77777777-7777-4777-8777-777777777821
-- order_succ:      77777777-7777-4777-8777-777777777831
-- payment_succ:    77777777-7777-4777-8777-777777777841
-- listing_conf:    77777777-7777-4777-8777-777777777812
-- reservation_conf:77777777-7777-4777-8777-777777777822
-- order_conf:      77777777-7777-4777-8777-777777777832
-- payment_conf:    77777777-7777-4777-8777-777777777842
-- listing_rb:      77777777-7777-4777-8777-777777777813
-- reservation_rb:  77777777-7777-4777-8777-777777777823
-- order_rb:        77777777-7777-4777-8777-777777777833
-- payment_rb:      77777777-7777-4777-8777-777777777843

delete from auth.users
where id = '77777777-7777-4777-8777-777777777801'::uuid;

insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  '77777777-7777-4777-8777-777777777801'::uuid,
  'authenticated', 'authenticated', 'task7-atomic@example.com',
  crypt('test-password', gen_salt('bf')), now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Task7 Atomic User'),
  now(), now(), '', '', '', ''
);

insert into public.listings (id, type, status, title, slug, city, price, currency)
values
(
  '77777777-7777-4777-8777-777777777811'::uuid, 'rent', 'active',
  'Task7 Success Listing', 'task7-success-listing', 'Istanbul', 15000, 'TRY'
),
(
  '77777777-7777-4777-8777-777777777812'::uuid, 'rent', 'passive',
  'Task7 Conflict Listing', 'task7-conflict-listing', 'Ankara', 12000, 'TRY'
),
(
  '77777777-7777-4777-8777-777777777813'::uuid, 'rent', 'active',
  'Task7 Rollback Listing', 'task7-rollback-listing', 'Izmir', 11000, 'TRY'
)
on conflict (id) do update
set status = excluded.status,
    title = excluded.title,
    slug = excluded.slug,
    city = excluded.city,
    price = excluded.price,
    currency = excluded.currency;

insert into public.reservations (
  id, listing_id, user_id, move_in_date, stay_months, guest_count, status
)
values
(
  '77777777-7777-4777-8777-777777777821'::uuid,
  '77777777-7777-4777-8777-777777777811'::uuid,
  '77777777-7777-4777-8777-777777777801'::uuid,
  current_date + 15, 6, 1, 'pending'
),
(
  '77777777-7777-4777-8777-777777777822'::uuid,
  '77777777-7777-4777-8777-777777777812'::uuid,
  '77777777-7777-4777-8777-777777777801'::uuid,
  current_date + 20, 6, 1, 'pending'
),
(
  '77777777-7777-4777-8777-777777777823'::uuid,
  '77777777-7777-4777-8777-777777777813'::uuid,
  '77777777-7777-4777-8777-777777777801'::uuid,
  current_date + 25, 6, 1, 'pending'
);

insert into public.orders (id, reservation_id, user_id, total_amount, currency, status)
values
(
  '77777777-7777-4777-8777-777777777831'::uuid,
  '77777777-7777-4777-8777-777777777821'::uuid,
  '77777777-7777-4777-8777-777777777801'::uuid,
  15000, 'TRY', 'pending'
),
(
  '77777777-7777-4777-8777-777777777832'::uuid,
  '77777777-7777-4777-8777-777777777822'::uuid,
  '77777777-7777-4777-8777-777777777801'::uuid,
  12000, 'TRY', 'pending'
),
(
  '77777777-7777-4777-8777-777777777833'::uuid,
  '77777777-7777-4777-8777-777777777823'::uuid,
  '77777777-7777-4777-8777-777777777801'::uuid,
  11000, 'TRY', 'pending'
);

insert into public.payments (id, order_id, user_id, amount, currency, status, provider)
values
(
  '77777777-7777-4777-8777-777777777841'::uuid,
  '77777777-7777-4777-8777-777777777831'::uuid,
  '77777777-7777-4777-8777-777777777801'::uuid,
  15000, 'TRY', 'pending', 'isbank'
),
(
  '77777777-7777-4777-8777-777777777842'::uuid,
  '77777777-7777-4777-8777-777777777832'::uuid,
  '77777777-7777-4777-8777-777777777801'::uuid,
  12000, 'TRY', 'pending', 'isbank'
),
(
  '77777777-7777-4777-8777-777777777843'::uuid,
  '77777777-7777-4777-8777-777777777833'::uuid,
  '77777777-7777-4777-8777-777777777801'::uuid,
  11000, 'TRY', 'pending', 'isbank'
);

-- TEST 1: success path is atomic and updates all related entities.
do $$
declare
  v_result jsonb;
  v_order_status public.order_status;
  v_payment_status public.payment_status;
  v_reservation_status public.reservation_status;
  v_listing_status public.listing_status;
begin
  v_result := public.process_payment_checkout(
    '77777777-7777-4777-8777-777777777841'::uuid,
    'isbank_callback_approved',
    '77777777-7777-4777-8777-777777777841',
    '{"source":"task7"}'::jsonb
  );

  if v_result->>'result' <> 'succeeded' then
    raise exception 'TEST 1 FAILED: expected succeeded, got %', v_result;
  end if;

  select status into v_payment_status
  from public.payments where id = '77777777-7777-4777-8777-777777777841'::uuid;
  select status into v_order_status
  from public.orders where id = '77777777-7777-4777-8777-777777777831'::uuid;
  select status into v_reservation_status
  from public.reservations where id = '77777777-7777-4777-8777-777777777821'::uuid;
  select status into v_listing_status
  from public.listings where id = '77777777-7777-4777-8777-777777777811'::uuid;

  if v_payment_status <> 'succeeded'
     or v_order_status <> 'completed'
     or v_reservation_status <> 'confirmed'
     or v_listing_status <> 'passive' then
    raise exception
      'TEST 1 FAILED: status mismatch payment=% order=% reservation=% listing=%',
      v_payment_status, v_order_status, v_reservation_status, v_listing_status;
  end if;
end;
$$;

-- TEST 2: second call is idempotent.
do $$
declare
  v_result jsonb;
begin
  v_result := public.process_payment_checkout(
    '77777777-7777-4777-8777-777777777841'::uuid,
    'isbank_callback_approved',
    '77777777-7777-4777-8777-777777777841',
    '{"source":"task7-second"}'::jsonb
  );

  if v_result->>'result' <> 'idempotent' then
    raise exception 'TEST 2 FAILED: expected idempotent, got %', v_result;
  end if;
end;
$$;

-- TEST 3: passive listing produces conflict result.
do $$
declare
  v_result jsonb;
  v_order_status public.order_status;
  v_payment_status public.payment_status;
  v_reservation_status public.reservation_status;
begin
  v_result := public.process_payment_checkout(
    '77777777-7777-4777-8777-777777777842'::uuid,
    'isbank_callback_approved',
    '77777777-7777-4777-8777-777777777842',
    '{"source":"task7-conflict"}'::jsonb
  );

  if v_result->>'result' <> 'conflict' then
    raise exception 'TEST 3 FAILED: expected conflict, got %', v_result;
  end if;

  select status into v_payment_status
  from public.payments where id = '77777777-7777-4777-8777-777777777842'::uuid;
  select status into v_order_status
  from public.orders where id = '77777777-7777-4777-8777-777777777832'::uuid;
  select status into v_reservation_status
  from public.reservations where id = '77777777-7777-4777-8777-777777777822'::uuid;

  if v_payment_status <> 'conflict'
     or v_order_status <> 'conflict'
     or v_reservation_status <> 'expired' then
    raise exception
      'TEST 3 FAILED: conflict status mismatch payment=% order=% reservation=%',
      v_payment_status, v_order_status, v_reservation_status;
  end if;
end;
$$;

-- TEST 4: forced error after payment update rolls back entire transaction.
do $$
declare
  v_payment_status public.payment_status;
  v_order_status public.order_status;
  v_reservation_status public.reservation_status;
  v_listing_status public.listing_status;
begin
  begin
    perform public.process_payment_checkout(
      '77777777-7777-4777-8777-777777777843'::uuid,
      '__force_error_after_payment_update__',
      '77777777-7777-4777-8777-777777777843',
      '{"source":"task7-rollback"}'::jsonb
    );
    raise exception 'TEST 4 FAILED: forced error should raise exception';
  exception
    when raise_exception then
      if position('Forced process_payment_checkout failure after payment update' in SQLERRM) = 0 then
        raise;
      end if;
  end;

  select status into v_payment_status
  from public.payments where id = '77777777-7777-4777-8777-777777777843'::uuid;
  select status into v_order_status
  from public.orders where id = '77777777-7777-4777-8777-777777777833'::uuid;
  select status into v_reservation_status
  from public.reservations where id = '77777777-7777-4777-8777-777777777823'::uuid;
  select status into v_listing_status
  from public.listings where id = '77777777-7777-4777-8777-777777777813'::uuid;

  if v_payment_status <> 'pending'
     or v_order_status <> 'pending'
     or v_reservation_status <> 'pending'
     or v_listing_status <> 'active' then
    raise exception
      'TEST 4 FAILED: rollback mismatch payment=% order=% reservation=% listing=%',
      v_payment_status, v_order_status, v_reservation_status, v_listing_status;
  end if;
end;
$$;

-- Cleanup
delete from public.payment_events where payment_id in (
  '77777777-7777-4777-8777-777777777841'::uuid,
  '77777777-7777-4777-8777-777777777842'::uuid,
  '77777777-7777-4777-8777-777777777843'::uuid
);
delete from public.payments where id in (
  '77777777-7777-4777-8777-777777777841'::uuid,
  '77777777-7777-4777-8777-777777777842'::uuid,
  '77777777-7777-4777-8777-777777777843'::uuid
);
delete from public.orders where id in (
  '77777777-7777-4777-8777-777777777831'::uuid,
  '77777777-7777-4777-8777-777777777832'::uuid,
  '77777777-7777-4777-8777-777777777833'::uuid
);
delete from public.reservations where id in (
  '77777777-7777-4777-8777-777777777821'::uuid,
  '77777777-7777-4777-8777-777777777822'::uuid,
  '77777777-7777-4777-8777-777777777823'::uuid
);
delete from public.listings where id in (
  '77777777-7777-4777-8777-777777777811'::uuid,
  '77777777-7777-4777-8777-777777777812'::uuid,
  '77777777-7777-4777-8777-777777777813'::uuid
);
delete from auth.users where id = '77777777-7777-4777-8777-777777777801'::uuid;

select 'phase1_task7_atomic_payment_checkout_ok' as result;
