drop function if exists public.list_public_listings(public.listing_type, text, integer, integer);

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
    select li.image_url
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
