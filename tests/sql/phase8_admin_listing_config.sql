\set ON_ERROR_STOP on

-- Phase 8.1 + 8.2: admin listing read snapshot and lifecycle write RPCs.
-- Contract: docs/ADMIN_LISTING_CONFIG_CONTRACT.md

-- deterministic ids
-- admin user:    aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb820
-- regular user:  aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb801
-- main item:     bbbbbbbb-cccc-4ccc-8ccc-ccccccccc801
-- service cat:   dddddddd-eeee-4eee-8eee-eeeeeeeee801
-- listings:
--   sale_passive       (8.2 status flip target):  cccccccc-dddd-4ddd-8ddd-ddddddddd801
--   rent_passive_with_main_item_and_service (checkout-ready): cccccccc-dddd-4ddd-8ddd-ddddddddd802
--   rent_passive_without_main_item (not ready):   cccccccc-dddd-4ddd-8ddd-ddddddddd803
--   rent_passive_with_main_item_no_service (not ready): cccccccc-dddd-4ddd-8ddd-ddddddddd804

-- ----------------------------------------------------------------------------
-- cleanup (idempotent)
-- ----------------------------------------------------------------------------
delete from public.listing_images
where listing_id in (
  'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd802'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd803'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd804'::uuid
);

delete from public.listing_service_options
where listing_id in (
  'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd802'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd803'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd804'::uuid
);

delete from public.listing_main_item_options
where listing_id in (
  'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd802'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd803'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd804'::uuid
);

delete from public.listings
where id in (
  'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd802'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd803'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd804'::uuid
)
or slug in (
  'phase-8-sale-passive',
  'phase-8-rent-with-main',
  'phase-8-rent-without-main',
  'phase-8-rent-main-no-service',
  'phase-8-create-sale',
  'phase-8-create-rent-active',
  'phase-8-create-duplicate'
);

delete from public.service_catalog
where id = 'dddddddd-eeee-4eee-8eee-eeeeeeeee801'::uuid
   or code = 'phase8_service';

delete from public.main_item_catalog
where id = 'bbbbbbbb-cccc-4ccc-8ccc-ccccccccc801'::uuid
   or code = 'phase8_main';

delete from auth.users
where id in (
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb820'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb801'::uuid
);

