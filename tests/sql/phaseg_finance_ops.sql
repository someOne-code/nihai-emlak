\set ON_ERROR_STOP on

-- Phase G: Finance Ops admin decisions are visible, audited, and fail closed.

delete from public.payment_events
where payment_id in (
  'a3a3a3a3-3333-4333-8333-333333333331'::uuid,
  'a3a3a3a3-3333-4333-8333-333333333332'::uuid
);

delete from public.admin_workflow_events
where reservation_id in (
  'a0a0a0a0-0000-4000-8000-000000000001'::uuid,
  'a0a0a0a0-0000-4000-8000-000000000002'::uuid,
  'a0a0a0a0-0000-4000-8000-000000000003'::uuid
);

delete from public.payment_finance_ops
where reservation_id in (
  'a0a0a0a0-0000-4000-8000-000000000001'::uuid,
  'a0a0a0a0-0000-4000-8000-000000000002'::uuid,
  'a0a0a0a0-0000-4000-8000-000000000003'::uuid
);

delete from public.payments
where id in (
  'a3a3a3a3-3333-4333-8333-333333333331'::uuid,
  'a3a3a3a3-3333-4333-8333-333333333332'::uuid
);

delete from public.orders
where id in (
  'a2a2a2a2-2222-4222-8222-222222222221'::uuid,
  'a2a2a2a2-2222-4222-8222-222222222222'::uuid,
  'a2a2a2a2-2222-4222-8222-222222222223'::uuid
);

delete from public.reservations
where id in (
  'a0a0a0a0-0000-4000-8000-000000000001'::uuid,
  'a0a0a0a0-0000-4000-8000-000000000002'::uuid,
  'a0a0a0a0-0000-4000-8000-000000000003'::uuid
);

delete from public.listings
where id in (
  'a1a1a1a1-1111-4111-8111-111111111111'::uuid,
  'a1a1a1a1-1111-4111-8111-111111111112'::uuid,
  'a1a1a1a1-1111-4111-8111-111111111113'::uuid
);

