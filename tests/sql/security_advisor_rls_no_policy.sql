\set ON_ERROR_STOP on

-- Supabase security advisor cache keys covered by this contract:
-- rls_enabled_no_policy_public_admin_workflow_events
-- rls_enabled_no_policy_public_payment_callback_receipts
-- rls_enabled_no_policy_public_payment_events

do $$
declare
  v_table regclass;
  v_table_name text;
  v_policy_count integer;
  v_open_policy_count integer;
  v_rls_enabled boolean;
begin
  foreach v_table, v_table_name in array array[
    ('public.admin_workflow_events'::regclass, 'admin_workflow_events'),
    ('public.payment_callback_receipts'::regclass, 'payment_callback_receipts'),
    ('public.payment_events'::regclass, 'payment_events')
  ]
  loop
    select c.relrowsecurity
    into v_rls_enabled
    from pg_class c
    where c.oid = v_table;

    if v_rls_enabled is not true then
      raise exception '% must keep RLS enabled', v_table::text;
    end if;

    select count(*)
    into v_policy_count
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = v_table_name;

    if v_policy_count < 1 then
      raise exception '% must have an explicit deny policy to satisfy rls_enabled_no_policy advisor', v_table::text;
    end if;

    select count(*)
    into v_open_policy_count
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = v_table_name
      and p.roles && array['anon', 'authenticated']::name[]
      and (
        coalesce(nullif(btrim(p.qual), ''), 'false') !~* '^\(?false\)?$'
        or coalesce(nullif(btrim(p.with_check), ''), 'false') !~* '^\(?false\)?$'
      );

    if v_open_policy_count <> 0 then
      raise exception '% must not have anon/authenticated policies that allow direct row access', v_table::text;
    end if;
  end loop;
end;
$$;

delete from public.payment_events
where id in (
  '99999999-aaaa-4aaa-8aaa-aaaaaaaa9911'::uuid,
  '99999999-aaaa-4aaa-8aaa-aaaaaaaa9912'::uuid
);

delete from public.admin_workflow_events
where id in (
  '99999999-aaaa-4aaa-8aaa-aaaaaaaa9921'::uuid,
  '99999999-aaaa-4aaa-8aaa-aaaaaaaa9922'::uuid
);

delete from public.payment_callback_receipts
where event_key in (
  'security-advisor-seed',
  'security-advisor-direct-admin'
);

delete from public.payments
where id = '99999999-aaaa-4aaa-8aaa-aaaaaaaa9931'::uuid;

delete from public.orders
where id = '99999999-aaaa-4aaa-8aaa-aaaaaaaa9932'::uuid;

delete from public.reservations
where id = '99999999-aaaa-4aaa-8aaa-aaaaaaaa9933'::uuid;

delete from public.listings
where id = '99999999-aaaa-4aaa-8aaa-aaaaaaaa9934'::uuid;

