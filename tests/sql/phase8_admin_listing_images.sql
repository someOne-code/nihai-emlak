\set ON_ERROR_STOP on

-- Phase 8.3: admin listing image management RPC tests.
-- Contract: docs/ADMIN_LISTING_CONFIG_CONTRACT.md

-- deterministic ids
-- admin user:    aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb800
-- regular user:  aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb801
-- listing:       cccccccc-dddd-4ddd-8ddd-ddddddddd801 (sale passive)
-- image ids:     eeeeeeee-ffff-4fff-8fff-fffffffff801, eeeeeeee-ffff-4fff-8fff-fffffffff802, eeeeeeee-ffff-4fff-8fff-fffffffff803

-- ----------------------------------------------------------------------------
-- cleanup (idempotent)
-- ----------------------------------------------------------------------------
delete from public.listing_images
where id in (
  'eeeeeeee-ffff-4fff-8fff-fffffffff801'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff802'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff803'::uuid
)
or listing_id = 'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid;

-- ----------------------------------------------------------------------------
-- set admin context
-- ----------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb800', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

-- ----------------------------------------------------------------------------
-- 1) admin_add_listing_image: happy path (non-primary)
-- ----------------------------------------------------------------------------
do $$
declare
  v_result jsonb;
begin
  v_result := public.admin_add_listing_image(
    'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
    'https://example.com/image1.jpg',
    'Test image 1',
    false
  );

  if (v_result ->> 'image_url') <> 'https://example.com/image1.jpg' then
    raise exception 'Image url mismatch: %', v_result;
  end if;
  if (v_result ->> 'alt_text') <> 'Test image 1' then
    raise exception 'Alt text mismatch: %', v_result;
  end if;
  if (v_result ->> 'is_primary')::boolean is not false then
    raise exception 'Image should not be primary: %', v_result;
  end if;
  if (v_result ->> 'sort_order')::integer <> 0 then
    raise exception 'First image sort_order should be 0: %', v_result;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2) admin_add_listing_image: add primary image (atomically demotes previous)
-- ----------------------------------------------------------------------------
do $$
declare
  v_result jsonb;
  v_previous_primary_id uuid;
  v_previous_is_primary boolean;
begin
  -- First, add a primary image.
  v_result := public.admin_add_listing_image(
    'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
    'https://example.com/primary1.jpg',
    'Primary image 1',
    true
  );

  if (v_result ->> 'is_primary')::boolean is not true then
    raise exception 'Image should be primary: %', v_result;
  end if;

  -- Now add another primary image; the previous one should be demoted.
  v_result := public.admin_add_listing_image(
    'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
    'https://example.com/primary2.jpg',
    'Primary image 2',
    true
  );

  if (v_result ->> 'is_primary')::boolean is not true then
    raise exception 'New image should be primary: %', v_result;
  end if;

  -- Verify only one primary exists.
  select count(*) into v_previous_is_primary
  from public.listing_images
  where listing_id = 'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid
    and is_primary = true;

  if v_previous_is_primary::integer <> 1 then
    raise exception 'There should be exactly 1 primary image, got %', v_previous_is_primary;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3) admin_add_listing_image: rejects empty image_url
-- ----------------------------------------------------------------------------
do $$
begin
  begin
    perform public.admin_add_listing_image(
      'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
      '',
      null,
      false
    );
    raise exception 'Empty image_url unexpectedly succeeded';
  exception
    when others then
      if sqlstate <> '22023' then
        raise;
      end if;
  end;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4) admin_add_listing_image: rejects non-existent listing (P0002)
-- ----------------------------------------------------------------------------
do $$
begin
  begin
    perform public.admin_add_listing_image(
      'cccccccc-dddd-4ddd-8ddd-dddddddddd99'::uuid,
      'https://example.com/image.jpg',
      null,
      false
    );
    raise exception 'Add image to non-existent listing unexpectedly succeeded';
  exception
    when others then
      if sqlstate <> 'P0002' then
        raise;
      end if;
  end;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5) admin_reorder_listing_images: happy path
-- ----------------------------------------------------------------------------
do $$
declare
  v_result jsonb;
  v_img1_id uuid;
  v_img2_id uuid;
  v_img3_id uuid;
begin
  -- Clean up any existing images for this listing first.
  delete from public.listing_images
  where listing_id = 'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid;

  -- Add three images.
  v_result := public.admin_add_listing_image(
    'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
    'https://example.com/a.jpg', 'A', false
  );
  v_img1_id := (v_result ->> 'id')::uuid;

  v_result := public.admin_add_listing_image(
    'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
    'https://example.com/b.jpg', 'B', false
  );
  v_img2_id := (v_result ->> 'id')::uuid;

  v_result := public.admin_add_listing_image(
    'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
    'https://example.com/c.jpg', 'C', false
  );
  v_img3_id := (v_result ->> 'id')::uuid;

  -- Reorder: [img3, img1, img2]
  v_result := public.admin_reorder_listing_images(
    'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
    jsonb_build_array(
      v_img3_id::text,
      v_img1_id::text,
      v_img2_id::text
    )
  );

  -- Verify order: first element should be img3 with sort_order=0.
  if (v_result -> 0 ->> 'id')::uuid <> v_img3_id then
    raise exception 'First image should be img3, got %', v_result -> 0 ->> 'id';
  end if;
  if (v_result -> 0 ->> 'sort_order')::integer <> 0 then
    raise exception 'First image sort_order should be 0, got %', v_result -> 0 ->> 'sort_order';
  end if;

  -- Second element should be img1 with sort_order=1.
  if (v_result -> 1 ->> 'id')::uuid <> v_img1_id then
    raise exception 'Second image should be img1, got %', v_result -> 1 ->> 'id';
  end if;
  if (v_result -> 1 ->> 'sort_order')::integer <> 1 then
    raise exception 'Second image sort_order should be 1, got %', v_result -> 1 ->> 'sort_order';
  end if;

  -- Third element should be img2 with sort_order=2.
  if (v_result -> 2 ->> 'id')::uuid <> v_img2_id then
    raise exception 'Third image should be img2, got %', v_result -> 2 ->> 'id';
  end if;
  if (v_result -> 2 ->> 'sort_order')::integer <> 2 then
    raise exception 'Third image sort_order should be 2, got %', v_result -> 2 ->> 'sort_order';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6) admin_reorder_listing_images: rejects non-array payload