-- ----------------------------------------------------------------------------
-- seed users + admin role
-- ----------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
(
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb820'::uuid,
  'authenticated', 'authenticated',
  'phase8-admin@example.com',
  crypt('test-password', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Phase8 Admin'),
  now(), now(), '', '', '', ''
),
(
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb801'::uuid,
  'authenticated', 'authenticated',
  'phase8-user@example.com',
  crypt('test-password', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Phase8 Regular User'),
  now(), now(), '', '', '', ''
);

update public.profiles
set role = 'admin'
where id = 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb820'::uuid;

-- ----------------------------------------------------------------------------
-- seed service catalog
-- ----------------------------------------------------------------------------
insert into public.service_catalog (
  id, code, name, base_price, is_active
)
values (
  'dddddddd-eeee-4eee-8eee-eeeeeeeee801'::uuid,
  'phase8_service',
  'Phase 8 Service',
  500,
  true
);

-- ----------------------------------------------------------------------------
-- seed main item catalog + listings
-- ----------------------------------------------------------------------------
insert into public.main_item_catalog (
  id, code, label, pricing_strategy, default_amount, is_active, sort_order
)
values (
  'bbbbbbbb-cccc-4ccc-8ccc-ccccccccc801'::uuid,
  'phase8_main',
  'Phase 8 Main Item',
  'fixed',
  1000,
  true,
  1
);

insert into public.listings (
  id, type, status, title, slug, city, district, price, currency, description
)
values
(
  'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
  'sale', 'passive',
  'Phase 8 Sale Passive', 'phase-8-sale-passive',
  'Istanbul', 'Kadikoy', 4500000, 'TRY',
  'Satilik daire aciklamasi'
),
(
  'cccccccc-dddd-4ddd-8ddd-ddddddddd802'::uuid,
  'rent', 'passive',
  'Phase 8 Rent With Main', 'phase-8-rent-with-main',
  'Istanbul', 'Sisli', 42000, 'TRY',
  'Kiralik daire aciklamasi'
),
(
  'cccccccc-dddd-4ddd-8ddd-ddddddddd803'::uuid,
  'rent', 'passive',
  'Phase 8 Rent Without Main', 'phase-8-rent-without-main',
  'Istanbul', 'Besiktas', 39000, 'TRY',
  'Kiralik daire aciklamasi 2'
),
(
  'cccccccc-dddd-4ddd-8ddd-ddddddddd804'::uuid,
  'rent', 'passive',
  'Phase 8 Rent Main No Service', 'phase-8-rent-main-no-service',
  'Istanbul', 'Uskudar', 35000, 'TRY',
  'Kiralik daire aciklamasi 3'
);

-- Seed images so publish guard is satisfied
insert into public.listing_images (listing_id, image_url, sort_order)
values
  ('cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid, 'https://example.com/sale1.jpg', 0),
  ('cccccccc-dddd-4ddd-8ddd-ddddddddd802'::uuid, 'https://example.com/rent1.jpg', 0),
  ('cccccccc-dddd-4ddd-8ddd-ddddddddd803'::uuid, 'https://example.com/rent2.jpg', 0),
  ('cccccccc-dddd-4ddd-8ddd-ddddddddd804'::uuid, 'https://example.com/rent3.jpg', 0);

insert into public.listing_main_item_options (
  listing_id, main_item_id, is_enabled, sort_order
)
values (
  'cccccccc-dddd-4ddd-8ddd-ddddddddd802'::uuid,
  'bbbbbbbb-cccc-4ccc-8ccc-ccccccccc801'::uuid,
  true,
  1
),
(
  'cccccccc-dddd-4ddd-8ddd-ddddddddd804'::uuid,
  'bbbbbbbb-cccc-4ccc-8ccc-ccccccccc801'::uuid,
  true,
  1
);

insert into public.listing_service_options (
  listing_id, service_id, is_enabled
)
values (
  'cccccccc-dddd-4ddd-8ddd-ddddddddd802'::uuid,
  'dddddddd-eeee-4eee-8eee-eeeeeeeee801'::uuid,
  true
);

-- ----------------------------------------------------------------------------
-- 1) regular user is rejected by admin_list_listings (42501)
-- ----------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb801', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
begin
  begin
    perform public.admin_list_listings();
    raise exception 'Regular user unexpectedly allowed to call admin_list_listings';
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

-- ----------------------------------------------------------------------------
-- 2-7) admin scenarios
-- ----------------------------------------------------------------------------
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb820', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

-- 2) admin_list_listings returns the 4 seeded listings (and any pre-existing).
do $$
declare
  v_response jsonb;
  v_count integer;
begin
  v_response := public.admin_list_listings();
  v_count := jsonb_array_length(v_response -> 'items');
  if v_count < 4 then
    raise exception 'Admin list should include 4 phase 8 listings, got %', v_count;
  end if;
end;
$$;

-- 3) admin_list_listings filters by type=rent (must include all 3 rent listings)
do $$
declare
  v_response jsonb;
  v_count integer;
begin
  v_response := public.admin_list_listings(p_type => 'rent', p_status => 'passive', p_limit => 100, p_offset => 0);
  v_count := (
    select count(*)
    from jsonb_array_elements(v_response -> 'items') as item
    where (item ->> 'type') = 'rent'
      and (item ->> 'status') = 'passive'
      and (item ->> 'id')::uuid in (
        'cccccccc-dddd-4ddd-8ddd-ddddddddd802'::uuid,
        'cccccccc-dddd-4ddd-8ddd-ddddddddd803'::uuid,
        'cccccccc-dddd-4ddd-8ddd-ddddddddd804'::uuid
      )
  );
  if v_count <> 3 then
    raise exception 'Filtered list should return all 3 phase 8 rent listings, got %', v_count;
  end if;
end;
$$;

