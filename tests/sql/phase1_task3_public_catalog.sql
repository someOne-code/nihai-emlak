\set ON_ERROR_STOP on

-- deterministic users
-- admin: 33333333-3333-3333-3333-333333333333
-- user:  44444444-4444-4444-4444-444444444444

-- deterministic catalog ids
-- consultant active:   aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1
-- consultant passive:  aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2
-- listing active:      bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1
-- listing passive:     bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2
-- service active:      cccccccc-cccc-cccc-cccc-ccccccccccc1
-- service inactive:    cccccccc-cccc-cccc-cccc-ccccccccccc2

delete from auth.users
where id in (
  '33333333-3333-3333-3333-333333333333'::uuid,
  '44444444-4444-4444-4444-444444444444'::uuid
);

delete from public.listing_service_options
where id in (
  'dddddddd-dddd-dddd-dddd-ddddddddddd1'::uuid,
  'dddddddd-dddd-dddd-dddd-ddddddddddd2'::uuid
);

delete from public.listing_images
where id in (
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1'::uuid,
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2'::uuid
);

delete from public.service_catalog
where id in (
  'cccccccc-cccc-cccc-cccc-ccccccccccc1'::uuid,
  'cccccccc-cccc-cccc-cccc-ccccccccccc2'::uuid
);

delete from public.listings
where id in (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'::uuid
);

delete from public.consultants
where id in (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::uuid
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
values (
  '00000000-0000-0000-0000-000000000000',
  '33333333-3333-3333-3333-333333333333'::uuid,
  'authenticated',
  'authenticated',
  'task3-admin@example.com',
  crypt('test-password', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Task3 Admin'),
  now(),
  now(),
  '',
  '',
  '',
  ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '44444444-4444-4444-4444-444444444444'::uuid,
  'authenticated',
  'authenticated',
  'task3-user@example.com',
  crypt('test-password', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Task3 User'),
  now(),
  now(),
  '',
  '',
  '',
  ''
);

update public.profiles
set role = 'admin'
where id = '33333333-3333-3333-3333-333333333333'::uuid;

set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
declare
  v_has_address_column boolean;
  v_has_consultant_column boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'listings'
      and column_name = 'address_line'
  )
  into v_has_address_column;

  if v_has_address_column then
    raise exception 'Task 3 contract violated: listings.address_line must not exist';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'listings'
      and column_name = 'consultant_id'
  )
  into v_has_consultant_column;

  if v_has_consultant_column then
    raise exception 'Task 3 contract violated: listings.consultant_id must not exist';
  end if;
end;
$$;

insert into public.consultants (
  id,
  full_name,
  slug,
  title,
  is_active,
  sort_order
)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid,
    'Aktif Danisman',
    'aktif-danisman',
    'Kidemli Danisman',
    true,
    1
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::uuid,
    'Pasif Danisman',
    'pasif-danisman',
    'Eski Danisman',
    false,
    2
  );

insert into public.listings (
  id,
  type,
  status,
  title,
  slug,
  city,
  district,
  price,
  currency,
  room_count,
  bathroom_count
)
values
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid,
    'rent',
    'active',
    'Aktif Ilan',
    'aktif-ilan',
    'Istanbul',
    'Besiktas',
    45000,
    'TRY',
    3,
    2
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'::uuid,
    'sale',
    'passive',
    'Pasif Ilan',
    'pasif-ilan',
    'Istanbul',
    'Kadikoy',
    12500000,
    'TRY',
    4,
    2
  );

insert into public.listing_images (
  id,
  listing_id,
  image_url,
  alt_text,
  sort_order,
  is_primary
)
values
  (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1'::uuid,
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid,
    'https://cdn.example.com/listings/active-cover.jpg',
    'Aktif ilanin kapak gorseli',
    0,
    true
  ),
  (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2'::uuid,
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'::uuid,
    'https://cdn.example.com/listings/passive-cover.jpg',
    'Pasif ilanin kapak gorseli',
    0,
    true
  );

reset role;

insert into public.service_catalog (
  id,
  code,
  name,
  base_price,
  is_active
)
values
  (
    'cccccccc-cccc-cccc-cccc-ccccccccccc1'::uuid,
    'cleaning',
    'Temizlik',
    2500,
    true
  ),
  (
    'cccccccc-cccc-cccc-cccc-ccccccccccc2'::uuid,
    'airport_transfer',
    'Havalimani Transferi',
    3000,
    false
	  );

