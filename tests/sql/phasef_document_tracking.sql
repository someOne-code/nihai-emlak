\set ON_ERROR_STOP on

-- Phase F: post-payment reservation document tracking workflow.

delete from public.admin_workflow_events
where reservation_id in (
  'f0f0f0f0-0000-4000-8000-000000000001'::uuid,
  'f0f0f0f0-0000-4000-8000-000000000002'::uuid
);

delete from public.reservation_document_tracking
where reservation_id in (
  'f0f0f0f0-0000-4000-8000-000000000001'::uuid,
  'f0f0f0f0-0000-4000-8000-000000000002'::uuid
);

delete from public.payment_finance_ops
where reservation_id in (
  'f0f0f0f0-0000-4000-8000-000000000001'::uuid,
  'f0f0f0f0-0000-4000-8000-000000000002'::uuid
);

delete from public.payments
where id in (
  'f3f3f3f3-3333-4333-8333-333333333331'::uuid,
  'f3f3f3f3-3333-4333-8333-333333333332'::uuid,
  'f3f3f3f3-3333-4333-8333-333333333333'::uuid
);

delete from public.orders
where id in (
  'f2f2f2f2-2222-4222-8222-222222222221'::uuid,
  'f2f2f2f2-2222-4222-8222-222222222222'::uuid
);

delete from public.reservations
where id in (
  'f0f0f0f0-0000-4000-8000-000000000001'::uuid,
  'f0f0f0f0-0000-4000-8000-000000000002'::uuid
);

delete from public.listings
where id = 'f1f1f1f1-1111-4111-8111-111111111111'::uuid;

