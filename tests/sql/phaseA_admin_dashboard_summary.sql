\set ON_ERROR_STOP on

delete from public.admin_workflow_events
where id = '55555555-6666-4666-8666-666666666901'::uuid;

delete from public.listings
where id = 'cccccccc-dddd-4ddd-8ddd-ddddddddd901'::uuid;

delete from auth.users
where id in (
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb901'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb902'::uuid
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
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb901'::uuid,
  'authenticated',
  'authenticated',
  'phaseA-admin@example.com',
  crypt('test-password', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'PhaseA Admin'),
  now(),
  now(),
  '',
  '',
  '',
  ''
),
(
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb902'::uuid,
  'authenticated',
  'authenticated',
  'phaseA-user@example.com',
  crypt('test-password', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'PhaseA User'),
  now(),
  now(),
  '',
  '',
  '',
  ''
);

update public.profiles
set role = 'admin'
where id = 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb901'::uuid;

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
values (
  'cccccccc-dddd-4ddd-8ddd-ddddddddd901'::uuid,
  'rent',
  'passive',
  'Phase A Dashboard Summary Listing',
  'phase-a-dashboard-summary-listing',
  'Istanbul',
  35000,
  'TRY'
);

insert into public.admin_workflow_events (
  id,
  workflow_name,
  admin_user_id,
  listing_id,
  reason,
  note,
  payload
)
values (
  '55555555-6666-4666-8666-666666666901'::uuid,
  'admin_reopen_listing_rejected',
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb901'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd901'::uuid,
  'dashboard_summary_test',
  'dashboard summary sql regression fixture',
  '{}'::jsonb
);

select set_config(
  'app.phaseA_expected_manual_resolution_required',
  (
    select count(*)::text
    from public.admin_workflow_events
    where workflow_name in (
      'admin_cancel_reservation_rejected',
      'admin_confirm_reservation_rejected',
      'admin_reopen_listing_rejected'
    )
  ),
  false
);

set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb902', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
begin
  begin
    perform public.admin_dashboard_summary();
    raise exception 'TEST FAILED: non-admin should not call admin_dashboard_summary';
  exception
    when insufficient_privilege then null;
    when sqlstate '42501' then null;
  end;
end;
$$;

reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb901', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
declare
  v_direct_read_blocked boolean := false;
  v_visible_count integer := 0;
  v_summary jsonb;
  v_expected integer;
begin
  begin
    select count(*) into v_visible_count
    from public.admin_workflow_events;
  exception
    when insufficient_privilege then
      v_direct_read_blocked := true;
    when others then
      if sqlstate = '42501' then
        v_direct_read_blocked := true;
      else
        raise;
      end if;
  end;

  if not v_direct_read_blocked and v_visible_count <> 0 then
    raise exception 'TEST FAILED: direct admin_workflow_events read should stay blocked, got %', v_visible_count;
  end if;

  v_summary := public.admin_dashboard_summary();
  v_expected := current_setting('app.phaseA_expected_manual_resolution_required')::integer;

  if not (v_summary ? 'listing_total')
     or not (v_summary ? 'listing_active')
     or not (v_summary ? 'listing_passive')
     or not (v_summary ? 'listing_without_images')
     or not (v_summary ? 'rent_listings_not_checkout_ready')
     or not (v_summary ? 'pending_reservations')
     or not (v_summary ? 'failed_or_conflict_payments')
     or not (v_summary ? 'manual_resolution_required')
     or not (v_summary ? 'communication_items') then
    raise exception 'TEST FAILED: admin_dashboard_summary shape invalid: %', v_summary;
  end if;

  if (v_summary ->> 'manual_resolution_required')::integer <> v_expected then
    raise exception 'TEST FAILED: expected manual_resolution_required %, got %', v_expected, v_summary ->> 'manual_resolution_required';
  end if;

  if jsonb_typeof(v_summary -> 'communication_items') <> 'null' then
    raise exception 'TEST FAILED: communication_items should remain null until a secure read model exists, got %', v_summary;
  end if;
end;
$$;

reset role;

select 'phaseA_admin_dashboard_summary_ok' as result;
