-- Add nullable housing listing detail fields.

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'listing_heating_type'
  ) then
    create type public.listing_heating_type as enum (
      'central',
      'combi',
      'floor_heating',
      'stove',
      'air_conditioning',
      'none',
      'other'
    );
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'listing_fuel_type'
  ) then
    create type public.listing_fuel_type as enum (
      'natural_gas',
      'electricity',
      'coal',
      'fuel_oil',
      'none',
      'other'
    );
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'listing_parking_type'
  ) then
    create type public.listing_parking_type as enum (
      'open',
      'closed',
      'open_closed',
      'none',
      'other'
    );
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'listing_usage_status'
  ) then
    create type public.listing_usage_status as enum (
      'empty',
      'tenant_occupied',
      'owner_occupied',
      'unknown'
    );
  end if;
end;
$$;

alter table public.listings
  add column if not exists heating_type public.listing_heating_type,
  add column if not exists fuel_type public.listing_fuel_type,
  add column if not exists balcony_count integer,
  add column if not exists has_elevator boolean,
  add column if not exists parking_type public.listing_parking_type,
  add column if not exists in_site boolean,
  add column if not exists building_age integer,
  add column if not exists floor_count integer,
  add column if not exists floor_number text,
  add column if not exists usage_status public.listing_usage_status,
  add column if not exists facade text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'listings_balcony_count_non_negative'
      and conrelid = 'public.listings'::regclass
  ) then
    alter table public.listings
      add constraint listings_balcony_count_non_negative
      check (balcony_count is null or balcony_count >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'listings_building_age_non_negative'
      and conrelid = 'public.listings'::regclass
  ) then
    alter table public.listings
      add constraint listings_building_age_non_negative
      check (building_age is null or building_age >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'listings_floor_count_non_negative'
      and conrelid = 'public.listings'::regclass
  ) then
    alter table public.listings
      add constraint listings_floor_count_non_negative
      check (floor_count is null or floor_count >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'listings_floor_number_length'
      and conrelid = 'public.listings'::regclass
  ) then
    alter table public.listings
      add constraint listings_floor_number_length
      check (floor_number is null or char_length(floor_number) <= 80);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'listings_facade_length'
      and conrelid = 'public.listings'::regclass
  ) then
    alter table public.listings
      add constraint listings_facade_length
      check (facade is null or char_length(facade) <= 120);
  end if;
end;
$$;

create or replace function public.get_public_listing_detail(
  p_listing_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_listing public.listings%rowtype;
  v_images jsonb;
begin
  select *
  into v_listing
  from public.listings
  where id = p_listing_id
    and status = 'active';

  if not found then
    raise exception 'listing not found: %', p_listing_id
      using errcode = 'P0002';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', li.id,
        'image_url', li.image_url,
        'alt_text', li.alt_text,
        'sort_order', li.sort_order,
        'is_primary', li.is_primary
      )
      order by li.is_primary desc, li.sort_order, li.created_at, li.id
    ),
    '[]'::jsonb
  )
  into v_images
  from public.listing_images as li
  where li.listing_id = v_listing.id;

  return jsonb_build_object(
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
    'heating_type', v_listing.heating_type,
    'fuel_type', v_listing.fuel_type,
    'balcony_count', v_listing.balcony_count,
    'has_elevator', v_listing.has_elevator,
    'parking_type', v_listing.parking_type,
    'in_site', v_listing.in_site,
    'building_age', v_listing.building_age,
    'floor_count', v_listing.floor_count,
    'floor_number', v_listing.floor_number,
    'usage_status', v_listing.usage_status,
    'facade', v_listing.facade,
    'gross_area_m2', v_listing.gross_area_m2,
    'is_furnished', v_listing.is_furnished,
    'images', v_images,
    'created_at', v_listing.created_at,
    'updated_at', v_listing.updated_at
  );