set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

insert into public.listing_service_options (
  id,
  listing_id,
  service_id,
  override_price,
  is_enabled
)
values
  (
    'dddddddd-dddd-dddd-dddd-ddddddddddd1'::uuid,
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid,
    'cccccccc-cccc-cccc-cccc-ccccccccccc1'::uuid,
    2200,
    true
  ),
  (
    'dddddddd-dddd-dddd-dddd-ddddddddddd2'::uuid,
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'::uuid,
    'cccccccc-cccc-cccc-cccc-ccccccccccc2'::uuid,
    2800,
    true
  );

do $$
declare
  v_consultant_title text;
  v_listing_title text;
  v_image_alt_text text;
  v_option_price numeric;
begin
  update public.consultants
  set title = 'Bas Danisman'
  where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid;

  select title into v_consultant_title
  from public.consultants
  where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid;

  if v_consultant_title <> 'Bas Danisman' then
    raise exception 'Admin should be able to manage consultant rows';
  end if;

  update public.listings
  set title = 'Admin Guncelledi'
  where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid;

  select title into v_listing_title
  from public.listings
  where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid;

  if v_listing_title <> 'Admin Guncelledi' then
    raise exception 'Admin should be able to manage listing rows';
  end if;

  update public.listing_images
  set alt_text = 'Admin tarafindan guncellendi'
  where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1'::uuid;

  select alt_text into v_image_alt_text
  from public.listing_images
  where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1'::uuid;

  if v_image_alt_text <> 'Admin tarafindan guncellendi' then
    raise exception 'Admin should be able to manage listing image rows';
  end if;

  update public.listing_service_options
  set override_price = 2300
  where id = 'dddddddd-dddd-dddd-dddd-ddddddddddd1'::uuid;

  select override_price into v_option_price
  from public.listing_service_options
  where id = 'dddddddd-dddd-dddd-dddd-ddddddddddd1'::uuid;

  if v_option_price <> 2300 then
    raise exception 'Admin should be able to manage listing_service_options rows';
  end if;
end;
$$;

-- duplicate listing-service pair must fail
do $$
begin
  begin
    insert into public.listing_service_options (
      listing_id,
      service_id
    )
    values (
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid,
      'cccccccc-cccc-cccc-cccc-ccccccccccc1'::uuid
    );

    raise exception 'Duplicate listing_service_options unexpectedly succeeded';
  exception
    when unique_violation then
      null;
  end;
end;
$$;

-- parser-incompatible service codes must fail at the catalog boundary
reset role;

do $$
begin
  begin
    insert into public.service_catalog (
      id,
      code,
      name,
      base_price,
      is_active
    )
    values (
      extensions.gen_random_uuid(),
      'cleaning.v2',
      'Parser Incompatible Cleaning',
      9999,
      true
    );

    raise exception 'Parser-incompatible service code unexpectedly succeeded';
  exception
    when check_violation then
      null;
  end;
end;
$$;

do $$
begin
  begin
    insert into public.service_catalog (
      id,
      code,
      name,
      base_price,
      is_active
    )
    values (
      extensions.gen_random_uuid(),
      ' Cleaning ',
      'Non-normalized Cleaning',
      9999,
      true
    );

    raise exception 'Non-normalized service code unexpectedly succeeded';
  exception
    when check_violation then
      null;
  end;
end;
$$;

-- duplicate canonical service codes must fail
do $$
begin
  begin
    insert into public.service_catalog (
      id,
      code,
      name,
      base_price,
      is_active
    )
    values (
      extensions.gen_random_uuid(),
      'cleaning',
      'Ambiguous Cleaning',
      9999,
      true
    );

    raise exception 'Duplicate service code unexpectedly succeeded';
  exception
    when unique_violation then
      null;
  end;
end;
$$;

-- negative price must fail
set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
begin
  begin
    insert into public.listings (
      type,
      title,
      slug,
      city,
      price
    )
    values (
      'rent',
      'Hatali Ilan',
      'hatali-ilan',
      'Istanbul',
      -1
    );

    raise exception 'Negative listing price unexpectedly succeeded';
  exception
    when check_violation then
      null;
  end;
end;
$$;

reset role;

-- public reads should only expose active records
set role anon;