-- 4) admin_get_listing returns checkout_eligibility.is_checkout_ready
do $$
declare
  v_with jsonb;
  v_without jsonb;
  v_no_service jsonb;
begin
  v_with := public.admin_get_listing('cccccccc-dddd-4ddd-8ddd-ddddddddd802'::uuid);
  if (v_with #>> '{checkout_eligibility, is_checkout_ready}')::boolean is not true then
    raise exception 'Listing with enabled main item and service should be checkout-ready';
  end if;

  v_without := public.admin_get_listing('cccccccc-dddd-4ddd-8ddd-ddddddddd803'::uuid);
  if (v_without #>> '{checkout_eligibility, is_checkout_ready}')::boolean is not false then
    raise exception 'Listing without enabled main item should NOT be checkout-ready';
  end if;

  if not (v_without -> 'checkout_eligibility' -> 'missing') ? 'enabled_main_item' then
    raise exception 'Missing list should include enabled_main_item';
  end if;

  -- After fix_checkout_ready_service_not_required migration,
  -- a listing with an enabled main item but no service IS checkout-ready.
  v_no_service := public.admin_get_listing('cccccccc-dddd-4ddd-8ddd-ddddddddd804'::uuid);
  if (v_no_service #>> '{checkout_eligibility, is_checkout_ready}')::boolean is not true then
    raise exception 'Listing with main item (no service) should be checkout-ready after service-not-required fix';
  end if;
end;
$$;

-- 5) admin_get_listing on a non-existent listing raises P0002
do $$
begin
  begin
    perform public.admin_get_listing('cccccccc-dddd-4ddd-8ddd-dddddddddd99'::uuid);
    raise exception 'Missing listing get unexpectedly succeeded';
  exception
    when no_data_found then
      null;
    when others then
      if sqlstate <> 'P0002' then
        raise;
      end if;
  end;
end;
$$;

-- 6) admin_create_listing happy path (sale, defaults to passive)
do $$
declare
  v_response jsonb;
begin
  v_response := public.admin_create_listing(
    jsonb_build_object(
      'type', 'sale',
      'title', 'Phase 8 Created Sale',
      'slug', 'phase-8-create-sale',
      'city', 'Ankara',
      'price', 1000000,
      'currency', 'try'
    )
  );

  if (v_response #>> '{listing, slug}') <> 'phase-8-create-sale' then
    raise exception 'Created listing slug mismatch: %', v_response;
  end if;
  if (v_response #>> '{listing, currency}') <> 'TRY' then
    raise exception 'Currency should be uppercased to TRY, got %', v_response #>> '{listing, currency}';
  end if;
  if (v_response #>> '{listing, status}') <> 'passive' then
    raise exception 'Status default should be passive, got %', v_response #>> '{listing, status}';
  end if;
end;
$$;

-- 7) admin_create_listing with rent + status=active raises P0004 (not checkout-ready)
do $$
begin
  begin
    perform public.admin_create_listing(
      jsonb_build_object(
        'type', 'rent',
        'status', 'active',
        'title', 'Phase 8 Rent Active',
        'slug', 'phase-8-create-rent-active',
        'city', 'Izmir',
        'price', 25000,
        'currency', 'TRY'
      )
    );
    raise exception 'Rent listing creation with status=active unexpectedly succeeded';
  exception
    when sqlstate 'P0004' then
      null;
  end;
end;
$$;

-- 8) admin_create_listing with duplicate slug raises 23505
do $$
begin
  begin
    perform public.admin_create_listing(
      jsonb_build_object(
        'type', 'sale',
        'title', 'Duplicate Slug',
        'slug', 'phase-8-sale-passive',
        'city', 'Bursa',
        'price', 100000,
        'currency', 'TRY'
      )
    );
    raise exception 'Duplicate slug create unexpectedly succeeded';
  exception
    when unique_violation then
      null;
    when others then
      if sqlstate <> '23505' then
        raise;
      end if;
  end;
end;
$$;

-- 9) admin_create_listing with negative price raises 22023
do $$
begin
  begin
    perform public.admin_create_listing(
      jsonb_build_object(
        'type', 'sale',
        'title', 'Negative Price',
        'slug', 'phase-8-create-duplicate',
        'city', 'Bursa',
        'price', -1,
        'currency', 'TRY'
      )
    );
    raise exception 'Negative price create unexpectedly succeeded';
  exception
    when others then
      if sqlstate <> '22023' then
        raise;
      end if;
  end;
end;
$$;

-- 10) admin_update_listing rejects type changes (22023) and status changes (22023)
do $$
begin
  begin
    perform public.admin_update_listing(
      'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
      jsonb_build_object('type', 'rent')
    );
    raise exception 'Type change unexpectedly succeeded';
  exception
    when others then
      if sqlstate <> '22023' then
        raise;
      end if;
  end;

  begin
    perform public.admin_update_listing(
      'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
      jsonb_build_object('status', 'active')
    );
    raise exception 'Status change via admin_update_listing unexpectedly succeeded';
  exception
    when others then
      if sqlstate <> '22023' then
        raise;
      end if;
  end;