end;
$$;

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
      'heating_type', v_listing.heating_type,
      'fuel_type', v_listing.fuel_type,
      'balcony_count', v_listing.balcony_count,
      'has_elevator', v_listing.has_elevator,
      'parking_type', v_listing.parking_type,
      'in_site', v_listing.in_site,
      'building_age', v_listing.building_age,
      'floor_count', v_listing.floor_count,
      'floor_number', v_listing.floor_number,
      'usage_status', v_listing.usage_status,
      'facade', v_listing.facade,
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
  v_heating_type public.listing_heating_type;
  v_fuel_type public.listing_fuel_type;
  v_balcony_count integer;
  v_has_elevator boolean;
  v_parking_type public.listing_parking_type;
  v_in_site boolean;
  v_building_age integer;
  v_floor_count integer;
  v_floor_number text;
  v_usage_status public.listing_usage_status;
  v_facade text;
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
  exception when others then
    raise exception 'invalid listing type'
      using errcode = '22023';
  end;

  begin
    v_status := coalesce((p_payload ->> 'status')::public.listing_status, 'passive'::public.listing_status);
  exception when others then
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
  v_floor_number := nullif(btrim(p_payload ->> 'floor_number'), '');
  v_facade := nullif(btrim(p_payload ->> 'facade'), '');

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

  if v_floor_number is not null and char_length(v_floor_number) > 80 then
    raise exception 'invalid listing floor number'
      using errcode = '22023';
  end if;

  if v_facade is not null and char_length(v_facade) > 120 then
    raise exception 'invalid listing facade'
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
    v_balcony_count := nullif(p_payload ->> 'balcony_count', '')::integer;
    v_building_age := nullif(p_payload ->> 'building_age', '')::integer;
    v_floor_count := nullif(p_payload ->> 'floor_count', '')::integer;
  exception when others then
    raise exception 'invalid listing numeric detail'
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

  if v_balcony_count is not null and v_balcony_count < 0 then
    raise exception 'invalid listing balcony count'
      using errcode = '22023';
  end if;

  if v_building_age is not null and v_building_age < 0 then
    raise exception 'invalid listing building age'
      using errcode = '22023';
  end if;

  if v_floor_count is not null and v_floor_count < 0 then
    raise exception 'invalid listing floor count'
      using errcode = '22023';
  end if;

  begin
    v_heating_type := nullif(p_payload ->> 'heating_type', '')::public.listing_heating_type;
    v_fuel_type := nullif(p_payload ->> 'fuel_type', '')::public.listing_fuel_type;
    v_parking_type := nullif(p_payload ->> 'parking_type', '')::public.listing_parking_type;
    v_usage_status := nullif(p_payload ->> 'usage_status', '')::public.listing_usage_status;
  exception when others then
    raise exception 'invalid listing enum detail'
      using errcode = '22023';
  end;

  begin
    v_has_elevator := (p_payload ->> 'has_elevator')::boolean;
    v_in_site := (p_payload ->> 'in_site')::boolean;
    v_is_furnished := coalesce((p_payload ->> 'is_furnished')::boolean, false);
  exception when others then
    raise exception 'invalid listing boolean detail'
      using errcode = '22023';
  end;

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
    heating_type,
    fuel_type,
    balcony_count,
    has_elevator,
    parking_type,
    in_site,
    building_age,
    floor_count,
    floor_number,
    usage_status,
    facade,
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
    v_heating_type,
    v_fuel_type,
    v_balcony_count,
    v_has_elevator,
    v_parking_type,
    v_in_site,
    v_building_age,
    v_floor_count,
    v_floor_number,
    v_usage_status,
    v_facade,
    v_gross_area,
    v_is_furnished
  )
  returning id into v_listing_id;

  return public.admin_get_listing(v_listing_id);
