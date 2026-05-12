-- Publish guard: require description, district, and at least one image
-- before allowing any listing (sale or rent) to go active.
--
-- This prevents admins from publishing empty/incomplete listings.
-- Rent listings still additionally require checkout-readiness (main item).
--
-- Returns a text[] of missing requirement keys so the admin UI can show
-- which fields need to be filled before publishing.

-- ----------------------------------------------------------------------------
-- Helper: returns an array of missing publish requirements for a listing.
-- Empty array = ready to publish.
-- ----------------------------------------------------------------------------
create or replace function public.admin_listing_publish_missing(
  p_listing_id uuid
)
returns text[]
language plpgsql
security invoker
set search_path = ''
stable
as $$
declare
  v_listing public.listings%rowtype;
  v_missing text[] := '{}';
begin
  select * into v_listing
  from public.listings
  where id = p_listing_id;

  if not found then
    return array['listing_not_found'];
  end if;

  -- description is required
  if nullif(btrim(coalesce(v_listing.description, '')), '') is null then
    v_missing := array_append(v_missing, 'description');
  end if;

  -- district is required
  if nullif(btrim(coalesce(v_listing.district, '')), '') is null then
    v_missing := array_append(v_missing, 'district');
  end if;

  -- at least one image is required
  if not exists (
    select 1 from public.listing_images
    where listing_id = p_listing_id
  ) then
    v_missing := array_append(v_missing, 'image');
  end if;

  return v_missing;
end;
$$;

-- ----------------------------------------------------------------------------
-- Convenience boolean wrapper
-- ----------------------------------------------------------------------------
create or replace function public.admin_listing_is_publish_ready(
  p_listing_id uuid
)
returns boolean
language sql
security invoker
set search_path = ''
stable
as $$
  select array_length(public.admin_listing_publish_missing(p_listing_id), 1) is null;
$$;

-- ----------------------------------------------------------------------------
-- Update admin_set_listing_status to enforce publish guard for ALL listing types
-- before checking rent-specific checkout readiness.
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
  v_publish_missing text[];
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

  -- Publish guard: all listing types must have description, district, and image
  if p_status = 'active' then
    v_publish_missing := public.admin_listing_publish_missing(v_listing.id);
    if array_length(v_publish_missing, 1) is not null then
      raise exception 'publish-guard: %', array_to_string(v_publish_missing, ', ')
        using errcode = 'P0004';
    end if;
  end if;

  -- Rent-specific: checkout readiness (main item + service)
  if v_listing.type = 'rent'
     and p_status = 'active'
     and not public.admin_listing_is_checkout_ready(v_listing.id) then
    raise exception 'checkout-not-ready'
      using errcode = 'P0004';
  end if;

  update public.listings
  set status = p_status
  where id = v_listing.id;

  return public.admin_get_listing(v_listing.id);
end;
$$;

-- ----------------------------------------------------------------------------
-- Update admin_get_listing to include publish_missing in the response
-- so the UI can show which fields need filling.
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
  v_publish_missing text[];
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
  v_publish_missing := public.admin_listing_publish_missing(v_listing.id);

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
    ),
    'publish_readiness', jsonb_build_object(
      'is_publish_ready', (array_length(v_publish_missing, 1) is null),
      'missing', to_jsonb(v_publish_missing)
    )
  );
end;
$$;

-- Grant execute on new functions
grant execute on function public.admin_listing_publish_missing(uuid) to authenticated;
grant execute on function public.admin_listing_is_publish_ready(uuid) to authenticated;
