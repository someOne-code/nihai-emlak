\set ON_ERROR_STOP on

-- Phase 1 / Task 7 hardening: payment invariant tests for process_payment_checkout.

-- Deterministic ids
-- user:             77777777-7777-4777-8777-777777777901
-- other_user:       77777777-7777-4777-8777-777777777902
-- listing_failed:   77777777-7777-4777-8777-777777777911
-- listing_provider: 77777777-7777-4777-8777-777777777912
-- listing_oid:      77777777-7777-4777-8777-777777777913
-- listing_owner:    77777777-7777-4777-8777-777777777914
-- listing_amount:   77777777-7777-4777-8777-777777777915
-- reservation_*:    77777777-7777-4777-8777-77777777792x
-- order_*:          77777777-7777-4777-8777-77777777793x
-- payment_*:        77777777-7777-4777-8777-77777777794x

delete from auth.users
where id in (
  '77777777-7777-4777-8777-777777777901'::uuid,
  '77777777-7777-4777-8777-777777777902'::uuid
);

insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  '77777777-7777-4777-8777-777777777901'::uuid,
  'authenticated', 'authenticated', 'task7-hardening@example.com',
  crypt('test-password', gen_salt('bf')), now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Task7 Hardening User'),
  now(), now(), '', '', '', ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '77777777-7777-4777-8777-777777777902'::uuid,
  'authenticated', 'authenticated', 'task7-hardening-other@example.com',
  crypt('test-password', gen_salt('bf')), now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Task7 Hardening Other User'),
  now(), now(), '', '', '', ''
);

insert into public.listings (id, type, status, title, slug, city, price, currency)
values
(
  '77777777-7777-4777-8777-777777777911'::uuid, 'rent', 'active',
  'Task7 Invariant Failed Listing', 'task7-invariant-failed-listing', 'Istanbul', 15000, 'TRY'
),
(
  '77777777-7777-4777-8777-777777777912'::uuid, 'rent', 'active',
  'Task7 Invariant Provider Listing', 'task7-invariant-provider-listing', 'Ankara', 12000, 'TRY'
),
(
  '77777777-7777-4777-8777-777777777913'::uuid, 'rent', 'active',
  'Task7 Invariant Oid Listing', 'task7-invariant-oid-listing', 'Izmir', 11000, 'TRY'
),
(
  '77777777-7777-4777-8777-777777777914'::uuid, 'rent', 'active',
  'Task7 Invariant Owner Listing', 'task7-invariant-owner-listing', 'Istanbul', 13000, 'TRY'
),
(
  '77777777-7777-4777-8777-777777777915'::uuid, 'rent', 'active',
  'Task7 Invariant Amount Listing', 'task7-invariant-amount-listing', 'Istanbul', 14000, 'TRY'
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
  '77777777-7777-4777-8777-777777777921'::uuid,
  '77777777-7777-4777-8777-777777777911'::uuid,
  '77777777-7777-4777-8777-777777777901'::uuid,
  current_date + 15, 6, 1, 'pending'
),
(
  '77777777-7777-4777-8777-777777777922'::uuid,
  '77777777-7777-4777-8777-777777777912'::uuid,
  '77777777-7777-4777-8777-777777777901'::uuid,
  current_date + 20, 6, 1, 'pending'
),
(
  '77777777-7777-4777-8777-777777777923'::uuid,
  '77777777-7777-4777-8777-777777777913'::uuid,
  '77777777-7777-4777-8777-777777777901'::uuid,
  current_date + 25, 6, 1, 'pending'
),
(
  '77777777-7777-4777-8777-777777777924'::uuid,
  '77777777-7777-4777-8777-777777777914'::uuid,
  '77777777-7777-4777-8777-777777777901'::uuid,
  current_date + 25, 6, 1, 'pending'
),
(
  '77777777-7777-4777-8777-777777777925'::uuid,
  '77777777-7777-4777-8777-777777777915'::uuid,
  '77777777-7777-4777-8777-777777777901'::uuid,
  current_date + 25, 6, 1, 'pending'
);

