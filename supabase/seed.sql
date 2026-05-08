-- Seed admin user for local development
-- This file is referenced by supabase/config.toml [db.seed] and runs on `supabase db reset`.
-- The handle_new_user trigger auto-creates a profile row with role='user',
-- so we update it to 'admin' after the insert.

-- Clean up any previous seed data for idempotent re-runs
-- (order matters due to FK constraints)
delete from public.profiles where id = 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb800'::uuid;
delete from auth.users where id = 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb800'::uuid;

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
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb800'::uuid,
  'authenticated',
  'authenticated',
  'smoke-admin@example.test',
  crypt('smoke-admin-2026', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Smoke Admin'),
  now(),
  now(),
  '',
  '',
  '',
  ''
);

-- The handle_new_user trigger created the profile with role='user'.
-- Promote to admin.
update public.profiles
set role = 'admin'
where id = 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb800'::uuid;
