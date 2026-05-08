\set ON_ERROR_STOP on

-- deterministic test users
-- admin candidate
-- 11111111-1111-1111-1111-111111111111
-- normal user
-- 22222222-2222-2222-2222-222222222222

-- clean stale test users
delete from auth.users
where id in (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid
);

-- seed two auth users
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
values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111'::uuid,
  'authenticated',
  'authenticated',
  'task2-security-admin@example.com',
  crypt('test-password', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Task2 Security Admin'),
  now(),
  now(),
  '',
  '',
  '',
  ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '22222222-2222-2222-2222-222222222222'::uuid,
  'authenticated',
  'authenticated',
  'task2-security-user@example.com',
  crypt('test-password', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Task2 Security User'),
  now(),
  now(),
  '',
  '',
  '',
  ''
);

-- trigger should create two profiles
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.profiles
  where id in (
    '11111111-1111-1111-1111-111111111111'::uuid,
    '22222222-2222-2222-2222-222222222222'::uuid
  );

  if v_count <> 2 then
    raise exception 'Expected 2 profiles from auth trigger, got %', v_count;
  end if;
end;
$$;

-- promote first profile to admin for RLS tests
update public.profiles
set role = 'admin'
where id = '11111111-1111-1111-1111-111111111111'::uuid;

-- admin should read all profiles seeded by this test
-- (filtered by deterministic ids so coexisting seed/admin rows do not skew the count)
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
do $$
declare
  v_visible integer;
begin
  select count(*) into v_visible
  from public.profiles
  where id in (
    '11111111-1111-1111-1111-111111111111'::uuid,
    '22222222-2222-2222-2222-222222222222'::uuid
  );
  if v_visible <> 2 then
    raise exception 'Admin should see 2 seeded profiles, got %', v_visible;
  end if;
end;
$$;
reset role;

-- normal user should read only own profile
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
do $$
declare
  v_visible integer;
begin
  select count(*) into v_visible from public.profiles;
  if v_visible <> 1 then
    raise exception 'Normal user should see 1 profile, got %', v_visible;
  end if;
end;
$$;

-- normal user cannot update someone else's row
do $$
declare
  v_rows integer;
begin
  update public.profiles
  set full_name = 'Hacked Name'
  where id = '11111111-1111-1111-1111-111111111111'::uuid;

  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'Normal user updated another profile';
  end if;
end;
$$;

-- normal user can update own non-privileged field
do $$
declare
  v_rows integer;
begin
  update public.profiles
  set full_name = 'Task2 Security User Updated'
  where id = '22222222-2222-2222-2222-222222222222'::uuid;

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'Normal user failed to update own profile';
  end if;
end;
$$;

-- normal user must not escalate role to admin
do $$
begin
  begin
    update public.profiles
    set role = 'admin'
    where id = '22222222-2222-2222-2222-222222222222'::uuid;

    raise exception 'Role escalation unexpectedly succeeded';
  exception
    when insufficient_privilege then
      null;
    when others then
      if sqlstate <> '42501' then
        raise;
      end if;
  end;
end;
$$;

do $$
declare
  v_role text;
begin
  select role into v_role
  from public.profiles
  where id = '22222222-2222-2222-2222-222222222222'::uuid;

  if v_role <> 'user' then
    raise exception 'Role escalation guard failed. Current role: %', v_role;
  end if;
end;
$$;

reset role;

-- cleanup test users and cascading profiles
delete from auth.users
where id in (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid
);

select 'phase1_task2_security_ok' as result;