insert into public.orders (id, reservation_id, user_id, total_amount, currency, status)
values
(
  '77777777-7777-4777-8777-777777777931'::uuid,
  '77777777-7777-4777-8777-777777777921'::uuid,
  '77777777-7777-4777-8777-777777777901'::uuid,
  15000, 'TRY', 'pending'
),
(
  '77777777-7777-4777-8777-777777777932'::uuid,
  '77777777-7777-4777-8777-777777777922'::uuid,
  '77777777-7777-4777-8777-777777777901'::uuid,
  12000, 'TRY', 'pending'
),
(
  '77777777-7777-4777-8777-777777777933'::uuid,
  '77777777-7777-4777-8777-777777777923'::uuid,
  '77777777-7777-4777-8777-777777777901'::uuid,
  11000, 'TRY', 'pending'
),
(
  '77777777-7777-4777-8777-777777777934'::uuid,
  '77777777-7777-4777-8777-777777777924'::uuid,
  '77777777-7777-4777-8777-777777777901'::uuid,
  13000, 'TRY', 'pending'
),
(
  '77777777-7777-4777-8777-777777777935'::uuid,
  '77777777-7777-4777-8777-777777777925'::uuid,
  '77777777-7777-4777-8777-777777777901'::uuid,
  14000, 'TRY', 'pending'
);

insert into public.payments (id, order_id, user_id, amount, currency, status, provider, provider_ref)
values
(
  '77777777-7777-4777-8777-777777777941'::uuid,
  '77777777-7777-4777-8777-777777777931'::uuid,
  '77777777-7777-4777-8777-777777777901'::uuid,
  15000, 'TRY', 'failed', 'isbank', null
),
(
  '77777777-7777-4777-8777-777777777942'::uuid,
  '77777777-7777-4777-8777-777777777932'::uuid,
  '77777777-7777-4777-8777-777777777901'::uuid,
  12000, 'TRY', 'pending', 'manual', 'MANUAL-REF-942'
),
(
  '77777777-7777-4777-8777-777777777943'::uuid,
  '77777777-7777-4777-8777-777777777933'::uuid,
  '77777777-7777-4777-8777-777777777901'::uuid,
  11000, 'TRY', 'pending', 'isbank', null
),
(
  '77777777-7777-4777-8777-777777777944'::uuid,
  '77777777-7777-4777-8777-777777777934'::uuid,
  '77777777-7777-4777-8777-777777777902'::uuid,
  13000, 'TRY', 'pending', 'isbank', null
),
(
  '77777777-7777-4777-8777-777777777945'::uuid,
  '77777777-7777-4777-8777-777777777935'::uuid,
  '77777777-7777-4777-8777-777777777901'::uuid,
  999, 'TRY', 'pending', 'isbank', null
);

-- TEST 1: terminal payment statuses must not transition to succeeded.
do $$
declare
  v_result jsonb;
  v_payment_status public.payment_status;
  v_order_status public.order_status;
  v_reservation_status public.reservation_status;
  v_listing_status public.listing_status;
begin
  v_result := public.process_payment_checkout(
    '77777777-7777-4777-8777-777777777941'::uuid,
    'isbank_callback_approved',
    '77777777-7777-4777-8777-777777777941',
    '{"source":"task7-invariant-failed"}'::jsonb
  );

  if v_result->>'result' <> 'conflict' then
    raise exception 'TEST 1 FAILED: expected conflict for failed payment, got %', v_result;
  end if;

  select status into v_payment_status
  from public.payments where id = '77777777-7777-4777-8777-777777777941'::uuid;
  select status into v_order_status
  from public.orders where id = '77777777-7777-4777-8777-777777777931'::uuid;
  select status into v_reservation_status
  from public.reservations where id = '77777777-7777-4777-8777-777777777921'::uuid;
  select status into v_listing_status
  from public.listings where id = '77777777-7777-4777-8777-777777777911'::uuid;

  if v_payment_status <> 'failed'
     or v_order_status <> 'pending'
     or v_reservation_status <> 'pending'
     or v_listing_status <> 'active' then
    raise exception
      'TEST 1 FAILED: terminal-state mismatch payment=% order=% reservation=% listing=%',
      v_payment_status, v_order_status, v_reservation_status, v_listing_status;
  end if;
end;
$$;