delete from auth.users
where id in (
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb991'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb992'::uuid
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
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb991'::uuid,
  'authenticated',
  'authenticated',
  'security-advisor-admin@example.com',
  crypt('test-password', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Security Advisor Admin'),
  now(),
  now(),
  '',
  '',
  '',
  ''
),
(
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb992'::uuid,
  'authenticated',
  'authenticated',
  'security-advisor-user@example.com',
  crypt('test-password', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Security Advisor User'),
  now(),
  now(),
  '',
  '',
  '',
  ''
);

update public.profiles
set role = 'admin'
where id = 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb991'::uuid;

insert into public.listings (id, type, status, title, slug, city, price)
values (
  '99999999-aaaa-4aaa-8aaa-aaaaaaaa9934'::uuid,
  'rent',
  'active',
  'Security Advisor RLS Listing',
  'security-advisor-rls-listing',
  'Istanbul',
  10000
);

insert into public.reservations (
  id,
  listing_id,
  user_id,
  move_in_date,
  stay_months,
  guest_count,
  status
)
values (
  '99999999-aaaa-4aaa-8aaa-aaaaaaaa9933'::uuid,
  '99999999-aaaa-4aaa-8aaa-aaaaaaaa9934'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb992'::uuid,
  current_date + 30,
  6,
  1,
  'pending'
);

insert into public.orders (id, reservation_id, user_id, total_amount, currency, status)
values (
  '99999999-aaaa-4aaa-8aaa-aaaaaaaa9932'::uuid,
  '99999999-aaaa-4aaa-8aaa-aaaaaaaa9933'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb992'::uuid,
  10000,
  'TRY',
  'pending'
);

insert into public.payments (id, order_id, user_id, amount, currency, status)
values (
  '99999999-aaaa-4aaa-8aaa-aaaaaaaa9931'::uuid,
  '99999999-aaaa-4aaa-8aaa-aaaaaaaa9932'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb992'::uuid,
  10000,
  'TRY',
  'pending'
);

insert into public.payment_callback_receipts (
  provider,
  event_key,
  payload_hash,
  content_type
)
values (
  'isbank',
  'security-advisor-seed',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'application/json'
);

insert into public.payment_events (id, payment_id, event_type, provider, payload)
values (
  '99999999-aaaa-4aaa-8aaa-aaaaaaaa9911'::uuid,
  '99999999-aaaa-4aaa-8aaa-aaaaaaaa9931'::uuid,
  'security_advisor_seed',
  'isbank',
  '{}'::jsonb
);

insert into public.admin_workflow_events (
  id,
  workflow_name,
  admin_user_id,
  listing_id,
  reason,
  payload
)
values (
  '99999999-aaaa-4aaa-8aaa-aaaaaaaa9921'::uuid,
  'security_advisor_seed',
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb991'::uuid,
  '99999999-aaaa-4aaa-8aaa-aaaaaaaa9934'::uuid,
  'security_advisor_seed',
  '{}'::jsonb
);

set role anon;
select set_config('request.jwt.claim.role', 'anon', false);

do $$
declare
  v_count integer;
begin
  begin
    select count(*) into v_count
    from public.admin_workflow_events
    where id = '99999999-aaaa-4aaa-8aaa-aaaaaaaa9921'::uuid;
    if v_count <> 0 then
      raise exception 'anon direct admin_workflow_events SELECT returned rows';
    end if;
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then
        null;
      else
        raise;
      end if;
  end;

  begin
    select count(*) into v_count
    from public.payment_callback_receipts
    where event_key = 'security-advisor-seed';
    if v_count <> 0 then
      raise exception 'anon direct payment_callback_receipts SELECT returned rows';
    end if;
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then
        null;
      else
        raise;
      end if;
  end;

  begin
    select count(*) into v_count
    from public.payment_events
    where id = '99999999-aaaa-4aaa-8aaa-aaaaaaaa9911'::uuid;
    if v_count <> 0 then
      raise exception 'anon direct payment_events SELECT returned rows';
    end if;
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then
        null;
      else
        raise;
      end if;
  end;
end;
$$;

reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb992', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
declare
  v_count integer;
begin
  begin
    select count(*) into v_count
    from public.admin_workflow_events
    where id = '99999999-aaaa-4aaa-8aaa-aaaaaaaa9921'::uuid;
    if v_count <> 0 then
      raise exception 'authenticated direct admin_workflow_events SELECT returned rows';
    end if;
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then
        null;
      else
        raise;
      end if;
  end;

  begin
    select count(*) into v_count
    from public.payment_callback_receipts
    where event_key = 'security-advisor-seed';
    if v_count <> 0 then
      raise exception 'authenticated direct payment_callback_receipts SELECT returned rows';
    end if;
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then
        null;
      else
        raise;
      end if;
  end;

  begin
    select count(*) into v_count
    from public.payment_events
    where id = '99999999-aaaa-4aaa-8aaa-aaaaaaaa9911'::uuid;
    if v_count <> 0 then
      raise exception 'authenticated direct payment_events SELECT returned rows';
    end if;
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then
        null;
      else
        raise;
      end if;
  end;
end;
$$;

reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb991', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
declare
  v_affected integer;
  v_insert_blocked boolean;
  v_update_blocked boolean;
  v_delete_blocked boolean;
begin
  v_insert_blocked := false;
  begin
    insert into public.admin_workflow_events (
      id,
      workflow_name,
      admin_user_id,
      listing_id,
      reason,
      payload
    )
    values (
      '99999999-aaaa-4aaa-8aaa-aaaaaaaa9922'::uuid,
      'security_advisor_direct_admin',
      'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb991'::uuid,
      '99999999-aaaa-4aaa-8aaa-aaaaaaaa9934'::uuid,
      'security_advisor_direct_admin',
      '{}'::jsonb
    );
  exception
    when insufficient_privilege then
      v_insert_blocked := true;
    when others then
      if sqlstate = '42501' then
        v_insert_blocked := true;
      else
        raise;
      end if;
  end;

  if not v_insert_blocked then
    raise exception 'admin direct admin_workflow_events INSERT unexpectedly succeeded';
  end if;

  v_affected := 0;
  v_update_blocked := false;
  begin
    update public.admin_workflow_events
    set reason = 'security_advisor_direct_admin_update'
    where id = '99999999-aaaa-4aaa-8aaa-aaaaaaaa9921'::uuid;
    get diagnostics v_affected = row_count;
  exception
    when insufficient_privilege then
      v_update_blocked := true;
    when others then
      if sqlstate = '42501' then
        v_update_blocked := true;
      else
        raise;
      end if;
  end;

  if not v_update_blocked and v_affected <> 0 then
    raise exception 'admin direct admin_workflow_events UPDATE affected % rows', v_affected;
  end if;

  v_affected := 0;
  v_delete_blocked := false;
  begin
    delete from public.admin_workflow_events
    where id = '99999999-aaaa-4aaa-8aaa-aaaaaaaa9921'::uuid;
    get diagnostics v_affected = row_count;
  exception
    when insufficient_privilege then
      v_delete_blocked := true;
    when others then
      if sqlstate = '42501' then
        v_delete_blocked := true;
      else
        raise;
      end if;
  end;

  if not v_delete_blocked and v_affected <> 0 then
    raise exception 'admin direct admin_workflow_events DELETE affected % rows', v_affected;
  end if;

  v_insert_blocked := false;
  begin
    insert into public.payment_callback_receipts (
      provider,
      event_key,
      payload_hash,
      content_type
    )
    values (
      'isbank',
      'security-advisor-direct-admin',
      'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
      'application/json'
    );
  exception
    when insufficient_privilege then
      v_insert_blocked := true;
    when others then
      if sqlstate = '42501' then
        v_insert_blocked := true;
      else
        raise;
      end if;
  end;

  if not v_insert_blocked then
    raise exception 'admin direct payment_callback_receipts INSERT unexpectedly succeeded';
  end if;

  v_affected := 0;
  v_update_blocked := false;
  begin
    update public.payment_callback_receipts
    set content_type = 'application/problem+json'
    where event_key = 'security-advisor-direct-admin';
    get diagnostics v_affected = row_count;
  exception
    when insufficient_privilege then
      v_update_blocked := true;
    when others then
      if sqlstate = '42501' then
        v_update_blocked := true;
      else
        raise;
      end if;
  end;

  if not v_update_blocked and v_affected <> 0 then
    raise exception 'admin direct payment_callback_receipts UPDATE affected % rows', v_affected;
  end if;

  v_affected := 0;
  v_delete_blocked := false;
  begin
    delete from public.payment_callback_receipts
    where event_key = 'security-advisor-direct-admin';
    get diagnostics v_affected = row_count;
  exception
    when insufficient_privilege then
      v_delete_blocked := true;
    when others then
      if sqlstate = '42501' then
        v_delete_blocked := true;
      else
        raise;
      end if;
  end;

  if not v_delete_blocked and v_affected <> 0 then
    raise exception 'admin direct payment_callback_receipts DELETE affected % rows', v_affected;
  end if;

  v_insert_blocked := false;
  begin
    insert into public.payment_events (id, payment_id, event_type, provider, payload)
    values (
      '99999999-aaaa-4aaa-8aaa-aaaaaaaa9912'::uuid,
      '99999999-aaaa-4aaa-8aaa-aaaaaaaa9931'::uuid,
      'security_advisor_direct_admin',
      'isbank',
      '{}'::jsonb
    );
  exception
    when insufficient_privilege then
      v_insert_blocked := true;
    when others then
      if sqlstate = '42501' then
        v_insert_blocked := true;
      else
        raise;
      end if;
  end;

  if not v_insert_blocked then
    raise exception 'admin direct payment_events INSERT unexpectedly succeeded';
  end if;

  v_affected := 0;
  v_update_blocked := false;
  begin
    update public.payment_events
    set event_type = 'security_advisor_direct_admin_update'
    where id = '99999999-aaaa-4aaa-8aaa-aaaaaaaa9911'::uuid;
    get diagnostics v_affected = row_count;
  exception
    when insufficient_privilege then
      v_update_blocked := true;
    when others then
      if sqlstate = '42501' then
        v_update_blocked := true;
      else
        raise;
      end if;
  end;

  if not v_update_blocked and v_affected <> 0 then
    raise exception 'admin direct payment_events UPDATE affected % rows', v_affected;
  end if;

  v_affected := 0;
  v_delete_blocked := false;
  begin
    delete from public.payment_events
    where id = '99999999-aaaa-4aaa-8aaa-aaaaaaaa9911'::uuid;
    get diagnostics v_affected = row_count;
  exception
    when insufficient_privilege then
      v_delete_blocked := true;
    when others then
      if sqlstate = '42501' then
        v_delete_blocked := true;
      else
        raise;
      end if;
  end;

  if not v_delete_blocked and v_affected <> 0 then
    raise exception 'admin direct payment_events DELETE affected % rows', v_affected;
  end if;
end;
$$;

reset role;

delete from public.payment_events
where id in (
  '99999999-aaaa-4aaa-8aaa-aaaaaaaa9911'::uuid,
  '99999999-aaaa-4aaa-8aaa-aaaaaaaa9912'::uuid
);

delete from public.admin_workflow_events
where id in (
  '99999999-aaaa-4aaa-8aaa-aaaaaaaa9921'::uuid,
  '99999999-aaaa-4aaa-8aaa-aaaaaaaa9922'::uuid
);

delete from public.payment_callback_receipts
where event_key in (
  'security-advisor-seed',
  'security-advisor-direct-admin'
);

delete from public.payments
where id = '99999999-aaaa-4aaa-8aaa-aaaaaaaa9931'::uuid;

delete from public.orders
where id = '99999999-aaaa-4aaa-8aaa-aaaaaaaa9932'::uuid;

delete from public.reservations
where id = '99999999-aaaa-4aaa-8aaa-aaaaaaaa9933'::uuid;

delete from public.listings
where id = '99999999-aaaa-4aaa-8aaa-aaaaaaaa9934'::uuid;

delete from auth.users
where id in (
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb991'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb992'::uuid
);

select 'security_advisor_rls_no_policy_ok' as result;
