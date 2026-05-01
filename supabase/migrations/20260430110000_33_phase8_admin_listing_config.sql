-- Phase 8.1 + 8.2: admin listing read snapshot and lifecycle write RPCs.
--
-- Contract: docs/ADMIN_LISTING_CONFIG_CONTRACT.md
-- - Phase 8.1 (read):
--     admin_list_listings(p_status, p_type, p_limit, p_offset)
--     admin_get_listing(p_listing_id)
-- - Phase 8.2 (write):
--     admin_create_listing(p_payload)
--     admin_update_listing(p_listing_id, p_payload)
--     admin_set_listing_status(p_listing_id, p_status)
--
-- All RPCs run as security invoker, gated by auth.uid() + public.is_admin().
-- DB error codes used by callers:
--   28000 -> 401 (unauthenticated)
--   42501 -> 403 (admin role required)
--   22023 -> 400 (invalid request: pagination, payload shape, enum, slug)
--   23505 -> 409 (slug uniqueness violation, duplicate option key)
--   P0002 -> 404 (listing not found)
--   P0004 -> 422 (invariant violation, e.g. rent activation w/o checkout config)

-- ----------------------------------------------------------------------------
-- 8.1 admin_list_listings: paginated admin listing list with summary stats.
-- ----------------------------------------------------------------------------
create or replace function public.admin_list_listings(
  p_status public.listing_status default null,
  p_type public.listing_type default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
stable
as $$
declare
  v_items jsonb;
begin
  if auth.uid() is null then
    raise exception 'authenticated admin is required'
      using errcode = '28000';
  end if;

  if not (select public.is_admin()) then
    raise exception 'admin role is required'
      using errcode = '42501';
  end if;

  if p_limit is null or p_offset is null or p_limit < 1 or p_limit > 100 or p_offset < 0 then
    raise exception 'invalid pagination'
      using errcode = '22023';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', l.id,
        'type', l.type,
        'status', l.status,
        'title', l.title,
        'slug', l.slug,
        'city', l.city,
        'district', l.district,
        'price', l.price,
        'currency', l.currency,
        'is_furnished', l.is_furnished,
        'image_count', coalesce(stats.image_count, 0),
        'main_item_count', coalesce(stats.main_item_count, 0),
        'service_option_count', coalesce(stats.service_option_count, 0),
        'is_checkout_ready', coalesce(stats.is_checkout_ready, false),
        'created_at', l.created_at,
        'updated_at', l.updated_at
      )
      order by l.created_at desc, l.id
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select *
    from public.listings
    where (p_status is null or status = p_status)
      and (p_type is null or type = p_type)
    order by created_at desc, id
    limit p_limit
    offset p_offset
  ) as l
  left join lateral (
    select
      (select count(*) from public.listing_images i where i.listing_id = l.id) as image_count,
      (select count(*) from public.listing_main_item_options m where m.listing_id = l.id) as main_item_count,
      (select count(*) from public.listing_service_options s where s.listing_id = l.id) as service_option_count,
      public.admin_listing_is_checkout_ready(l.id) as is_checkout_ready
  ) as stats on true;

  return jsonb_build_object(
    'items', v_items,
    'limit', p_limit,
    'offset', p_offset
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 8.1 admin_get_listing: full admin snapshot for one listing.
-- ----------------------------------------------------------------------------
create or replace function public.admin_get_listing(
  p_listing_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
stable
as $$
declare
  v_listing public.listings%rowtype;
  v_images jsonb;
  v_main_items jsonb;
  v_services jsonb;
  v_available_main_items jsonb;
  v_available_services jsonb;
  v_is_checkout_ready boolean;
  v_missing text[] := array[]::text[];
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

  select * into v_listing
  from public.listings
  where id = p_listing_id;

  if not found then
    raise exception 'listing not found'
      using errcode = 'P0002';
  end if;

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
  where i.listing_id = v_listing.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', lmo.id,
        'main_item_id', lmo.main_item_id,
        'code', mic.code,
        'label', mic.label,
        'pricing_strategy', mic.pricing_strategy,
        'default_amount', mic.default_amount,
        'default_multiplier', mic.default_multiplier,
        'override_label', lmo.override_label,
        'override_amount', lmo.override_amount,
        'override_multiplier', lmo.override_multiplier,
        'is_enabled', lmo.is_enabled,
        'sort_order', lmo.sort_order,
        'catalog_is_active', mic.is_active
      )
      order by lmo.sort_order, mic.sort_order, mic.code
    ),
    '[]'::jsonb
  )
  into v_main_items
  from public.listing_main_item_options lmo
  join public.main_item_catalog mic on mic.id = lmo.main_item_id
  where lmo.listing_id = v_listing.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', lso.id,
        'service_id', lso.service_id,
        'code', sc.code,
        'name', sc.name,
        'base_price', sc.base_price,
        'override_price', lso.override_price,
        'is_enabled', lso.is_enabled,
        'catalog_is_active', sc.is_active
      )
      order by sc.code
    ),
    '[]'::jsonb
  )
  into v_services
  from public.listing_service_options lso
  join public.service_catalog sc on sc.id = lso.service_id
  where lso.listing_id = v_listing.id;

  -- Phase 8.5: available catalog items for picker UI
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', mic.id,
        'code', mic.code,
        'label', mic.label,
        'pricing_strategy', mic.pricing_strategy,
        'default_amount', mic.default_amount,
        'default_multiplier', mic.default_multiplier,
        'is_active', mic.is_active,
        'sort_order', mic.sort_order
      )
      order by mic.sort_order, mic.code
    ),
    '[]'::jsonb
  )
  into v_available_main_items
  from public.main_item_catalog mic
  where mic.is_active = true;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', sc.id,
        'code', sc.code,
        'name', sc.name,
        'base_price', sc.base_price,
        'is_active', sc.is_active
      )
      order by sc.code
    ),
    '[]'::jsonb
  )
  into v_available_services
  from public.service_catalog sc
  where sc.is_active = true;

  v_is_checkout_ready := public.admin_listing_is_checkout_ready(v_listing.id);

  if not exists (
    select 1
    from public.listing_main_item_options m
    join public.main_item_catalog mc on mc.id = m.main_item_id
    where m.listing_id = v_listing.id
      and m.is_enabled = true
      and mc.is_active = true
  ) then
    v_missing := array_append(v_missing, 'enabled_main_item');
  end if;

  if not exists (
    select 1
    from public.listing_service_options s
    join public.service_catalog sc on sc.id = s.service_id
    where s.listing_id = v_listing.id
      and s.is_enabled = true
      and sc.is_active = true
  ) then
    v_missing := array_append(v_missing, 'enabled_service_option');
  end if;

  return jsonb_build_object(
    'listing', jsonb_build_object(
      'id', v_listing.id,
      'type', v_listing.type,
      'status', v_listing.status,
      'title', v_listing.title,
      'slug', v_listing.slug,
      'summary', v_listing.summary,
      'description', v_listing.description,
      'city', v_listing.city,
      'district', v_listing.district,
      'price', v_listing.price,
      'currency', v_listing.currency,
      'room_count', v_listing.room_count,
      'bathroom_count', v_listing.bathroom_count,
      'gross_area_m2', v_listing.gross_area_m2,
      'is_furnished', v_listing.is_furnished,
      'created_at', v_listing.created_at,
      'updated_at', v_listing.updated_at
    ),
    'images', v_images,
    'main_item_options', v_main_items,
    'service_options', v_services,
    'available_main_items', v_available_main_items,
    'available_services', v_available_services,
    'checkout_eligibility', jsonb_build_object(
      'is_checkout_ready', v_is_checkout_ready,
      'missing', to_jsonb(v_missing)
    )
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 8.2 internal helper: rent listings need an enabled+active main item to flip
-- to active. Sale listings are unrestricted.
-- ----------------------------------------------------------------------------
create or replace function public.admin_listing_is_checkout_ready(
  p_listing_id uuid
)
returns boolean
language sql
security invoker
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.listing_main_item_options m
    join public.main_item_catalog mc on mc.id = m.main_item_id
    where m.listing_id = p_listing_id
      and m.is_enabled = true
      and mc.is_active = true
  )
  and exists (
    select 1
    from public.listing_service_options s
    join public.service_catalog sc on sc.id = s.service_id
    where s.listing_id = p_listing_id
      and s.is_enabled = true
      and sc.is_active = true
  );