do $$
declare
  v_listing_count integer;
  v_consultant_count integer;
  v_image_count integer;
  v_service_count integer;
  v_option_count integer;
begin
  select count(*) into v_listing_count
  from public.listings
  where id in (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid,
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'::uuid
  );

  if v_listing_count <> 1 then
    raise exception 'Anon should see only active listings, got %', v_listing_count;
  end if;

  select count(*) into v_consultant_count
  from public.consultants
  where id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::uuid
  );

  if v_consultant_count <> 1 then
    raise exception 'Anon should see only active consultants, got %', v_consultant_count;
  end if;

  select count(*) into v_image_count
  from public.listing_images
  where id in (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1'::uuid,
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2'::uuid
  );

  if v_image_count <> 1 then
    raise exception 'Anon should see only active listing images, got %', v_image_count;
  end if;

  select count(*) into v_service_count
  from public.service_catalog
  where id in (
    'cccccccc-cccc-cccc-cccc-ccccccccccc1'::uuid,
    'cccccccc-cccc-cccc-cccc-ccccccccccc2'::uuid
  );

  if v_service_count <> 1 then
    raise exception 'Anon should see only active services, got %', v_service_count;
  end if;

  select count(*) into v_option_count
  from public.listing_service_options
  where id in (
    'dddddddd-dddd-dddd-dddd-ddddddddddd1'::uuid,
    'dddddddd-dddd-dddd-dddd-ddddddddddd2'::uuid
  );

  if v_option_count <> 1 then
    raise exception 'Anon should see only enabled options of active listing and active service, got %', v_option_count;
  end if;
end;
$$;

reset role;

do $$
declare
  v_table_name text;
  v_policy_name text;
  v_admin_write_policy_count integer;
  v_extra_write_policy_count integer;
begin
  for v_table_name, v_policy_name in
    values
	      ('consultants', 'consultants_admin_manage'),
	      ('listings', 'listings_admin_manage'),
	      ('listing_images', 'listing_images_admin_manage'),
	      ('listing_service_options', 'listing_service_options_admin_manage')
	  loop
    select count(*)
    into v_admin_write_policy_count
    from pg_policies
    where schemaname = 'public'
      and tablename = v_table_name
      and policyname = v_policy_name
      and cmd = 'ALL'
      and coalesce(qual, '') like '%is_admin()%'
      and coalesce(with_check, '') like '%is_admin()%';

    if v_admin_write_policy_count <> 1 then
      raise exception 'Expected exactly one admin-only write policy for %, got %', v_table_name, v_admin_write_policy_count;
    end if;

    select count(*)
    into v_extra_write_policy_count
    from pg_policies
    where schemaname = 'public'
      and tablename = v_table_name
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      and policyname <> v_policy_name;

    if v_extra_write_policy_count <> 0 then
      raise exception 'Unexpected non-admin write policy found for %', v_table_name;
    end if;
	  end loop;

  select count(*)
  into v_admin_write_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'service_catalog'
    and policyname = 'service_catalog_admin_manage';

  if v_admin_write_policy_count <> 0 then
    raise exception 'service_catalog direct admin write policy should be removed after RPC hardening';
  end if;
end;
$$;

-- normal authenticated user must not manage catalog
set role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
begin
  begin
    insert into public.listings (
      type,
      title,
      slug,
      city,
      price
    )
    values (
      'rent',
      'Yetkisiz Ilan',
      'yetkisiz-ilan',
      'Ankara',
      1000
    );

    raise exception 'Non-admin listing insert unexpectedly succeeded';
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

reset role;

delete from auth.users
where id in (
  '33333333-3333-3333-3333-333333333333'::uuid,
  '44444444-4444-4444-4444-444444444444'::uuid
);

delete from public.listing_service_options
where id in (
  'dddddddd-dddd-dddd-dddd-ddddddddddd1'::uuid,
  'dddddddd-dddd-dddd-dddd-ddddddddddd2'::uuid
);

delete from public.listing_images
where id in (
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1'::uuid,
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2'::uuid
);

delete from public.service_catalog
where id in (
  'cccccccc-cccc-cccc-cccc-ccccccccccc1'::uuid,
  'cccccccc-cccc-cccc-cccc-ccccccccccc2'::uuid
);

delete from public.listings
where id in (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'::uuid
);

delete from public.consultants
where id in (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::uuid
);

select 'phase1_task3_public_catalog_ok' as result;