delete from auth.users
where id in (
  'abababab-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid,
  'abababab-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid
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
  'abababab-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid,
  'authenticated',
  'authenticated',
  'phaseg-admin@example.com',
  crypt('test-password', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  '{}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
),
(
  '00000000-0000-0000-0000-000000000000',
  'abababab-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid,
  'authenticated',
  'authenticated',
  'phaseg-user@example.com',
  crypt('test-password', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  '{}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
);

update public.profiles
set role = 'admin'
where id = 'abababab-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid;

insert into public.listings (id, type, status, title, slug, city, price, currency)
values (
  'a1a1a1a1-1111-4111-8111-111111111111'::uuid,
  'rent',
  'passive',
  'Phase G Finance Listing',
  'phase-g-finance-listing',
  'Istanbul',
  30000,
  'TRY'
),
(
  'a1a1a1a1-1111-4111-8111-111111111112'::uuid,
  'rent',
  'active',
  'Phase G Drift Listing',
  'phase-g-drift-listing',
  'Istanbul',
  30000,
  'TRY'
),
(
  'a1a1a1a1-1111-4111-8111-111111111113'::uuid,
  'rent',
  'active',
  'Phase G Missing Payment Listing',
  'phase-g-missing-payment-listing',
  'Istanbul',
  30000,
  'TRY'
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
values
(
  'a0a0a0a0-0000-4000-8000-000000000001'::uuid,
  'a1a1a1a1-1111-4111-8111-111111111111'::uuid,
  'abababab-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid,
  current_date + 7,
  6,
  1,
  'refund flow',
  'cancelled'
),
(
  'a0a0a0a0-0000-4000-8000-000000000002'::uuid,
  'a1a1a1a1-1111-4111-8111-111111111112'::uuid,
  'abababab-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid,
  current_date + 8,
  6,
  1,
  'amount drift flow',
  'pending'
),
(
  'a0a0a0a0-0000-4000-8000-000000000003'::uuid,
  'a1a1a1a1-1111-4111-8111-111111111113'::uuid,
  'abababab-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid,
  current_date + 9,
  6,
  1,
  'missing payment flow',
  'pending'
);

insert into public.orders (id, reservation_id, user_id, total_amount, currency, status)
values
(
  'a2a2a2a2-2222-4222-8222-222222222221'::uuid,
  'a0a0a0a0-0000-4000-8000-000000000001'::uuid,
  'abababab-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid,
  30000,
  'TRY',
  'completed'
),
(
  'a2a2a2a2-2222-4222-8222-222222222222'::uuid,
  'a0a0a0a0-0000-4000-8000-000000000002'::uuid,
  'abababab-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid,
  30000,
  'TRY',
  'completed'
),
(
  'a2a2a2a2-2222-4222-8222-222222222223'::uuid,
  'a0a0a0a0-0000-4000-8000-000000000003'::uuid,
  'abababab-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid,
  30000,
  'TRY',
  'completed'
);

insert into public.payments (id, order_id, user_id, amount, currency, status, provider, provider_ref)
values
(
  'a3a3a3a3-3333-4333-8333-333333333331'::uuid,
  'a2a2a2a2-2222-4222-8222-222222222221'::uuid,
  'abababab-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid,
  30000,
  'TRY',
  'succeeded',
  'isbank',
  'phaseg-refund'
),
(
  'a3a3a3a3-3333-4333-8333-333333333332'::uuid,
  'a2a2a2a2-2222-4222-8222-222222222222'::uuid,
  'abababab-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid,
  29999,
  'TRY',
  'succeeded',
  'isbank',
  'phaseg-drift'
);

set role authenticated;
select set_config('request.jwt.claim.sub', 'abababab-aaaa-4aaa-8aaa-aaaaaaaaaaa2', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
begin
  begin
    perform public.admin_mark_refund_required(
      'a0a0a0a0-0000-4000-8000-000000000001'::uuid,
      'regular user should fail'
    );
    raise exception 'TEST 1 FAILED: non-admin should not mark finance ops';
  exception
    when insufficient_privilege then null;
    when sqlstate '42501' then null;
  end;
end;
$$;

reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', 'abababab-aaaa-4aaa-8aaa-aaaaaaaaaaa1', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
declare
  v_result jsonb;
  v_snapshot jsonb;
  v_status text;
begin
  v_result := public.admin_mark_refund_required(
    'a0a0a0a0-0000-4000-8000-000000000001'::uuid,
    'cancelled after succeeded payment'
  );

  if v_result->>'finance_status' <> 'refund_required' then
    raise exception 'TEST 2 FAILED: expected refund_required, got %', v_result;
  end if;

  perform public.admin_mark_refund_requested(
    'a0a0a0a0-0000-4000-8000-000000000001'::uuid,
    'refund requested in bank panel'
  );

  begin
    perform public.admin_mark_refund_completed(
      'a0a0a0a0-0000-4000-8000-000000000001'::uuid,
      ''
    );
    raise exception 'TEST 2 FAILED: refund_completed should require a note';
  exception
    when sqlstate '22023' then null;
  end;

  perform public.admin_mark_refund_completed(
    'a0a0a0a0-0000-4000-8000-000000000001'::uuid,
    'bank panel shows refund complete'
  );

  select status::text into v_status
  from public.payment_finance_ops
  where payment_id = 'a3a3a3a3-3333-4333-8333-333333333331'::uuid;

  if v_status <> 'refund_completed' then
    raise exception 'TEST 2 FAILED: expected refund_completed row, got %', v_status;
  end if;

  v_snapshot := public.get_admin_reservation_finance_ops(
    'a0a0a0a0-0000-4000-8000-000000000001'::uuid
  );

  if v_snapshot->>'finance_status' <> 'refund_completed'
     or v_snapshot->>'admin_display' <> 'Admin - phaseg-admin@example.com'
     or (v_snapshot #>> '{deposit_refund_window,system_recommendation}') is null then
    raise exception 'TEST 2 FAILED: unexpected finance snapshot %', v_snapshot;
  end if;
end;
$$;

reset role;

do $$
declare
  v_workflow_count integer;
  v_payment_event_count integer;
begin
  select count(*) into v_workflow_count
  from public.admin_workflow_events
  where reservation_id = 'a0a0a0a0-0000-4000-8000-000000000001'::uuid
    and workflow_name in (
      'admin_mark_refund_required',
      'admin_mark_refund_requested',
      'admin_mark_refund_completed'
    );

  select count(*) into v_payment_event_count
  from public.payment_events
  where payment_id = 'a3a3a3a3-3333-4333-8333-333333333331'::uuid
    and event_type = 'admin_finance_ops_decision';

  if v_workflow_count <> 3 or v_payment_event_count <> 3 then
    raise exception 'TEST 2 FAILED: expected 3 workflow and payment events, got workflow=% payment=%',
      v_workflow_count,
      v_payment_event_count;
  end if;
end;
$$;

set role authenticated;
select set_config('request.jwt.claim.sub', 'abababab-aaaa-4aaa-8aaa-aaaaaaaaaaa1', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
begin
  begin
    perform public.admin_mark_deposit_forfeited(
      'a0a0a0a0-0000-4000-8000-000000000001'::uuid,
      'terminal refund should not change'
    );
    raise exception 'TEST 3 FAILED: refund_completed should be terminal';
  exception
    when sqlstate 'P0001' then null;
  end;
end;
$$;

do $$
declare
  v_snapshot jsonb;
begin
  v_snapshot := public.get_admin_reservation_finance_ops(
    'a0a0a0a0-0000-4000-8000-000000000002'::uuid
  );

  if v_snapshot #>> '{issue_flags,amount_drift}' <> 'true'
     or v_snapshot->>'recommended_status' <> 'manual_resolution_required' then
    raise exception 'TEST 4 FAILED: amount drift should be visible, got %', v_snapshot;
  end if;

  begin
    perform public.admin_mark_refund_required(
      'a0a0a0a0-0000-4000-8000-000000000002'::uuid,
      'amount drift should fail closed'
    );
    raise exception 'TEST 4 FAILED: refund_required should reject amount drift';
  exception
    when sqlstate 'P0004' then null;
  end;

  perform public.admin_mark_manual_resolution_required(
    'a0a0a0a0-0000-4000-8000-000000000002'::uuid,
    'amount drift needs manual review'
  );

  begin
    perform public.admin_mark_payment_issue_resolved(
      'a0a0a0a0-0000-4000-8000-000000000002'::uuid,
      ''
    );
    raise exception 'TEST 4 FAILED: issue_resolved should require a note';
  exception
    when sqlstate '22023' then null;
  end;

  perform public.admin_mark_payment_issue_resolved(
    'a0a0a0a0-0000-4000-8000-000000000002'::uuid,
    'accounting confirmed the payment issue is resolved'
  );

  v_snapshot := public.get_admin_reservation_finance_ops(
    'a0a0a0a0-0000-4000-8000-000000000002'::uuid
  );

  if v_snapshot->>'finance_status' <> 'issue_resolved'
     or v_snapshot->>'admin_display' <> 'Admin - phaseg-admin@example.com' then
    raise exception 'TEST 4 FAILED: expected resolved payment issue, got %', v_snapshot;
  end if;
end;
$$;

do $$
declare
  v_snapshot jsonb;
begin
  v_snapshot := public.get_admin_reservation_finance_ops(
    'a0a0a0a0-0000-4000-8000-000000000003'::uuid
  );

  if v_snapshot #>> '{issue_flags,missing_payment}' <> 'true' then
    raise exception 'TEST 5 FAILED: missing payment should be visible, got %', v_snapshot;
  end if;

  begin
    perform public.admin_mark_refund_required(
      'a0a0a0a0-0000-4000-8000-000000000003'::uuid,
      'missing payment should fail closed'
    );
    raise exception 'TEST 5 FAILED: refund_required should reject missing payment';
  exception
    when sqlstate 'P0004' then null;
  end;

  perform public.admin_mark_manual_resolution_required(
    'a0a0a0a0-0000-4000-8000-000000000003'::uuid,
    'missing payment needs manual audit'
  );

  v_snapshot := public.get_admin_reservation_finance_ops(
    'a0a0a0a0-0000-4000-8000-000000000003'::uuid
  );

  if v_snapshot->>'finance_status' <> 'manual_resolution_required'
     or v_snapshot->>'payment_id' is not null then
    raise exception 'TEST 5 FAILED: missing-payment manual resolution should persist without payment id, got %', v_snapshot;
  end if;
end;
$$;

do $$
begin
  begin
    perform public.admin_mark_refund_completed(
      'a0a0a0a0-0000-4000-8000-000000000002'::uuid,
      'should not skip refund_required and refund_requested'
    );
    raise exception 'TEST 6 FAILED: refund_completed should require refund_requested prior state';
  exception
    when sqlstate 'P0001' then null;
    when sqlstate 'P0004' then null;
  end;
end;
$$;

reset role;

delete from public.payment_events
where payment_id in (
  'a3a3a3a3-3333-4333-8333-333333333331'::uuid,
  'a3a3a3a3-3333-4333-8333-333333333332'::uuid
);

delete from public.admin_workflow_events
where reservation_id in (
  'a0a0a0a0-0000-4000-8000-000000000001'::uuid,
  'a0a0a0a0-0000-4000-8000-000000000002'::uuid,
  'a0a0a0a0-0000-4000-8000-000000000003'::uuid
);

delete from public.payment_finance_ops
where reservation_id in (
  'a0a0a0a0-0000-4000-8000-000000000001'::uuid,
  'a0a0a0a0-0000-4000-8000-000000000002'::uuid,
  'a0a0a0a0-0000-4000-8000-000000000003'::uuid
);

delete from public.payments
where id in (
  'a3a3a3a3-3333-4333-8333-333333333331'::uuid,
  'a3a3a3a3-3333-4333-8333-333333333332'::uuid
);

delete from public.orders
where id in (
  'a2a2a2a2-2222-4222-8222-222222222221'::uuid,
  'a2a2a2a2-2222-4222-8222-222222222222'::uuid,
  'a2a2a2a2-2222-4222-8222-222222222223'::uuid
);

delete from public.reservations
where id in (
  'a0a0a0a0-0000-4000-8000-000000000001'::uuid,
  'a0a0a0a0-0000-4000-8000-000000000002'::uuid,
  'a0a0a0a0-0000-4000-8000-000000000003'::uuid
);

delete from public.listings
where id in (
  'a1a1a1a1-1111-4111-8111-111111111111'::uuid,
  'a1a1a1a1-1111-4111-8111-111111111112'::uuid,
  'a1a1a1a1-1111-4111-8111-111111111113'::uuid
);

delete from auth.users
where id in (
  'abababab-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid,
  'abababab-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid
);

select 'phaseg_finance_ops_ok' as result;
