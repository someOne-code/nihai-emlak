\set ON_ERROR_STOP on

-- Phase 1 / Task 6.5:
-- Isbank checkout init contract => payments.provider_ref must always equal payments.id.

-- Deterministic ids
-- user:        77777777-7777-4777-8777-777777777701
-- listing:     77777777-7777-4777-8777-777777777711
-- reservation: 77777777-7777-4777-8777-777777777721
-- order:       77777777-7777-4777-8777-777777777731
-- pay_a:       77777777-7777-4777-8777-777777777741
-- pay_b:       77777777-7777-4777-8777-777777777742
-- pay_c:       77777777-7777-4777-8777-777777777743

delete from auth.users
where id = '77777777-7777-4777-8777-777777777701'::uuid;

insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  '77777777-7777-4777-8777-777777777701'::uuid,
  'authenticated', 'authenticated', 'task6-oid@example.com',
  crypt('test-password', gen_salt('bf')), now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Task6 OID User'),
  now(), now(), '', '', '', ''
);

delete from public.listings
where id = '77777777-7777-4777-8777-777777777711'::uuid;

insert into public.listings (id, type, status, title, slug, city, price, currency)
values (
  '77777777-7777-4777-8777-777777777711'::uuid,
  'rent',
  'active',
  'Task6 OID Listing',
  'task6-oid-listing',
  'Istanbul',
  10000,
  'TRY'
);

delete from public.reservations
where id = '77777777-7777-4777-8777-777777777721'::uuid;

insert into public.reservations (
  id, listing_id, user_id, move_in_date, stay_months, guest_count, status
)
values (
  '77777777-7777-4777-8777-777777777721'::uuid,
  '77777777-7777-4777-8777-777777777711'::uuid,
  '77777777-7777-4777-8777-777777777701'::uuid,
  current_date + 20,
  6,
  1,
  'pending'
);

delete from public.orders
where id = '77777777-7777-4777-8777-777777777731'::uuid;

insert into public.orders (id, reservation_id, user_id, total_amount, currency, status)
values (
  '77777777-7777-4777-8777-777777777731'::uuid,
  '77777777-7777-4777-8777-777777777721'::uuid,
  '77777777-7777-4777-8777-777777777701'::uuid,
  10000,
  'TRY',
  'pending'
);

-- TEST 1: isbank insert without provider_ref => provider_ref becomes id
insert into public.payments (id, order_id, user_id, amount, currency, status, provider)
values (
  '77777777-7777-4777-8777-777777777741'::uuid,
  '77777777-7777-4777-8777-777777777731'::uuid,
  '77777777-7777-4777-8777-777777777701'::uuid,
  10000,
  'TRY',
  'pending',
  'isbank'
);

do $$
declare
  v_provider_ref text;
begin
  select provider_ref into v_provider_ref
  from public.payments
  where id = '77777777-7777-4777-8777-777777777741'::uuid;

  if v_provider_ref <> '77777777-7777-4777-8777-777777777741' then
    raise exception 'TEST 1 FAILED: provider_ref must equal payment.id, got %', v_provider_ref;
  end if;
end;
$$;

-- TEST 2: isbank insert with wrong provider_ref => overridden to id
insert into public.payments (
  id, order_id, user_id, amount, currency, status, provider, provider_ref
)
values (
  '77777777-7777-4777-8777-777777777742'::uuid,
  '77777777-7777-4777-8777-777777777731'::uuid,
  '77777777-7777-4777-8777-777777777701'::uuid,
  10000,
  'TRY',
  'succeeded',
  'isbank',
  'WRONG-REF'
);

do $$
declare
  v_provider_ref text;
begin
  select provider_ref into v_provider_ref
  from public.payments
  where id = '77777777-7777-4777-8777-777777777742'::uuid;

  if v_provider_ref <> '77777777-7777-4777-8777-777777777742' then
    raise exception 'TEST 2 FAILED: trigger must override provider_ref to payment.id, got %', v_provider_ref;
  end if;
end;
$$;

-- TEST 3: non-isbank provider keeps explicit provider_ref
insert into public.payments (
  id, order_id, user_id, amount, currency, status, provider, provider_ref
)
values (
  '77777777-7777-4777-8777-777777777743'::uuid,
  '77777777-7777-4777-8777-777777777731'::uuid,
  '77777777-7777-4777-8777-777777777701'::uuid,
  10000,
  'TRY',
  'pending',
  'otherbank',
  'EXT-REF-123'
);

do $$
declare
  v_provider_ref text;
begin
  select provider_ref into v_provider_ref
  from public.payments
  where id = '77777777-7777-4777-8777-777777777743'::uuid;

  if v_provider_ref <> 'EXT-REF-123' then
    raise exception 'TEST 3 FAILED: non-isbank provider_ref must stay unchanged, got %', v_provider_ref;
  end if;
end;
$$;

-- Cleanup
delete from public.payments where id in (
  '77777777-7777-4777-8777-777777777741'::uuid,
  '77777777-7777-4777-8777-777777777742'::uuid,
  '77777777-7777-4777-8777-777777777743'::uuid
);
delete from public.orders where id = '77777777-7777-4777-8777-777777777731'::uuid;
delete from public.reservations where id = '77777777-7777-4777-8777-777777777721'::uuid;
delete from public.listings where id = '77777777-7777-4777-8777-777777777711'::uuid;
delete from auth.users where id = '77777777-7777-4777-8777-777777777701'::uuid;

select 'phase1_task6_isbank_oid_contract_ok' as result;