-- TEST 2: non-isbank providers must be rejected.
do $$
begin
  begin
    perform public.process_payment_checkout(
      '77777777-7777-4777-8777-777777777942'::uuid,
      'isbank_callback_approved',
      'MANUAL-REF-942',
      '{"source":"task7-invariant-provider"}'::jsonb
    );
    raise exception 'TEST 2 FAILED: unsupported provider should raise exception';
  exception
    when sqlstate '22023' then
      if position('unsupported payment provider' in SQLERRM) = 0 then
        raise;
      end if;
  end;
end;
$$;

-- TEST 3: signed provider_ref argument must match payment.provider_ref contract.
do $$
begin
  begin
    perform public.process_payment_checkout(
      '77777777-7777-4777-8777-777777777943'::uuid,
      'isbank_callback_approved',
      'MISMATCHED-OID-943',
      '{"source":"task7-invariant-provider-ref"}'::jsonb
    );
    raise exception 'TEST 3 FAILED: mismatched provider_ref should raise exception';
  exception
    when sqlstate '22023' then
      if position('provider_ref mismatch' in SQLERRM) = 0 then
        raise;
      end if;
  end;
end;
$$;

-- TEST 4: payment/order/reservation ownership mismatch must fail closed.
do $$
begin
  begin
    perform public.process_payment_checkout(
      '77777777-7777-4777-8777-777777777944'::uuid,
      'isbank_callback_approved',
      '77777777-7777-4777-8777-777777777944',
      '{"source":"task7-invariant-owner"}'::jsonb
    );
    raise exception 'TEST 4 FAILED: ownership mismatch should raise exception';
  exception
    when sqlstate '22023' then
      if position('payment ownership invariant violated' in SQLERRM) = 0 then
        raise;
      end if;
  end;
end;
$$;

-- TEST 5: payment amount/currency must match the parent order before state transition.
do $$
begin
  begin
    perform public.process_payment_checkout(
      '77777777-7777-4777-8777-777777777945'::uuid,
      'isbank_callback_approved',
      '77777777-7777-4777-8777-777777777945',
      '{"source":"task7-invariant-amount"}'::jsonb
    );
    raise exception 'TEST 5 FAILED: amount mismatch should raise exception';
  exception
    when sqlstate '22023' then
      if position('payment amount invariant violated' in SQLERRM) = 0 then
        raise;
      end if;
  end;
end;
$$;

-- Cleanup
delete from public.payment_events where payment_id in (
  '77777777-7777-4777-8777-777777777941'::uuid,
  '77777777-7777-4777-8777-777777777942'::uuid,
  '77777777-7777-4777-8777-777777777943'::uuid,
  '77777777-7777-4777-8777-777777777944'::uuid,
  '77777777-7777-4777-8777-777777777945'::uuid
);
delete from public.payments where id in (
  '77777777-7777-4777-8777-777777777941'::uuid,
  '77777777-7777-4777-8777-777777777942'::uuid,
  '77777777-7777-4777-8777-777777777943'::uuid,
  '77777777-7777-4777-8777-777777777944'::uuid,
  '77777777-7777-4777-8777-777777777945'::uuid
);
delete from public.orders where id in (
  '77777777-7777-4777-8777-777777777931'::uuid,
  '77777777-7777-4777-8777-777777777932'::uuid,
  '77777777-7777-4777-8777-777777777933'::uuid,
  '77777777-7777-4777-8777-777777777934'::uuid,
  '77777777-7777-4777-8777-777777777935'::uuid
);
delete from public.reservations where id in (
  '77777777-7777-4777-8777-777777777921'::uuid,
  '77777777-7777-4777-8777-777777777922'::uuid,
  '77777777-7777-4777-8777-777777777923'::uuid,
  '77777777-7777-4777-8777-777777777924'::uuid,
  '77777777-7777-4777-8777-777777777925'::uuid
);
delete from public.listings where id in (
  '77777777-7777-4777-8777-777777777911'::uuid,
  '77777777-7777-4777-8777-777777777912'::uuid,
  '77777777-7777-4777-8777-777777777913'::uuid,
  '77777777-7777-4777-8777-777777777914'::uuid,
  '77777777-7777-4777-8777-777777777915'::uuid
);
delete from auth.users where id in (
  '77777777-7777-4777-8777-777777777901'::uuid,
  '77777777-7777-4777-8777-777777777902'::uuid
);

select 'phase1_task7_payment_state_invariants_ok' as result;
