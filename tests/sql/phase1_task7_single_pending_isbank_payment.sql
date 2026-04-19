\set ON_ERROR_STOP on

-- Phase 1 / Task 7:
-- Enforce single pending isbank payment per order.

-- deterministic ids
-- user:        99999999-9999-4999-8999-999999999901
-- listing:     99999999-9999-4999-8999-999999999911
-- reservation: 99999999-9999-4999-8999-999999999921
-- order:       99999999-9999-4999-8999-999999999931
-- pay_pending: 99999999-9999-4999-8999-999999999941
-- pay_done:    99999999-9999-4999-8999-999999999942
-- pay_other:   99999999-9999-4999-8999-999999999943

delete from auth.users
where id = '99999999-9999-4999-8999-999999999901'::uuid;

insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  '99999999-9999-4999-8999-999999999901'::uuid,
  'authenticated', 'authenticated', 'task7-pending-unique@example.com',
  crypt('test-password', gen_salt('bf')), now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Task7 Pending Unique User'),
  now(), now(), '', '', '', ''
);

insert into public.listings (id, type, status, title, slug, city, price, currency)
values (
  '99999999-9999-4999-8999-999999999911'::uuid,
  'rent',
  'active',
  'Task7 Pending Unique Listing',
  'task7-pending-unique-listing',
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
  '99999999-9999-4999-8999-999999999921'::uuid,
  '99999999-9999-4999-8999-999999999911'::uuid,
  '99999999-9999-4999-8999-999999999901'::uuid,
  current_date + 10,
  6,
  1,
  'pending'
);

insert into public.orders (
  id, reservation_id, user_id, total_amount, currency, status
)
values (
  '99999999-9999-4999-8999-999999999931'::uuid,
  '99999999-9999-4999-8999-999999999921'::uuid,
  '99999999-9999-4999-8999-999999999901'::uuid,
  10000,
  'TRY',
  'pending'
);

insert into public.payments (
  id, order_id, user_id, amount, currency, status, provider
)
values (
  '99999999-9999-4999-8999-999999999941'::uuid,
  '99999999-9999-4999-8999-999999999931'::uuid,
  '99999999-9999-4999-8999-999999999901'::uuid,
  10000,
  'TRY',
  'pending',
  'isbank'
);

-- TEST 1: second pending isbank payment for same order must fail.
do $$
begin
  begin
    insert into public.payments (
      order_id, user_id, amount, currency, status, provider
    )
    values (
      '99999999-9999-4999-8999-999999999931'::uuid,
      '99999999-9999-4999-8999-999999999901'::uuid,
      10000,
      'TRY',
      'pending',
      'isbank'
    );
    raise exception 'TEST 1 FAILED: second pending isbank payment was inserted';
  exception
    when unique_violation then
      null;
  end;
end;
$$;

-- TEST 2: terminal status payment for same order is allowed.
insert into public.payments (
  id, order_id, user_id, amount, currency, status, provider
)
values (
  '99999999-9999-4999-8999-999999999942'::uuid,
  '99999999-9999-4999-8999-999999999931'::uuid,
  '99999999-9999-4999-8999-999999999901'::uuid,
  10000,
  'TRY',
  'succeeded',
  'isbank'
);

-- TEST 3: pending payment for other provider is allowed.
insert into public.payments (
  id, order_id, user_id, amount, currency, status, provider
)
values (
  '99999999-9999-4999-8999-999999999943'::uuid,
  '99999999-9999-4999-8999-999999999931'::uuid,
  '99999999-9999-4999-8999-999999999901'::uuid,
  10000,
  'TRY',
  'pending',
  'manual'
);

delete from public.payments where id in (
  '99999999-9999-4999-8999-999999999941'::uuid,
  '99999999-9999-4999-8999-999999999942'::uuid,
  '99999999-9999-4999-8999-999999999943'::uuid
);
delete from public.orders where id = '99999999-9999-4999-8999-999999999931'::uuid;
delete from public.reservations where id = '99999999-9999-4999-8999-999999999921'::uuid;
delete from public.listings where id = '99999999-9999-4999-8999-999999999911'::uuid;
delete from auth.users where id = '99999999-9999-4999-8999-999999999901'::uuid;

select 'phase1_task7_single_pending_isbank_payment_ok' as result;