end;
$$;

-- 11) admin_update_listing not-found raises P0002
do $$
begin
  begin
    perform public.admin_update_listing(
      'cccccccc-dddd-4ddd-8ddd-dddddddddd00'::uuid,
      jsonb_build_object('title', 'whatever')
    );
    raise exception 'Update on missing listing unexpectedly succeeded';
  exception
    when no_data_found then
      null;
    when others then
      if sqlstate <> 'P0002' then
        raise;
      end if;
  end;
end;
$$;

-- 12) admin_set_listing_status: rent without main item -> P0004
do $$
begin
  begin
    perform public.admin_set_listing_status(
      'cccccccc-dddd-4ddd-8ddd-ddddddddd803'::uuid,
      'active'::public.listing_status
    );
    raise exception 'Activate rent listing without main item unexpectedly succeeded';
  exception
    when sqlstate 'P0004' then
      null;
  end;
end;
$$;

-- 13) admin_set_listing_status: rent with main item -> success (active)
do $$
declare
  v_response jsonb;
begin
  v_response := public.admin_set_listing_status(
    'cccccccc-dddd-4ddd-8ddd-ddddddddd802'::uuid,
    'active'::public.listing_status
  );
  if (v_response #>> '{listing, status}') <> 'active' then
    raise exception 'Activate rent listing with main item should succeed, got %', v_response #>> '{listing, status}';
  end if;
end;
$$;

-- 13b) admin_set_listing_status: rent with main item but no service -> now succeeds
-- (after fix_checkout_ready_service_not_required, services are optional)
do $$
declare
  v_response jsonb;
begin
  v_response := public.admin_set_listing_status(
    'cccccccc-dddd-4ddd-8ddd-ddddddddd804'::uuid,
    'active'::public.listing_status
  );
  if (v_response #>> '{listing, status}') <> 'active' then
    raise exception 'Rent listing with main item (no service) should activate after service-not-required fix, got %', v_response #>> '{listing, status}';
  end if;

  -- Reset back to passive for other tests.
  perform public.admin_set_listing_status(
    'cccccccc-dddd-4ddd-8ddd-ddddddddd804'::uuid,
    'passive'::public.listing_status
  );
end;
$$;

-- 14) admin_set_listing_status: sale without checkout config -> success
do $$
declare
  v_response jsonb;
begin
  v_response := public.admin_set_listing_status(
    'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
    'active'::public.listing_status
  );
  if (v_response #>> '{listing, status}') <> 'active' then
    raise exception 'Activate sale listing without checkout config should succeed, got %', v_response #>> '{listing, status}';
  end if;
end;
$$;

-- 15) regular user is rejected by admin_create_listing (42501)
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb801', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
begin
  begin
    perform public.admin_create_listing(
      jsonb_build_object(
        'type', 'sale',
        'title', 'Should Not Work',
        'slug', 'phase-8-not-allowed',
        'city', 'Bursa',
        'price', 1,
        'currency', 'TRY'
      )
    );
    raise exception 'Regular user unexpectedly allowed to create a listing';
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

-- ----------------------------------------------------------------------------
-- Phase 8.5: available catalog items in snapshot
-- ----------------------------------------------------------------------------

