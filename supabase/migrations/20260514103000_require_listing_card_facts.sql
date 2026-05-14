-- Require the facts shown on public listing cards before a listing can be
-- published. Public read models also hide any legacy active rows that are
-- missing those facts.

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

  if nullif(btrim(coalesce(v_listing.description, '')), '') is null then
    v_missing := array_append(v_missing, 'description');
  end if;

  if nullif(btrim(coalesce(v_listing.district, '')), '') is null then
    v_missing := array_append(v_missing, 'district');
  end if;

  if v_listing.room_count is null then
    v_missing := array_append(v_missing, 'room_count');
  end if;

  if v_listing.bathroom_count is null then
    v_missing := array_append(v_missing, 'bathroom_count');
  end if;

  if v_listing.gross_area_m2 is null or v_listing.gross_area_m2 <= 0 then
    v_missing := array_append(v_missing, 'gross_area_m2');
  end if;

  if not exists (
    select 1
    from public.listing_images
    where listing_id = p_listing_id
  ) then
    v_missing := array_append(v_missing, 'image');
  end if;

  return v_missing;
end;
$$;

update public.listings
set status = 'passive'::public.listing_status
where status = 'active'::public.listing_status
  and (
    room_count is null
    or bathroom_count is null
    or gross_area_m2 is null
    or gross_area_m2 <= 0
  );

create or replace function public.enforce_listing_publish_ready()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_missing text[] := '{}';
begin
  if new.status <> 'active'::public.listing_status then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if current_user = 'postgres' then
      return new;
    end if;

    raise exception 'active listing insert must use admin_set_listing_status'
      using errcode = 'P0004';
  end if;

  if nullif(btrim(coalesce(new.description, '')), '') is null then
    v_missing := array_append(v_missing, 'description');
  end if;

  if nullif(btrim(coalesce(new.district, '')), '') is null then
    v_missing := array_append(v_missing, 'district');
  end if;

  if new.room_count is null then
    v_missing := array_append(v_missing, 'room_count');
  end if;

  if new.bathroom_count is null then
    v_missing := array_append(v_missing, 'bathroom_count');
  end if;

  if new.gross_area_m2 is null or new.gross_area_m2 <= 0 then
    v_missing := array_append(v_missing, 'gross_area_m2');
  end if;

  if tg_op = 'UPDATE' and not exists (
    select 1
    from public.listing_images
    where listing_id = new.id
  ) then
    v_missing := array_append(v_missing, 'image');
  end if;

  if array_length(v_missing, 1) is not null then
    raise exception 'publish-guard: %', array_to_string(v_missing, ', ')
      using errcode = 'P0004';
  end if;

  if new.type = 'rent'::public.listing_type
     and not public.admin_listing_is_checkout_ready(new.id) then
    raise exception 'checkout-not-ready'
      using errcode = 'P0004';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_listings_enforce_publish_ready on public.listings;
create trigger trg_listings_enforce_publish_ready
before insert or update of status, description, district, room_count, bathroom_count, gross_area_m2
on public.listings
for each row
execute function public.enforce_listing_publish_ready();

