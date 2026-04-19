\set ON_ERROR_STOP on

-- Phase 1 / Task 7 hardening:
-- Signed failed callbacks must atomically mark payment/order failure without passivating listing.

-- deterministic ids
-- user:        88888888-8888-4888-8888-888888888801
-- listing:     88888888-8888-4888-8888-888888888811
-- reservation: 88888888-8888-4888-8888-888888888821
-- order:       88888888-8888-4888-8888-888888888831
-- payment:     88888888-8888-4888-8888-888888888841

delete from auth.users
where id = '88888888-8888-4888-8888-888888888801'::uuid;

insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  '88888888-8888-4888-8888-888888888801'::uuid,
  'authenticated', 'authenticated', 'task7-failed-callback@example.com',
  crypt('test-password', gen_salt('bf')), now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Task7 Failed Callback User'),
  now(), now(), '', '', '', ''
);

insert into public.listings (id, type, status, title, slug, city, price, currency)
values (
  '88888888-8888-4888-8888-888888888811'::uuid,
  'rent',
  'active',
  'Task7 Failed Callback Listing',
  'task7-failed-callback-listing',
  'Istanbul',
  10000,
  'TRY'
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
values (
  '88888888-8888-4888-8888-888888888821'::uuid,
  '88888888-8888-4888-8888-888888888811'::uuid,
  '88888888-8888-4888-8888-888888888801'::uuid,
  current_date + 10,
  6,
  1,
  'pending'
);

insert into public.orders (
  id, reservation_id, user_id, total_amount, currency, status
)
values (
  '88888888-8888-4888-8888-888888888831'::uuid,
  '88888888-8888-4888-8888-888888888821'::uuid,
  '88888888-8888-4888-8888-888888888801'::uuid,
  10000,
  'TRY',
  'pending'
);

insert into public.payments (
  id, order_id, user_id, amount, currency, status, provider, provider_ref
)
values (
  '88888888-8888-4888-8888-888888888841'::uuid,
  '88888888-8888-4888-8888-888888888831'::uuid,
  '88888888-8888-4888-8888-888888888801'::uuid,
  10000,
  'TRY',
  'pending',
  'isbank',
  '88888888-8888-4888-8888-888888888841'
);

do $$
declare
  v_result jsonb;
  v_payment_status public.payment_status;
  v_order_status public.order_status;
  v_reservation_status public.reservation_status;
  v_listing_status public.listing_status;
  v_failed_event_count integer;
begin
  v_result := public.process_payment_checkout(
    '88888888-8888-4888-8888-888888888841'::uuid,
    'isbank_callback_failed',
    '88888888-8888-4888-8888-888888888841',
    '{"Response":"Declined","ProcReturnCode":"05"}'::jsonb
  );

  if v_result->>'result' <> 'failed' then
    raise exception 'TEST FAILED: expected failed result, got %', v_result;
  end if;

  select status into v_payment_status
  from public.payments where id = '88888888-8888-4888-8888-888888888841'::uuid;

  select status into v_order_status
  from public.orders where id = '88888888-8888-4888-8888-888888888831'::uuid;

  select status into v_reservation_status
  from public.reservations where id = '88888888-8888-4888-8888-888888888821'::uuid;

  select status into v_listing_status
  from public.listings where id = '88888888-8888-4888-8888-888888888811'::uuid;

  select count(*) into v_failed_event_count
  from public.payment_events
  where payment_id = '88888888-8888-4888-8888-888888888841'::uuid
    and event_type = 'payment_checkout_failed';

  if v_payment_status <> 'failed'
     or v_order_status <> 'failed'
     or v_reservation_status <> 'expired'
     or v_listing_status <> 'active'
     or v_failed_event_count <> 1 then
    raise exception
      'TEST FAILED: status/event mismatch payment=% order=% reservation=% listing=% events=%',
      v_payment_status, v_order_status, v_reservation_status, v_listing_status, v_failed_event_count;
  end if;
end;
$$;

delete from public.payment_events where payment_id = '88888888-8888-4888-8888-888888888841'::uuid;
delete from public.payments where id = '88888888-8888-4888-8888-888888888841'::uuid;
delete from public.orders where id = '88888888-8888-4888-8888-888888888831'::uuid;
delete from public.reservations where id = '88888888-8888-4888-8888-888888888821'::uuid;
delete from public.listings where id = '88888888-8888-4888-8888-888888888811'::uuid;
delete from auth.users where id = '88888888-8888-4888-8888-888888888801'::uuid;

select 'phase1_task7_failed_payment_callback_ok' as result;
