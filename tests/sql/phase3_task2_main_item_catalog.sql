\set ON_ERROR_STOP on

-- Phase 3 / Task 2: main checkout item catalog and listing options

-- deterministic users
-- admin: 77777777-7777-7777-7777-777777777777
-- user:  88888888-8888-8888-8888-888888888888

-- deterministic listing ids
-- active listing: 99999999-9999-4999-8999-999999999991
-- passive listing:99999999-9999-4999-8999-999999999992

-- deterministic main item ids
-- deposit active:  aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1
-- rent inactive:   aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee2

-- deterministic option ids
-- active+enabled:  bbbbbbbb-cccc-4ddd-8eee-fffffffffff1
-- active+disabled: bbbbbbbb-cccc-4ddd-8eee-fffffffffff2
-- passive+enabled: bbbbbbbb-cccc-4ddd-8eee-fffffffffff3

delete from auth.users
where id in (
  '77777777-7777-7777-7777-777777777777'::uuid,
  '88888888-8888-8888-8888-888888888888'::uuid
);

delete from public.listing_main_item_options
where id in (
  'bbbbbbbb-cccc-4ddd-8eee-fffffffffff1'::uuid,
  'bbbbbbbb-cccc-4ddd-8eee-fffffffffff2'::uuid,
  'bbbbbbbb-cccc-4ddd-8eee-fffffffffff3'::uuid
);

delete from public.main_item_catalog
where id in (
  'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1'::uuid,
  'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee2'::uuid
);

delete from public.listings
where id in (
  '99999999-9999-4999-8999-999999999991'::uuid,
  '99999999-9999-4999-8999-999999999992'::uuid
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
  '77777777-7777-7777-7777-777777777777'::uuid,
  'authenticated',
  'authenticated',
  'phase3-main-item-admin@example.com',
  crypt('test-password', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Phase3 Admin'),
  now(),
  now(),
  '',
  '',
  '',
  ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '88888888-8888-8888-8888-888888888888'::uuid,
  'authenticated',
  'authenticated',
  'phase3-main-item-user@example.com',
  crypt('test-password', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Phase3 User'),
  now(),
  now(),
  '',
  '',
  '',
  ''
);

update public.profiles
set role = 'admin'
where id = '77777777-7777-7777-7777-777777777777'::uuid;

reset role;

insert into public.listings (
  id,
  type,
  status,
  title,
  slug,
  city,
  price
)
values
(
  '99999999-9999-4999-8999-999999999991'::uuid,
  'rent',
  'active',
  'Phase3 Active Listing',
  'phase3-active-listing',
  'Istanbul',
  42000
),
(
  '99999999-9999-4999-8999-999999999992'::uuid,
  'rent',
  'passive',
  'Phase3 Passive Listing',
  'phase3-passive-listing',
  'Ankara',
  38000
);

reset role;

insert into public.main_item_catalog (
  id,
  code,
  label,
  pricing_strategy,
  default_amount,
  is_active,
  sort_order
)
values
(
  'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1'::uuid,
  'deposit_phase3',
  'Kapora',
  'fixed',
  15000,
  true,
  1
),
(
  'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee2'::uuid,
  'rent_phase3',
  'Bir Aylik Kira',
  'fixed',
  42000,
  false,
  2
);

reset role;

insert into public.listing_main_item_options (
  id,
  listing_id,
  main_item_id,
  override_label,
  override_amount,
  is_enabled,
  sort_order
)
values
(
  'bbbbbbbb-cccc-4ddd-8eee-fffffffffff1'::uuid,
  '99999999-9999-4999-8999-999999999991'::uuid,
  'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1'::uuid,
  'Ilan Ozel Kapora',
  17000,
  true,
  1
),
(
  'bbbbbbbb-cccc-4ddd-8eee-fffffffffff2'::uuid,
  '99999999-9999-4999-8999-999999999991'::uuid,
  'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee2'::uuid,
  null,
  null,
  false,
  2
),
(
  'bbbbbbbb-cccc-4ddd-8eee-fffffffffff3'::uuid,
  '99999999-9999-4999-8999-999999999992'::uuid,
  'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1'::uuid,
  null,
  16000,
  true,
  1
);

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'main_item_catalog'
      and column_name = 'pricing_strategy'
  ) then
    raise exception 'main_item_catalog.pricing_strategy column must exist';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'listing_main_item_options'
      and column_name = 'override_amount'
  ) then
    raise exception 'listing_main_item_options.override_amount column must exist';
  end if;