$$;

-- ----------------------------------------------------------------------------
-- 8.2 admin_create_listing: create a listing from a JSON payload.
-- ----------------------------------------------------------------------------
create or replace function public.admin_create_listing(
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
volatile
as $$
declare
  v_type public.listing_type;
  v_status public.listing_status;
  v_title text;
  v_slug text;
  v_summary text;
  v_description text;
  v_city text;
  v_district text;
  v_price numeric(12, 2);
  v_currency text;
  v_room_count integer;
  v_bathroom_count integer;
  v_gross_area numeric(10, 2);
  v_is_furnished boolean;
  v_listing_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authenticated admin is required'
      using errcode = '28000';
  end if;

  if not (select public.is_admin()) then
    raise exception 'admin role is required'
      using errcode = '42501';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid admin listing payload'
      using errcode = '22023';
  end if;

  begin
    v_type := (p_payload ->> 'type')::public.listing_type;
  exception when invalid_text_representation or others then
    raise exception 'invalid listing type'
      using errcode = '22023';
  end;

  begin
    v_status := coalesce((p_payload ->> 'status')::public.listing_status, 'passive'::public.listing_status);
  exception when invalid_text_representation or others then
    raise exception 'invalid listing status'
      using errcode = '22023';
  end;

  v_title := nullif(btrim(p_payload ->> 'title'), '');
  v_slug := lower(nullif(btrim(p_payload ->> 'slug'), ''));
  v_summary := nullif(btrim(p_payload ->> 'summary'), '');
  v_description := nullif(btrim(p_payload ->> 'description'), '');
  v_city := nullif(btrim(p_payload ->> 'city'), '');
  v_district := nullif(btrim(p_payload ->> 'district'), '');
  v_currency := upper(coalesce(nullif(btrim(p_payload ->> 'currency'), ''), 'TRY'));

  if v_title is null or char_length(v_title) > 200 then
    raise exception 'invalid listing title'
      using errcode = '22023';
  end if;

  if v_slug is null or v_slug !~ '^[a-z0-9][a-z0-9-]*$' or char_length(v_slug) > 120 then
    raise exception 'invalid listing slug'
      using errcode = '22023';
  end if;

  if v_city is null or char_length(v_city) > 100 then
    raise exception 'invalid listing city'
      using errcode = '22023';
  end if;

  if char_length(v_currency) <> 3 then
    raise exception 'invalid listing currency'
      using errcode = '22023';
  end if;

  begin
    v_price := (p_payload ->> 'price')::numeric(12, 2);
  exception when others then
    raise exception 'invalid listing price'
      using errcode = '22023';
  end;

  if v_price is null or v_price < 0 then
    raise exception 'invalid listing price'
      using errcode = '22023';
  end if;

  begin
    v_room_count := nullif(p_payload ->> 'room_count', '')::integer;
    v_bathroom_count := nullif(p_payload ->> 'bathroom_count', '')::integer;
  exception when others then
    raise exception 'invalid listing room/bathroom count'
      using errcode = '22023';
  end;

  if v_room_count is not null and v_room_count < 0 then
    raise exception 'invalid listing room count'
      using errcode = '22023';
  end if;

  if v_bathroom_count is not null and v_bathroom_count < 0 then
    raise exception 'invalid listing bathroom count'
      using errcode = '22023';
  end if;

  begin
    v_gross_area := nullif(p_payload ->> 'gross_area_m2', '')::numeric(10, 2);
  exception when others then
    raise exception 'invalid listing gross area'
      using errcode = '22023';
  end;

  if v_gross_area is not null and v_gross_area < 0 then
    raise exception 'invalid listing gross area'
      using errcode = '22023';
  end if;

  v_is_furnished := coalesce((p_payload ->> 'is_furnished')::boolean, false);

  if v_type = 'rent' and v_status = 'active' then
    raise exception 'rent listing is not checkout-ready'
      using errcode = 'P0004';
  end if;

  insert into public.listings (
    type,
    status,
    title,
    slug,
    summary,
    description,
    city,
    district,
    price,
    currency,
    room_count,
    bathroom_count,
    gross_area_m2,
    is_furnished
  )
  values (
    v_type,
    v_status,
    v_title,
    v_slug,
    v_summary,
    v_description,
    v_city,
    v_district,
    v_price,
    v_currency,
    v_room_count,
    v_bathroom_count,
    v_gross_area,
    v_is_furnished
  )
  returning id into v_listing_id;

  return public.admin_get_listing(v_listing_id);
end;
$$;

-- ----------------------------------------------------------------------------
-- 8.2 admin_update_listing: patch a listing from a JSON payload (partial).
-- Status transitions go through admin_set_listing_status for invariant guard.
-- ----------------------------------------------------------------------------
create or replace function public.admin_update_listing(
  p_listing_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
volatile
as $$
declare
  v_listing public.listings%rowtype;
  v_title text;
  v_slug text;
  v_summary text;
  v_description text;
  v_city text;
  v_district text;
  v_price numeric(12, 2);
  v_currency text;
  v_room_count integer;
  v_bathroom_count integer;
  v_gross_area numeric(10, 2);
  v_is_furnished boolean;
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

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid admin listing payload'
      using errcode = '22023';
  end if;

  if p_payload ? 'type' then
    raise exception 'listing type is immutable'
      using errcode = '22023';
  end if;

  if p_payload ? 'status' then
    raise exception 'use admin_set_listing_status to change status'
      using errcode = '22023';
  end if;

  select * into v_listing
  from public.listings
  where id = p_listing_id
  for update;

  if not found then
    raise exception 'listing not found'
      using errcode = 'P0002';
  end if;

  v_title := case when p_payload ? 'title' then nullif(btrim(p_payload ->> 'title'), '') else v_listing.title end;
  v_slug := case when p_payload ? 'slug' then lower(nullif(btrim(p_payload ->> 'slug'), '')) else v_listing.slug end;
  v_summary := case when p_payload ? 'summary' then nullif(btrim(p_payload ->> 'summary'), '') else v_listing.summary end;
  v_description := case when p_payload ? 'description' then nullif(btrim(p_payload ->> 'description'), '') else v_listing.description end;
  v_city := case when p_payload ? 'city' then nullif(btrim(p_payload ->> 'city'), '') else v_listing.city end;
  v_district := case when p_payload ? 'district' then nullif(btrim(p_payload ->> 'district'), '') else v_listing.district end;
  v_currency := case when p_payload ? 'currency' then upper(coalesce(nullif(btrim(p_payload ->> 'currency'), ''), v_listing.currency)) else v_listing.currency end;
  v_is_furnished := case when p_payload ? 'is_furnished' then coalesce((p_payload ->> 'is_furnished')::boolean, v_listing.is_furnished) else v_listing.is_furnished end;

  if v_title is null or char_length(v_title) > 200 then
    raise exception 'invalid listing title'
      using errcode = '22023';
  end if;

  if v_slug is null or v_slug !~ '^[a-z0-9][a-z0-9-]*$' or char_length(v_slug) > 120 then
    raise exception 'invalid listing slug'
      using errcode = '22023';
  end if;

  if v_city is null or char_length(v_city) > 100 then
    raise exception 'invalid listing city'
      using errcode = '22023';
  end if;

  if char_length(v_currency) <> 3 then
    raise exception 'invalid listing currency'
      using errcode = '22023';
  end if;

  if p_payload ? 'price' then
    begin
      v_price := (p_payload ->> 'price')::numeric(12, 2);
    exception when others then
      raise exception 'invalid listing price'
        using errcode = '22023';
    end;
    if v_price is null or v_price < 0 then
      raise exception 'invalid listing price'
        using errcode = '22023';
    end if;
  else
    v_price := v_listing.price;
  end if;

  if p_payload ? 'room_count' then
    begin
      v_room_count := nullif(p_payload ->> 'room_count', '')::integer;
    exception when others then
      raise exception 'invalid listing room count'
        using errcode = '22023';
    end;
    if v_room_count is not null and v_room_count < 0 then
      raise exception 'invalid listing room count'
        using errcode = '22023';
    end if;
  else
    v_room_count := v_listing.room_count;
  end if;

  if p_payload ? 'bathroom_count' then
    begin
      v_bathroom_count := nullif(p_payload ->> 'bathroom_count', '')::integer;
    exception when others then
      raise exception 'invalid listing bathroom count'
        using errcode = '22023';
    end;
    if v_bathroom_count is not null and v_bathroom_count < 0 then
      raise exception 'invalid listing bathroom count'
        using errcode = '22023';
    end if;
  else
    v_bathroom_count := v_listing.bathroom_count;
  end if;

  if p_payload ? 'gross_area_m2' then
    begin
      v_gross_area := nullif(p_payload ->> 'gross_area_m2', '')::numeric(10, 2);
    exception when others then
      raise exception 'invalid listing gross area'
        using errcode = '22023';
    end;
    if v_gross_area is not null and v_gross_area < 0 then
      raise exception 'invalid listing gross area'
        using errcode = '22023';
    end if;
  else
    v_gross_area := v_listing.gross_area_m2;
  end if;

  update public.listings
  set
    title = v_title,
    slug = v_slug,
    summary = v_summary,
    description = v_description,
    city = v_city,
    district = v_district,
    price = v_price,
    currency = v_currency,
    room_count = v_room_count,
    bathroom_count = v_bathroom_count,
    gross_area_m2 = v_gross_area,
    is_furnished = v_is_furnished
  where id = v_listing.id;

  return public.admin_get_listing(v_listing.id);
end;
$$;

-- ----------------------------------------------------------------------------
-- 8.2 admin_set_listing_status: status transition with sale/rent invariants.
-- ----------------------------------------------------------------------------
create or replace function public.admin_set_listing_status(
  p_listing_id uuid,
  p_status public.listing_status
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
volatile
as $$
declare
  v_listing public.listings%rowtype;
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

  if p_status is null then
    raise exception 'invalid listing status'
      using errcode = '22023';
  end if;

  select * into v_listing
  from public.listings
  where id = p_listing_id
  for update;

  if not found then
    raise exception 'listing not found'
      using errcode = 'P0002';
  end if;

  if v_listing.status = p_status then
    return public.admin_get_listing(v_listing.id);
  end if;

  if v_listing.type = 'rent'
     and p_status = 'active'
     and not public.admin_listing_is_checkout_ready(v_listing.id) then
    raise exception 'rent listing is not checkout-ready'
      using errcode = 'P0004';
  end if;

  update public.listings
  set status = p_status
  where id = v_listing.id;

  return public.admin_get_listing(v_listing.id);
end;
$$;

-- Grant execution to authenticated; the RPC bodies enforce admin via
-- auth.uid() + public.is_admin().
grant execute on function public.admin_list_listings(public.listing_status, public.listing_type, integer, integer) to authenticated;
grant execute on function public.admin_get_listing(uuid) to authenticated;
grant execute on function public.admin_listing_is_checkout_ready(uuid) to authenticated;
grant execute on function public.admin_create_listing(jsonb) to authenticated;
grant execute on function public.admin_update_listing(uuid, jsonb) to authenticated;
grant execute on function public.admin_set_listing_status(uuid, public.listing_status) to authenticated;
