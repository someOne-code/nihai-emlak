-- Phase 5 / Task 2: backend read model RPCs

create or replace function public.list_public_listings(
  p_type public.listing_type default null,
  p_city text default null,
  p_limit integer default 20,
  p_offset integer default 0
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
      and (p_city is null or city = p_city)
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
    'gross_area_m2', v_listing.gross_area_m2,
    'is_furnished', v_listing.is_furnished,
    'images', v_images,
    'created_at', v_listing.created_at,
    'updated_at', v_listing.updated_at
  );
end;
$$;

create or replace function public.list_public_listing_services(
  p_listing_id uuid
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
  if not exists (
    select 1
    from public.listings as l
    where l.id = p_listing_id
      and l.status = 'active'
  ) then
    raise exception 'listing not found: %', p_listing_id
      using errcode = 'P0002';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', sc.id,
        'code', sc.code,
        'name', sc.name,
        'description', sc.description,
        'price', coalesce(lso.override_price, sc.base_price),
        'currency', 'TRY'
      )
      order by sc.code
    ),
    '[]'::jsonb
  )
  into v_items
  from public.listing_service_options as lso
  join public.service_catalog as sc
    on sc.id = lso.service_id
  where lso.listing_id = p_listing_id
    and lso.is_enabled = true
    and sc.is_active = true;

  return jsonb_build_object('items', v_items);
end;
$$;

create or replace function public.list_admin_reservations(
  p_status public.reservation_status default null,
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
        'id', r.id,
        'listing_id', r.listing_id,
        'user_id', r.user_id,
        'move_in_date', r.move_in_date,
        'stay_months', r.stay_months,
        'guest_count', r.guest_count,
        'note', r.note,
        'status', r.status,
        'listing', jsonb_build_object(
          'id', l.id,
          'title', l.title,
          'status', l.status,
          'city', l.city,
          'district', l.district
        ),
        'created_at', r.created_at,
        'updated_at', r.updated_at
      )
      order by r.created_at desc, r.id
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select *
    from public.reservations
    where p_status is null or status = p_status
    order by created_at desc, id
    limit p_limit
    offset p_offset
  ) as r
  join public.listings as l on l.id = r.listing_id;

  return jsonb_build_object(
    'items', v_items,
    'limit', p_limit,
    'offset', p_offset
  );
end;
$$;

create or replace function public.list_admin_orders(
  p_status public.order_status default null,
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
        'id', o.id,
        'reservation_id', o.reservation_id,
        'user_id', o.user_id,
        'total_amount', o.total_amount,
        'currency', o.currency,
        'status', o.status,
        'reservation', jsonb_build_object(
          'id', r.id,
          'listing_id', r.listing_id,
          'status', r.status
        ),
        'created_at', o.created_at,
        'updated_at', o.updated_at
      )
      order by o.created_at desc, o.id
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select *
    from public.orders
    where p_status is null or status = p_status
    order by created_at desc, id
    limit p_limit
    offset p_offset
  ) as o
  join public.reservations as r on r.id = o.reservation_id;

  return jsonb_build_object(
    'items', v_items,
    'limit', p_limit,
    'offset', p_offset
  );
end;
$$;

create or replace function public.list_admin_payments(
  p_status public.payment_status default null,
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
        'id', p.id,
        'order_id', p.order_id,
        'user_id', p.user_id,
        'amount', p.amount,
        'currency', p.currency,
        'status', p.status,
        'provider', p.provider,
        'provider_ref', p.provider_ref,
        'order', jsonb_build_object(
          'id', o.id,
          'reservation_id', o.reservation_id,
          'status', o.status,
          'total_amount', o.total_amount,
          'currency', o.currency
        ),
        'created_at', p.created_at,
        'updated_at', p.updated_at
      )
      order by p.created_at desc, p.id
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select *
    from public.payments
    where p_status is null or status = p_status
    order by created_at desc, id
    limit p_limit
    offset p_offset
  ) as p
  join public.orders as o on o.id = p.order_id;

  return jsonb_build_object(
    'items', v_items,
    'limit', p_limit,
    'offset', p_offset
  );
end;
$$;

create or replace function public.list_admin_payment_events(
  p_payment_id uuid default null,
  p_limit integer default 20,
  p_offset integer default 0
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
        'id', e.id,
        'payment_id', e.payment_id,
        'event_type', e.event_type,
        'provider', e.provider,
        'created_at', e.created_at
      )
      order by e.created_at desc, e.id
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select *
    from public.payment_events
    where p_payment_id is null or payment_id = p_payment_id
    order by created_at desc, id
    limit p_limit
    offset p_offset
  ) as e;

  return jsonb_build_object(
    'items', v_items,
    'limit', p_limit,
    'offset', p_offset
  );
end;
$$;

revoke all on function public.list_public_listings(public.listing_type, text, integer, integer)
from public;
grant execute on function public.list_public_listings(public.listing_type, text, integer, integer)
to anon, authenticated;

revoke all on function public.get_public_listing_detail(uuid)
from public;
grant execute on function public.get_public_listing_detail(uuid)
to anon, authenticated;

revoke all on function public.list_public_listing_services(uuid)
from public;
grant execute on function public.list_public_listing_services(uuid)
to anon, authenticated;

revoke all on function public.list_admin_reservations(public.reservation_status, integer, integer)
from public;
revoke execute on function public.list_admin_reservations(public.reservation_status, integer, integer)
from anon;
grant execute on function public.list_admin_reservations(public.reservation_status, integer, integer)
to authenticated;

revoke all on function public.list_admin_orders(public.order_status, integer, integer)
from public;
revoke execute on function public.list_admin_orders(public.order_status, integer, integer)
from anon;
grant execute on function public.list_admin_orders(public.order_status, integer, integer)
to authenticated;

revoke all on function public.list_admin_payments(public.payment_status, integer, integer)
from public;
revoke execute on function public.list_admin_payments(public.payment_status, integer, integer)
from anon;
grant execute on function public.list_admin_payments(public.payment_status, integer, integer)
to authenticated;

revoke all on function public.list_admin_payment_events(uuid, integer, integer)
from public;
revoke execute on function public.list_admin_payment_events(uuid, integer, integer)
from anon;
grant execute on function public.list_admin_payment_events(uuid, integer, integer)
to authenticated;
