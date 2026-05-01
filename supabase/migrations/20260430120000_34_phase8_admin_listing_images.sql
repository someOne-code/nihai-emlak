-- Phase 8.3: admin listing image management RPCs.
--
-- Contract: docs/ADMIN_LISTING_CONFIG_CONTRACT.md
-- - admin_add_listing_image(p_listing_id, p_image_url, p_alt_text, p_is_primary)
-- - admin_reorder_listing_images(p_listing_id, p_order)
-- - admin_delete_listing_image(p_listing_id, p_image_id)
--
-- All RPCs run as security invoker, gated by auth.uid() + public.is_admin().
-- DB error codes used by callers:
--   28000 -> 401 (unauthenticated)
--   42501 -> 403 (admin role required)
--   22023 -> 400 (invalid request: payload shape, uuid, url)
--   P0002 -> 404 (listing or image not found)
--   23505 -> 409 (duplicate primary conflict, though we atomically demote)

-- ----------------------------------------------------------------------------
-- 8.3 admin_add_listing_image: add an image record to a listing.
-- If p_is_primary is true, atomically demotes any existing primary image.
-- ----------------------------------------------------------------------------
create or replace function public.admin_add_listing_image(
  p_listing_id uuid,
  p_image_url text,
  p_alt_text text default null,
  p_is_primary boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
volatile
as $$
declare
  v_listing_exists boolean;
  v_next_sort_order integer;
  v_image_id uuid;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'authenticated admin is required'
      using errcode = '28000';
  end if;

  if not (select public.is_admin()) then
    raise exception 'admin role is required'
      using errcode = '42501';
  end if;

  if p_listing_id is null then
    raise exception 'invalid listing id'
      using errcode = '22023';
  end if;

  if p_image_url is null or btrim(p_image_url) = '' then
    raise exception 'invalid image url'
      using errcode = '22023';
  end if;

  select exists (
    select 1 from public.listings where id = p_listing_id
  ) into v_listing_exists;

  if not v_listing_exists then
    raise exception 'listing not found'
      using errcode = 'P0002';
  end if;

  -- Atomically demote any existing primary image for this listing.
  if p_is_primary then
    update public.listing_images
    set is_primary = false
    where listing_id = p_listing_id
      and is_primary = true;
  end if;

  -- Determine next sort_order.
  select coalesce(max(sort_order), -1) + 1
  into v_next_sort_order
  from public.listing_images
  where listing_id = p_listing_id;

  insert into public.listing_images (
    listing_id, image_url, alt_text, sort_order, is_primary
  )
  values (
    p_listing_id,
    btrim(p_image_url),
    nullif(btrim(p_alt_text), ''),
    v_next_sort_order,
    p_is_primary
  )
  returning id into v_image_id;

  select jsonb_build_object(
    'id', i.id,
    'image_url', i.image_url,
    'alt_text', i.alt_text,
    'sort_order', i.sort_order,
    'is_primary', i.is_primary,
    'created_at', i.created_at
  )
  into v_result
  from public.listing_images i
  where i.id = v_image_id;

  return v_result;
end;
$$;

-- ----------------------------------------------------------------------------
-- 8.3 admin_reorder_listing_images: accept ordered array of image ids and
-- rewrite sort_order atomically. Validates all ids belong to the listing.
-- ----------------------------------------------------------------------------
create or replace function public.admin_reorder_listing_images(
  p_listing_id uuid,
  p_order jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
volatile
as $$
declare
  v_listing_exists boolean;
  v_order_ids uuid[];
  v_owned_count integer;
  v_images jsonb;
begin
  if auth.uid() is null then
    raise exception 'authenticated admin is required'
      using errcode = '28000';
  end if;

  if not (select public.is_admin()) then
    raise exception 'admin role is required'
      using errcode = '42501';
  end if;

  if p_listing_id is null then
    raise exception 'invalid listing id'
      using errcode = '22023';
  end if;

  if p_order is null or jsonb_typeof(p_order) <> 'array' then
    raise exception 'invalid image order payload'
      using errcode = '22023';
  end if;

  -- Parse the ordered array of image ids.
  begin
    select array(
      select elem::uuid
      from jsonb_array_elements_text(p_order) as elem
    ) into v_order_ids;
  exception when others then
    raise exception 'invalid image order payload'
      using errcode = '22023';
  end;

  if v_order_ids is null or array_length(v_order_ids, 1) is null then
    raise exception 'invalid image order payload'
      using errcode = '22023';
  end if;

  -- Reject duplicate image ids.
  if (
    select count(distinct id_value)
    from unnest(v_order_ids) as id_value
  ) <> array_length(v_order_ids, 1) then
    raise exception 'invalid image order payload'
      using errcode = '22023';
  end if;

  select exists (
    select 1 from public.listings where id = p_listing_id
  ) into v_listing_exists;

  if not v_listing_exists then
    raise exception 'listing not found'
      using errcode = 'P0002';
  end if;

  -- Verify all provided image ids belong to this listing.
  select count(*)
  into v_owned_count
  from public.listing_images
  where listing_id = p_listing_id
    and id = any(v_order_ids);

  if v_owned_count <> array_length(v_order_ids, 1) then
    raise exception 'one or more image ids do not belong to this listing'
      using errcode = '22023';
  end if;

  -- Atomically rewrite sort_order based on array position.
  for i in 1..array_length(v_order_ids, 1) loop
    update public.listing_images
    set sort_order = i - 1
    where id = v_order_ids[i]
      and listing_id = p_listing_id;
  end loop;

  -- Return the updated image list.
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'image_url', i.image_url,
        'alt_text', i.alt_text,
        'sort_order', i.sort_order,
        'is_primary', i.is_primary,
        'created_at', i.created_at
      )
      order by i.sort_order, i.created_at, i.id
    ),
    '[]'::jsonb
  )
  into v_images
  from public.listing_images i
  where i.listing_id = p_listing_id;

  return v_images;
end;
$$;

-- ----------------------------------------------------------------------------
-- 8.3 admin_delete_listing_image: delete an image record by id.
-- Verifies the image exists (P0002 if not found).
-- ----------------------------------------------------------------------------
create or replace function public.admin_delete_listing_image(
  p_listing_id uuid,
  p_image_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
volatile
as $$
declare
  v_image public.listing_images%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authenticated admin is required'
      using errcode = '28000';
  end if;

  if not (select public.is_admin()) then
    raise exception 'admin role is required'
      using errcode = '42501';
  end if;

  if p_listing_id is null then
    raise exception 'invalid listing id'
      using errcode = '22023';
  end if;

  if p_image_id is null then
    raise exception 'invalid image id'
      using errcode = '22023';
  end if;

  select * into v_image
  from public.listing_images
  where id = p_image_id
    and listing_id = p_listing_id;

  if not found then
    raise exception 'image not found'
      using errcode = 'P0002';
  end if;

  delete from public.listing_images
  where id = p_image_id
    and listing_id = p_listing_id;

  return jsonb_build_object(
    'deleted', true,
    'image_id', p_image_id
  );
end;
$$;

-- Grant execution to authenticated; the RPC bodies enforce admin via
-- auth.uid() + public.is_admin().
grant execute on function public.admin_add_listing_image(uuid, text, text, boolean) to authenticated;
grant execute on function public.admin_reorder_listing_images(uuid, jsonb) to authenticated;
grant execute on function public.admin_delete_listing_image(uuid, uuid) to authenticated;
