\set ON_ERROR_STOP on

-- Test: publish guard — listings cannot go active without description, district, and image.

-- ── Cleanup ──────────────────────────────────────────────────────────

update public.listings
set status = 'passive'::public.listing_status
where id in (
  'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaab01'::uuid,
  'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaab02'::uuid,
  'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaab03'::uuid
);

delete from public.listing_images where listing_id in (
  'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaab01'::uuid,
  'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaab02'::uuid,
  'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaab03'::uuid
);
delete from public.listing_service_options where listing_id in (
  'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaab01'::uuid,
  'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaab02'::uuid,
  'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaab03'::uuid
);
delete from public.listing_main_item_options where listing_id in (
  'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaab01'::uuid,
  'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaab02'::uuid,
  'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaab03'::uuid
);
delete from public.listings where id in (
  'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaab01'::uuid,
  'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaab02'::uuid,
  'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaab03'::uuid
);

-- ── Fixtures ─────────────────────────────────────────────────────────

-- Listing 01: sale, missing description + district + image → cannot publish
insert into public.listings (id, type, status, title, slug, city, price, currency)
values ('cccccccc-aaaa-4aaa-8aaa-aaaaaaaaab01'::uuid, 'sale', 'passive',
        'Publish Guard Test A', 'publish-guard-a', 'Istanbul', 500000, 'TRY');

-- Listing 02: sale, has description + district + image → can publish
insert into public.listings (id, type, status, title, slug, city, district, price, currency, description)
values ('cccccccc-aaaa-4aaa-8aaa-aaaaaaaaab02'::uuid, 'sale', 'passive',
        'Publish Guard Test B', 'publish-guard-b', 'Istanbul', 'Kadikoy', 600000, 'TRY',
        'Guzel bir daire');
insert into public.listing_images (listing_id, image_url, sort_order)
values ('cccccccc-aaaa-4aaa-8aaa-aaaaaaaaab02'::uuid, 'https://example.com/img1.jpg', 0);

-- Listing 03: sale, has description + district but NO image → cannot publish
insert into public.listings (id, type, status, title, slug, city, district, price, currency, description)
values ('cccccccc-aaaa-4aaa-8aaa-aaaaaaaaab03'::uuid, 'sale', 'passive',
        'Publish Guard Test C', 'publish-guard-c', 'Istanbul', 'Besiktas', 700000, 'TRY',
        'Baska guzel bir daire');

-- ── Test admin_listing_publish_missing ──────────────────────────────

set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb800', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
declare
  v_missing_01 text[];
  v_missing_02 text[];
  v_missing_03 text[];
begin
  v_missing_01 := public.admin_listing_publish_missing('cccccccc-aaaa-4aaa-8aaa-aaaaaaaaab01'::uuid);
  v_missing_02 := public.admin_listing_publish_missing('cccccccc-aaaa-4aaa-8aaa-aaaaaaaaab02'::uuid);
  v_missing_03 := public.admin_listing_publish_missing('cccccccc-aaaa-4aaa-8aaa-aaaaaaaaab03'::uuid);

  -- 01: should have description, district, image missing
  if array_length(v_missing_01, 1) <> 3 then
    raise exception 'TEST FAILED [01 missing count]: expected 3, got %', array_length(v_missing_01, 1);
  end if;
  if not ('description' = any(v_missing_01)) then
    raise exception 'TEST FAILED [01]: description should be missing';
  end if;
  if not ('district' = any(v_missing_01)) then
    raise exception 'TEST FAILED [01]: district should be missing';
  end if;
  if not ('image' = any(v_missing_01)) then
    raise exception 'TEST FAILED [01]: image should be missing';
  end if;

  -- 02: should have nothing missing
  if array_length(v_missing_02, 1) is not null then
    raise exception 'TEST FAILED [02]: expected empty missing, got %', v_missing_02;
  end if;

  -- 03: should have image missing only
  if array_length(v_missing_03, 1) <> 1 then
    raise exception 'TEST FAILED [03 missing count]: expected 1, got %', array_length(v_missing_03, 1);
  end if;
  if not ('image' = any(v_missing_03)) then
    raise exception 'TEST FAILED [03]: image should be missing';
  end if;
end;
$$;

-- ── Test admin_set_listing_status blocks incomplete listing ──────────

do $$
begin
  -- Try to activate listing 01 (incomplete) → must fail
  begin
    perform public.admin_set_listing_status(
      'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaab01'::uuid,
      'active'::public.listing_status
    );
    raise exception 'TEST FAILED: incomplete listing activation should have been blocked';
  exception
    when sqlstate 'P0004' then
      null; -- expected: listing is not publish-ready
  end;

  -- Try to activate listing 03 (missing image only) → must fail
  begin
    perform public.admin_set_listing_status(
      'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaab03'::uuid,
      'active'::public.listing_status
    );
    raise exception 'TEST FAILED: listing without image activation should have been blocked';
  exception
    when sqlstate 'P0004' then
      null; -- expected
  end;

  -- Activate listing 02 (complete) → must succeed
  perform public.admin_set_listing_status(
    'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaab02'::uuid,
    'active'::public.listing_status
  );
end;
$$;

-- Verify listing 02 is now active
do $$
declare
  v_status text;
begin
  select status::text into v_status
  from public.listings
  where id = 'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaab02'::uuid;

  if v_status <> 'active' then
    raise exception 'TEST FAILED: complete listing must be active, got %', v_status;
  end if;
end;
$$;

-- ── Test admin_get_listing returns publish_readiness ─────────────────

do $$
declare
  v_result jsonb;
  v_is_ready boolean;
  v_pmissing jsonb;
begin
  v_result := public.admin_get_listing('cccccccc-aaaa-4aaa-8aaa-aaaaaaaaab01'::uuid);
  v_is_ready := (v_result->'publish_readiness'->>'is_publish_ready')::boolean;
  v_pmissing := v_result->'publish_readiness'->'missing';

  if v_is_ready then
    raise exception 'TEST FAILED: incomplete listing should not be publish-ready';
  end if;

  if jsonb_array_length(v_pmissing) <> 3 then
    raise exception 'TEST FAILED: expected 3 missing items in publish_readiness, got %', jsonb_array_length(v_pmissing);
  end if;

  -- Check listing 02 (complete)
  v_result := public.admin_get_listing('cccccccc-aaaa-4aaa-8aaa-aaaaaaaaab02'::uuid);
  v_is_ready := (v_result->'publish_readiness'->>'is_publish_ready')::boolean;

  if not v_is_ready then
    raise exception 'TEST FAILED: complete listing should be publish-ready';
  end if;
end;
$$;

do $$
begin
  begin
    update public.listings
    set status = 'active'
    where id = 'cccccccc-aaaa-4aaa-8aaa-aaaaaaaaab01'::uuid;
    raise exception 'TEST FAILED: direct incomplete listing activation should have been blocked';
  exception
    when sqlstate 'P0004' then
      null;
    when sqlstate '42501' then
      null;
  end;
end;
$$;

select 'publish_guard_test_ok' as result;