end;
$$;

set role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('request.jwt.claim.sub', '88888888-8888-8888-8888-888888888888', false);

do $$
declare
  v_catalog_count integer;
  v_option_count integer;
begin
  select count(*)
  into v_catalog_count
  from public.main_item_catalog
  where code in ('deposit_phase3', 'rent_phase3');

  if v_catalog_count <> 1 then
    raise exception 'Active main item catalog rows should be public-readable; got %', v_catalog_count;
  end if;

  select count(*)
  into v_option_count
  from public.listing_main_item_options
  where id in (
    'bbbbbbbb-cccc-4ddd-8eee-fffffffffff1'::uuid,
    'bbbbbbbb-cccc-4ddd-8eee-fffffffffff2'::uuid,
    'bbbbbbbb-cccc-4ddd-8eee-fffffffffff3'::uuid
  );

  if v_option_count <> 1 then
    raise exception 'Only active-listing + active-main-item + enabled option should be public-readable; got %', v_option_count;
  end if;
end;
$$;

reset role;

do $$
begin
  begin
    insert into public.listing_main_item_options (
      id,
      listing_id,
      main_item_id,
      is_enabled
    )
    values (
      extensions.gen_random_uuid(),
      '99999999-9999-4999-8999-999999999991'::uuid,
      'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1'::uuid,
      true
    );
    raise exception 'Duplicate listing/main item combination should have been rejected';
  exception
    when unique_violation then null;
  end;
end;
$$;

reset role;

do $$
begin
  begin
    insert into public.main_item_catalog (
      id,
      code,
      label,
      pricing_strategy,
      default_amount,
      is_active,
      sort_order
    )
    values (
      extensions.gen_random_uuid(),
      'missing_fixed_amount_phase3',
      'Eksik fixed fiyat',
      'fixed',
      null,
      true,
      100
    );
    raise exception 'Fixed main item without default_amount should have been rejected';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.main_item_catalog (
      id,
      code,
      label,
      pricing_strategy,
      default_multiplier,
      is_active,
      sort_order
    )
    values (
      extensions.gen_random_uuid(),
      'missing_multiplier_phase3',
      'Eksik multiplier fiyat',
      'listing_price_multiplier',
      null,
      true,
      101
    );
    raise exception 'Multiplier main item without default_multiplier should have been rejected';
  exception
    when check_violation then null;
  end;
end;
$$;

do $$
begin
  begin
    insert into public.main_item_catalog (
      id,
      code,
      label,
      pricing_strategy,
      default_amount,
      is_active,
      sort_order
    )
    values (
      extensions.gen_random_uuid(),
      ' Deposit_Phase3 ',
      'Normalize edilmeyen kod',
      'fixed',
      1000,
      true,
      99
    );
    raise exception 'Non-normalized main item code should have been rejected';
  exception
    when check_violation then null;
  end;
end;
$$;

do $$
begin
  begin
    insert into public.main_item_catalog (
      id,
      code,
      label,
      pricing_strategy,
      default_amount,
      is_active,
      sort_order
    )
    values (
      extensions.gen_random_uuid(),
      'deposit.v2',
      'Parser disi kod',
      'fixed',
      1000,
      true,
      102
    );
    raise exception 'Parser-incompatible main item code should have been rejected';
  exception
    when check_violation then null;
  end;
end;
$$;

reset role;

do $$
begin
  begin
    insert into public.listing_main_item_options (
      id,
      listing_id,
      main_item_id,
      override_amount,
      is_enabled
    )
    values (
      extensions.gen_random_uuid(),
      '99999999-9999-4999-8999-999999999991'::uuid,
      'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee2'::uuid,
      -1,
      true
    );
    raise exception 'Negative override_amount should have been rejected';
  exception
    when check_violation then null;
  end;
end;
$$;