-- Reset to superuser role for catalog seeding
reset role;

-- Seed additional catalog items for picker testing
insert into public.main_item_catalog (
  id, code, label, pricing_strategy, default_amount, default_multiplier, is_active, sort_order
)
values (
  'bbbbbbbb-cccc-4ccc-8ccc-ccccccccc802'::uuid,
  'phase8_main_2',
  'Phase 8 Main Item 2',
  'listing_price_multiplier',
  null,
  1.5,
  true,
  2
)
on conflict (id) do nothing;

insert into public.service_catalog (
  id, code, name, base_price, is_active
)
values (
  'dddddddd-eeee-4eee-8eee-eeeeeeeee802'::uuid,
  'phase8_service_2',
  'Phase 8 Service 2',
  750,
  true
)
on conflict (id) do nothing;

-- Also seed an inactive catalog row to verify it is NOT included
insert into public.main_item_catalog (
  id, code, label, pricing_strategy, default_amount, is_active, sort_order
)
values (
  'bbbbbbbb-cccc-4ccc-8ccc-ccccccccc803'::uuid,
  'phase8_main_inactive',
  'Phase 8 Main Item Inactive',
  'fixed',
  500,
  false,
  99
)
on conflict (id) do nothing;

insert into public.service_catalog (
  id, code, name, base_price, is_active
)
values (
  'dddddddd-eeee-4eee-8eee-eeeeeeeee803'::uuid,
  'phase8_service_inactive',
  'Phase 8 Service Inactive',
  100,
  false
)
on conflict (id) do nothing;

-- Switch back to admin role for snapshot tests
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb820', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

-- 16) admin_get_listing returns available_main_items with active catalog entries
do $$
declare
  v_response jsonb;
  v_available_main_items jsonb;
  v_available_services jsonb;
  v_main_count int;
  v_service_count int;
begin
  v_response := public.admin_get_listing('cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid);

  -- Verify new fields exist
  if not v_response ? 'available_main_items' then
    raise exception 'Snapshot missing available_main_items field';
  end if;

  if not v_response ? 'available_services' then
    raise exception 'Snapshot missing available_services field';
  end if;

  v_available_main_items := v_response -> 'available_main_items';
  v_available_services := v_response -> 'available_services';

  -- Count active main items (should be 2: phase8_main, phase8_main_2)
  v_main_count := jsonb_array_length(v_available_main_items);
  if v_main_count < 2 then
    raise exception 'Expected at least 2 available main items, got %', v_main_count;
  end if;

  -- Count active services (should be 2: phase8_service, phase8_service_2)
  v_service_count := jsonb_array_length(v_available_services);
  if v_service_count < 2 then
    raise exception 'Expected at least 2 available services, got %', v_service_count;
  end if;

  -- Verify inactive items are NOT included
  if exists (
    select 1
    from jsonb_array_elements(v_available_main_items) as item
    where item ->> 'code' = 'phase8_main_inactive'
  ) then
    raise exception 'Inactive main item should not appear in available list';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_available_services) as svc
    where svc ->> 'code' = 'phase8_service_inactive'
  ) then
    raise exception 'Inactive service should not appear in available list';
  end if;

  -- Verify structure of a main item entry
  if not exists (
    select 1
    from jsonb_array_elements(v_available_main_items) as item
    where item ->> 'code' = 'phase8_main'
      and item ? 'id'
      and item ? 'label'
      and item ? 'pricing_strategy'
      and item ? 'default_amount'
      and item ? 'default_multiplier'
      and item ? 'is_active'
      and item ? 'sort_order'
  ) then
    raise exception 'Main item entry missing required fields';
  end if;

  -- Verify structure of a service entry
  if not exists (
    select 1
    from jsonb_array_elements(v_available_services) as svc
    where svc ->> 'code' = 'phase8_service'
      and svc ? 'id'
      and svc ? 'name'
      and svc ? 'base_price'
      and svc ? 'is_active'
  ) then
    raise exception 'Service entry missing required fields';
  end if;
end;
$$;

reset role;