-- ----------------------------------------------------------------------------
do $$
begin
  begin
    perform public.admin_reorder_listing_images(
      'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
      '"not-an-array"'::jsonb
    );
    raise exception 'Non-array reorder payload unexpectedly succeeded';
  exception
    when others then
      if sqlstate <> '22023' then
        raise;
      end if;
  end;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7) admin_reorder_listing_images: rejects ids not belonging to listing
-- ----------------------------------------------------------------------------
do $$
begin
  begin
    perform public.admin_reorder_listing_images(
      'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
      jsonb_build_array('eeeeeeee-ffff-4fff-8fff-fffffffff801'::text)
    );
    raise exception 'Reorder with non-owned ids unexpectedly succeeded';
  exception
    when others then
      if sqlstate <> '22023' then
        raise;
      end if;
  end;
end;
$$;

-- ----------------------------------------------------------------------------
-- 8) admin_delete_listing_image: happy path
-- ----------------------------------------------------------------------------
do $$
declare
  v_result jsonb;
  v_image_id uuid;
  v_count integer;
begin
  -- Clean up and add a fresh image.
  delete from public.listing_images
  where listing_id = 'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid;

  v_result := public.admin_add_listing_image(
    'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
    'https://example.com/to-delete.jpg',
    'Will be deleted',
    false
  );
  v_image_id := (v_result ->> 'id')::uuid;

  -- Delete it.
  v_result := public.admin_delete_listing_image(
    'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
    v_image_id
  );

  if (v_result ->> 'deleted')::boolean is not true then
    raise exception 'Delete should return deleted=true: %', v_result;
  end if;

  -- Verify it's gone.
  select count(*) into v_count
  from public.listing_images
  where id = v_image_id;

  if v_count <> 0 then
    raise exception 'Image should be deleted, but % rows remain', v_count;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 9) admin_delete_listing_image: rejects non-existent image (P0002)
-- ----------------------------------------------------------------------------
do $$
begin
  begin
    perform public.admin_delete_listing_image(
      'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
      'eeeeeeee-ffff-4fff-8fff-fffffffff999'::uuid
    );
    raise exception 'Delete non-existent image unexpectedly succeeded';
  exception
    when others then
      if sqlstate <> 'P0002' then
        raise;
      end if;
  end;
end;
$$;

-- ----------------------------------------------------------------------------
-- 9b) admin_delete_listing_image: rejects cross-listing deletion (P0002)
-- ----------------------------------------------------------------------------
do $$
declare
  v_image_id uuid;
  v_result jsonb;
begin
  -- Add an image to the test listing.
  v_result := public.admin_add_listing_image(
    'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
    'https://example.com/cross-listing.jpg',
    'Cross listing test',
    false
  );
  v_image_id := (v_result ->> 'id')::uuid;

  -- Try to delete it using a different listing id.
  begin
    perform public.admin_delete_listing_image(
      'cccccccc-dddd-4ddd-8ddd-dddddddddd99'::uuid,
      v_image_id
    );
    raise exception 'Cross-listing delete unexpectedly succeeded';
  exception
    when others then
      if sqlstate <> 'P0002' then
        raise;
      end if;
  end;

  -- Clean up: delete the image properly.
  perform public.admin_delete_listing_image(
    'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
    v_image_id
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 10) regular user is rejected by admin_add_listing_image (42501)
-- ----------------------------------------------------------------------------
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb801', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
begin
  begin
    perform public.admin_add_listing_image(
      'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
      'https://example.com/evil.jpg',
      null,
      false
    );
    raise exception 'Regular user unexpectedly allowed to add image';
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
-- 11) regular user is rejected by admin_reorder_listing_images (42501)
-- ----------------------------------------------------------------------------
do $$
begin
  begin
    perform public.admin_reorder_listing_images(
      'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
      '[]'::jsonb
    );
    raise exception 'Regular user unexpectedly allowed to reorder images';
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
-- 12) regular user is rejected by admin_delete_listing_image (42501)
-- ----------------------------------------------------------------------------
do $$
begin
  begin
    perform public.admin_delete_listing_image(
      'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
      'eeeeeeee-ffff-4fff-8fff-fffffffff801'::uuid
    );
    raise exception 'Regular user unexpectedly allowed to delete image';
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