create or replace function public.list_public_listings(
  p_type public.listing_type default null,
  p_city text default null,
  p_limit integer default 20,
  p_offset integer default 0,
  p_district text default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_min_rooms integer default null,
  p_min_bathrooms integer default null,
  p_min_area numeric default null,
  p_max_area numeric default null,
  p_is_furnished boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_items jsonb;
begin
  if p_limit is null or p_offset is null or p_limit < 1 or p_limit > 100 or p_offset < 0 then
    raise exception 'invalid pagination'
      using errcode = '22023';
  end if;

  if p_min_price < 0
    or p_max_price < 0
    or p_min_rooms < 0
    or p_min_bathrooms < 0
    or p_min_area < 0
    or p_max_area < 0 then
    raise exception 'invalid listing filters'
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
        'summary', l.summary,
        'city', l.city,
        'district', l.district,
        'price', l.price,
        'currency', l.currency,
        'room_count', l.room_count,
        'bathroom_count', l.bathroom_count,
        'gross_area_m2', l.gross_area_m2,
        'is_furnished', l.is_furnished,
        'primary_image_url', img.image_url,
        'primary_image_card_url', img.card_image_url,
        'primary_image_detail_url', img.detail_image_url,
        'created_at', l.created_at
      )
      order by l.created_at desc, l.id
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select *
    from public.listings
    where status = 'active'
      and room_count is not null
      and bathroom_count is not null
      and gross_area_m2 is not null
      and gross_area_m2 > 0
      and (p_type is null or type = p_type)
      and (nullif(btrim(p_city), '') is null or city ilike '%' || btrim(p_city) || '%')
      and (nullif(btrim(p_district), '') is null or district ilike '%' || btrim(p_district) || '%')
      and (p_min_price is null or price >= p_min_price)
      and (p_max_price is null or price <= p_max_price)
      and (p_min_rooms is null or room_count >= p_min_rooms)
      and (p_min_bathrooms is null or bathroom_count >= p_min_bathrooms)
      and (p_min_area is null or gross_area_m2 >= p_min_area)
      and (p_max_area is null or gross_area_m2 <= p_max_area)
      and (p_is_furnished is null or is_furnished = p_is_furnished)
    order by created_at desc, id
    limit p_limit
    offset p_offset
  ) as l
  left join lateral (
    select li.image_url, li.card_image_url, li.detail_image_url
    from public.listing_images as li
    where li.listing_id = l.id
    order by li.is_primary desc, li.sort_order, li.created_at, li.id
    limit 1
  ) as img on true;

  return jsonb_build_object(
    'items', v_items,
    'limit', p_limit,
    'offset', p_offset
  );
end;
$$;

create or replace function public.get_public_listing_filters()
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  with active_listings as (
    select
      nullif(btrim(l.city), '') as city,
      nullif(btrim(l.district), '') as district,
      l.price,
      l.gross_area_m2
    from public.listings as l
    where l.status = 'active'
      and l.room_count is not null
      and l.bathroom_count is not null
      and l.gross_area_m2 is not null
      and l.gross_area_m2 > 0
  ),
  city_options as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'value', city,
          'label', city,
          'count', listing_count
        )
        order by city
      ),
      '[]'::jsonb
    ) as items
    from (
      select city, count(*)::integer as listing_count
      from active_listings
      where city is not null
      group by city
    ) as c
  ),
  district_options as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'city', city,
          'value', district,
          'label', district,
          'count', listing_count
        )
        order by city, district
      ),
      '[]'::jsonb
    ) as items
    from (
      select city, district, count(*)::integer as listing_count
      from active_listings
      where city is not null
        and district is not null
      group by city, district
    ) as d
  ),
  ranges as (
    select
      min(price) as min_price,
      max(price) as max_price,
      min(gross_area_m2) as min_area,
      max(gross_area_m2) as max_area
    from active_listings
  )
  select jsonb_build_object(
    'cities', city_options.items,
    'districts', district_options.items,
    'priceRange', jsonb_build_object(
      'min', ranges.min_price,
      'max', ranges.max_price
    ),
    'areaRange', jsonb_build_object(
      'min', ranges.min_area,
      'max', ranges.max_area
    )
  )
  from city_options, district_options, ranges;
$$;

revoke all on function public.list_public_listings(
  public.listing_type,
  text,
  integer,
  integer,
  text,
  numeric,
  numeric,
  integer,
  integer,
  numeric,
  numeric,
  boolean
)
from public;
grant execute on function public.list_public_listings(
  public.listing_type,
  text,
  integer,
  integer,
  text,
  numeric,
  numeric,
  integer,
  integer,
  numeric,
  numeric,
  boolean
)
to anon, authenticated;

revoke all on function public.get_public_listing_filters()
from public;
grant execute on function public.get_public_listing_filters()
to anon, authenticated;
