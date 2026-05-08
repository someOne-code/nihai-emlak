\set ON_ERROR_STOP on

-- Phase 9B hardening: admin catalog RPCs must reject duplicate active
-- visible labels, not just duplicate internal codes. The admin UI displays
-- labels, so two active rows with the same normalized label are one user
-- visible payment item.

-- deterministic ids
-- admin user: aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb900

delete from public.main_item_catalog
where code in (
  'phase9b_label_guard_one',
  'phase9b_label_guard_two',
  'phase9b_label_guard_three'
);

delete from auth.users
where id = 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb900'::uuid;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb900'::uuid,
  'authenticated', 'authenticated',
  'phase9b-label-guard-admin@example.com',
  crypt('test-password', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Phase9B Label Guard Admin'),
  now(), now(), '', '', '', ''
);

update public.profiles
set role = 'admin'
where id = 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb900'::uuid;

set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb900', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

select public.admin_create_main_item_catalog(
  jsonb_build_object(
    'code', 'phase9b_label_guard_one',
    'label', 'Phase 9B Duplicate Label Guard',
    'pricing_strategy', 'fixed',
    'default_amount', 100,
    'is_active', true
  )
);

do $$
begin
  begin
    perform public.admin_create_main_item_catalog(
      jsonb_build_object(
        'code', 'phase9b_label_guard_two',
        'label', '  phase 9b duplicate label guard  ',
        'pricing_strategy', 'fixed',
        'default_amount', 100,
        'is_active', true
      )
    );
    raise exception 'duplicate active main item label should have been rejected';
  exception
    when unique_violation then
      -- expected
  end;
end;
$$;

select public.admin_create_main_item_catalog(
  jsonb_build_object(
    'code', 'phase9b_label_guard_three',
    'label', 'Phase 9B Other Label',
    'pricing_strategy', 'fixed',
    'default_amount', 100,
    'is_active', false
  )
);

do $$
begin
  begin
    perform public.admin_update_main_item_catalog(
      'phase9b_label_guard_three',
      jsonb_build_object(
        'label', 'phase 9b duplicate label guard',
        'is_active', true
      )
    );
    raise exception 'activating duplicate main item label should have been rejected';
  exception
    when unique_violation then
      -- expected
  end;
end;
$$;

reset role;