end;
$$;

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
  v_heating_type public.listing_heating_type;
  v_fuel_type public.listing_fuel_type;
  v_balcony_count integer;
  v_has_elevator boolean;
  v_parking_type public.listing_parking_type;
  v_in_site boolean;
  v_building_age integer;
  v_floor_count integer;
  v_floor_number text;
  v_usage_status public.listing_usage_status;
  v_facade text;
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
  v_floor_number := case when p_payload ? 'floor_number' then nullif(btrim(p_payload ->> 'floor_number'), '') else v_listing.floor_number end;
  v_facade := case when p_payload ? 'facade' then nullif(btrim(p_payload ->> 'facade'), '') else v_listing.facade end;

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

  if v_floor_number is not null and char_length(v_floor_number) > 80 then
    raise exception 'invalid listing floor number'
      using errcode = '22023';
  end if;

  if v_facade is not null and char_length(v_facade) > 120 then
    raise exception 'invalid listing facade'
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

  if p_payload ? 'balcony_count' then
    begin
      v_balcony_count := nullif(p_payload ->> 'balcony_count', '')::integer;
    exception when others then
      raise exception 'invalid listing balcony count'
        using errcode = '22023';
    end;
    if v_balcony_count is not null and v_balcony_count < 0 then
      raise exception 'invalid listing balcony count'
        using errcode = '22023';
    end if;
  else
    v_balcony_count := v_listing.balcony_count;
  end if;

  if p_payload ? 'building_age' then
    begin
      v_building_age := nullif(p_payload ->> 'building_age', '')::integer;
    exception when others then
      raise exception 'invalid listing building age'
        using errcode = '22023';
    end;
    if v_building_age is not null and v_building_age < 0 then
      raise exception 'invalid listing building age'
        using errcode = '22023';
    end if;
  else
    v_building_age := v_listing.building_age;
  end if;

  if p_payload ? 'floor_count' then
    begin
      v_floor_count := nullif(p_payload ->> 'floor_count', '')::integer;
    exception when others then
      raise exception 'invalid listing floor count'
        using errcode = '22023';
    end;
    if v_floor_count is not null and v_floor_count < 0 then
      raise exception 'invalid listing floor count'
        using errcode = '22023';
    end if;
  else
    v_floor_count := v_listing.floor_count;
  end if;

  begin
    v_heating_type := case when p_payload ? 'heating_type' then nullif(p_payload ->> 'heating_type', '')::public.listing_heating_type else v_listing.heating_type end;
    v_fuel_type := case when p_payload ? 'fuel_type' then nullif(p_payload ->> 'fuel_type', '')::public.listing_fuel_type else v_listing.fuel_type end;
    v_parking_type := case when p_payload ? 'parking_type' then nullif(p_payload ->> 'parking_type', '')::public.listing_parking_type else v_listing.parking_type end;
    v_usage_status := case when p_payload ? 'usage_status' then nullif(p_payload ->> 'usage_status', '')::public.listing_usage_status else v_listing.usage_status end;
  exception when others then
    raise exception 'invalid listing enum detail'
      using errcode = '22023';
  end;

  begin
    v_has_elevator := case when p_payload ? 'has_elevator' then (p_payload ->> 'has_elevator')::boolean else v_listing.has_elevator end;
    v_in_site := case when p_payload ? 'in_site' then (p_payload ->> 'in_site')::boolean else v_listing.in_site end;
    v_is_furnished := case when p_payload ? 'is_furnished' then coalesce((p_payload ->> 'is_furnished')::boolean, v_listing.is_furnished) else v_listing.is_furnished end;
  exception when others then
    raise exception 'invalid listing boolean detail'
      using errcode = '22023';
  end;

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
    heating_type = v_heating_type,
    fuel_type = v_fuel_type,
    balcony_count = v_balcony_count,
    has_elevator = v_has_elevator,
    parking_type = v_parking_type,
    in_site = v_in_site,
    building_age = v_building_age,
    floor_count = v_floor_count,
    floor_number = v_floor_number,
    usage_status = v_usage_status,
    facade = v_facade,
    gross_area_m2 = v_gross_area,
    is_furnished = v_is_furnished
  where id = v_listing.id;

  return public.admin_get_listing(v_listing.id);
end;
$$;