delete from auth.users
where id in (
  'fafafafa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid,
  'fafafafa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid
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
  'fafafafa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid,
  'authenticated',
  'authenticated',
  'phasef-admin@example.com',
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
  'fafafafa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid,
  'authenticated',
  'authenticated',
  'phasef-user@example.com',
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
where id = 'fafafafa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid;

insert into public.listings (id, type, status, title, slug, city, price, currency)
values (
  'f1f1f1f1-1111-4111-8111-111111111111'::uuid,
  'rent',
  'passive',
  'Phase F Document Listing',
  'phase-f-document-listing',
  'Istanbul',
  28000,
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
  'f0f0f0f0-0000-4000-8000-000000000001'::uuid,
  'f1f1f1f1-1111-4111-8111-111111111111'::uuid,
  'fafafafa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid,
  current_date + 7,
  6,
  1,
  'document tracking happy path',
  'pending'
),
(
  'f0f0f0f0-0000-4000-8000-000000000002'::uuid,
  'f1f1f1f1-1111-4111-8111-111111111111'::uuid,
  'fafafafa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid,
  current_date + 9,
  6,
  1,
  'document tracking terminal guard',
  'cancelled'
);

insert into public.orders (id, reservation_id, user_id, total_amount, currency, status)
values
(
  'f2f2f2f2-2222-4222-8222-222222222221'::uuid,
  'f0f0f0f0-0000-4000-8000-000000000001'::uuid,
  'fafafafa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid,
  28000,
  'TRY',
  'completed'
),
(
  'f2f2f2f2-2222-4222-8222-222222222222'::uuid,
  'f0f0f0f0-0000-4000-8000-000000000002'::uuid,
  'fafafafa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid,
  28000,
  'TRY',
  'completed'
);

insert into public.payments (id, order_id, user_id, amount, currency, status, provider, provider_ref)
values
(
  'f3f3f3f3-3333-4333-8333-333333333333'::uuid,
  'f2f2f2f2-2222-4222-8222-222222222221'::uuid,
  'fafafafa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid,
  28000,
  'TRY',
  'failed',
  'isbank',
  'phasef-doc-failed-history'
),
(
  'f3f3f3f3-3333-4333-8333-333333333331'::uuid,
  'f2f2f2f2-2222-4222-8222-222222222221'::uuid,
  'fafafafa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid,
  28000,
  'TRY',
  'succeeded',
  'isbank',
  'phasef-doc-1'
),
(
  'f3f3f3f3-3333-4333-8333-333333333332'::uuid,
  'f2f2f2f2-2222-4222-8222-222222222222'::uuid,
  'fafafafa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid,
  28000,
  'TRY',
  'succeeded',
  'isbank',
  'phasef-doc-2'
);

set role authenticated;
select set_config('request.jwt.claim.sub', 'fafafafa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
begin
  begin
    perform public.admin_request_documents(
      'f0f0f0f0-0000-4000-8000-000000000001'::uuid,
      'regular user should fail'
    );
    raise exception 'TEST 1 FAILED: non-admin should not request documents';
  exception
    when insufficient_privilege then null;
    when sqlstate '42501' then null;
  end;
end;
$$;

reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', 'fafafafa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
declare
  v_result jsonb;
  v_snapshot jsonb;
  v_status text;
  v_reservation_status text;
  v_order_status text;
  v_listing_status text;
begin
  v_result := public.admin_request_documents(
    'f0f0f0f0-0000-4000-8000-000000000001'::uuid,
    'identity and contract requested'
  );

  if v_result->>'document_status' <> 'requested' then
    raise exception 'TEST 2 FAILED: expected requested result, got %', v_result;
  end if;

  if v_result->>'payment_id' <> 'f3f3f3f3-3333-4333-8333-333333333331' then
    raise exception 'TEST 2 FAILED: expected succeeded payment id despite failed history, got %', v_result;
  end if;

  select status::text into v_status
  from public.reservation_document_tracking
  where reservation_id = 'f0f0f0f0-0000-4000-8000-000000000001'::uuid;

  if v_status <> 'requested' then
    raise exception 'TEST 2 FAILED: expected requested row, got %', v_status;
  end if;

  perform public.admin_mark_documents_waiting(
    'f0f0f0f0-0000-4000-8000-000000000001'::uuid,
    'waiting customer upload'
  );

end;
$$;

reset role;

insert into public.payment_finance_ops (
  payment_id,
  order_id,
  reservation_id,
  status,
  admin_note,
  last_admin_user_id
)
values (
  'f3f3f3f3-3333-4333-8333-333333333331'::uuid,
  'f2f2f2f2-2222-4222-8222-222222222221'::uuid,
  'f0f0f0f0-0000-4000-8000-000000000001'::uuid,
  'refund_required'::public.finance_ops_status,
  'open refund blocks documents',
  'fafafafa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid
);

set role authenticated;
select set_config('request.jwt.claim.sub', 'fafafafa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
declare
  v_blocked boolean := false;
begin
  begin
    perform public.admin_mark_documents_completed(
      'f0f0f0f0-0000-4000-8000-000000000001'::uuid,
      'documents verified while finance open'
    );
  exception
    when sqlstate 'P0001' then
      v_blocked := true;
  end;

  if not v_blocked then
    raise exception 'TEST 2A FAILED: open refund_required finance status should block document completion';
  end if;
end;
$$;

reset role;

update public.payment_finance_ops
set
  status = 'issue_resolved'::public.finance_ops_status,
  admin_note = 'closed finance work should not block',
  updated_at = now()
where reservation_id = 'f0f0f0f0-0000-4000-8000-000000000001'::uuid;

set role authenticated;
select set_config('request.jwt.claim.sub', 'fafafafa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
declare
  v_snapshot jsonb;
  v_reservation_status text;
  v_order_status text;
  v_listing_status text;
begin
  perform public.admin_mark_documents_completed(
    'f0f0f0f0-0000-4000-8000-000000000001'::uuid,
    'documents verified'
  );

  v_snapshot := public.get_admin_reservation_documents(
    'f0f0f0f0-0000-4000-8000-000000000001'::uuid
  );

  if v_snapshot->>'document_status' <> 'completed'
     or v_snapshot->>'status_label' <> 'Tamamlandi'
     or v_snapshot->>'admin_note' <> 'documents verified' then
    raise exception 'TEST 2 FAILED: unexpected document snapshot %', v_snapshot;
  end if;

  select status::text into v_reservation_status
  from public.reservations
  where id = 'f0f0f0f0-0000-4000-8000-000000000001'::uuid;

  select status::text into v_order_status
  from public.orders
  where id = 'f2f2f2f2-2222-4222-8222-222222222221'::uuid;

  select status::text into v_listing_status
  from public.listings
  where id = 'f1f1f1f1-1111-4111-8111-111111111111'::uuid;

  if v_reservation_status <> 'confirmed'
     or v_order_status <> 'completed'
     or v_listing_status <> 'passive' then
    raise exception 'TEST 2 FAILED: document completion must finalize contract, got reservation %, order %, listing %',
      v_reservation_status, v_order_status, v_listing_status;
  end if;

end;
$$;

reset role;

do $$
declare
  v_event_count integer;
begin
  select count(*) into v_event_count
  from public.admin_workflow_events
  where reservation_id = 'f0f0f0f0-0000-4000-8000-000000000001'::uuid
    and workflow_name in (
      'admin_request_documents',
      'admin_mark_documents_waiting',
      'admin_mark_documents_completed'
    );

  if v_event_count <> 3 then
    raise exception 'TEST 2 FAILED: expected three document events, got %', v_event_count;
  end if;
end;
$$;

set role authenticated;
select set_config('request.jwt.claim.sub', 'fafafafa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
declare
  v_status text;
begin
  begin
    perform public.admin_mark_documents_failed(
      'f0f0f0f0-0000-4000-8000-000000000001'::uuid,
      'should not reopen completed document flow'
    );
    raise exception 'TEST 3 FAILED: completed document flow should be terminal';
  exception
    when sqlstate 'P0001' then null;
  end;

  select status::text into v_status
  from public.reservation_document_tracking
  where reservation_id = 'f0f0f0f0-0000-4000-8000-000000000001'::uuid;

  if v_status <> 'completed' then
    raise exception 'TEST 3 FAILED: failed transition changed status to %', v_status;
  end if;
end;
$$;

do $$
begin
  begin
    perform public.admin_request_documents(
      'f0f0f0f0-0000-4000-8000-000000000002'::uuid,
      'terminal reservations are denied'
    );
    raise exception 'TEST 4 FAILED: terminal reservation should deny document tracking';
  exception
    when sqlstate 'P0001' then null;
  end;
end;
$$;

reset role;

delete from public.admin_workflow_events
where reservation_id in (
  'f0f0f0f0-0000-4000-8000-000000000001'::uuid,
  'f0f0f0f0-0000-4000-8000-000000000002'::uuid
);

delete from public.reservation_document_tracking
where reservation_id in (
  'f0f0f0f0-0000-4000-8000-000000000001'::uuid,
  'f0f0f0f0-0000-4000-8000-000000000002'::uuid
);

delete from public.payment_finance_ops
where reservation_id in (
  'f0f0f0f0-0000-4000-8000-000000000001'::uuid,
  'f0f0f0f0-0000-4000-8000-000000000002'::uuid
);

delete from public.payments
where id in (
  'f3f3f3f3-3333-4333-8333-333333333331'::uuid,
  'f3f3f3f3-3333-4333-8333-333333333332'::uuid,
  'f3f3f3f3-3333-4333-8333-333333333333'::uuid
);

delete from public.orders
where id in (
  'f2f2f2f2-2222-4222-8222-222222222221'::uuid,
  'f2f2f2f2-2222-4222-8222-222222222222'::uuid
);

delete from public.reservations
where id in (
  'f0f0f0f0-0000-4000-8000-000000000001'::uuid,
  'f0f0f0f0-0000-4000-8000-000000000002'::uuid
);

delete from public.listings
where id = 'f1f1f1f1-1111-4111-8111-111111111111'::uuid;

delete from auth.users
where id in (
  'fafafafa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid,
  'fafafafa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid
);

select 'phasef_document_tracking_ok' as result;
