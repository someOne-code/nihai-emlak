-- Production hardening:
-- - checkout writes flow through authenticated user-context DB/RPC
-- - a listing cannot accumulate multiple concurrent pending checkouts
-- - main item uniqueness is enforced by canonical code, not display label

do $$
begin
  if exists (
    select 1
    from public.reservations
    where status = 'pending'
    group by listing_id
    having count(*) > 1
  ) then
    raise exception 'multiple pending reservations exist for the same listing; cleanup is required before applying checkout hardening';
  end if;
end;
$$;

create unique index if not exists reservations_single_pending_per_listing_idx
  on public.reservations (listing_id)
  where status = 'pending';

do $$
begin
  if exists (
    select 1
    from public.order_items
    where item_type = 'main_item'
      and code is not null
    group by order_id, code
    having count(*) > 1
  ) then
    raise exception 'duplicate main item codes exist for the same order; cleanup is required before applying checkout hardening';
  end if;
end;
$$;

drop index if exists public.order_items_unique_main_per_order;

create unique index if not exists order_items_unique_main_code_per_order
  on public.order_items (order_id, code)
  where item_type = 'main_item'
    and code is not null;

drop function if exists public.create_checkout(uuid, uuid, date, integer, integer, text[], text[], text);
drop function if exists internal.create_checkout(uuid, uuid, date, integer, integer, text[], text[], text);
drop function if exists public.create_checkout(uuid, date, integer, integer, text[], text[], text);
drop function if exists internal.create_checkout(uuid, date, integer, integer, text[], text[], text);

create or replace function internal.create_checkout(
  p_listing_id uuid,
  p_move_in_date date,
  p_stay_months integer,
  p_guest_count integer,
  p_main_item_codes text[],
  p_service_item_codes text[] default array[]::text[],
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_listing public.listings%rowtype;
  v_note text;
  v_quote jsonb;
  v_reservation_id uuid;
  v_order_id uuid;
  v_payment_id uuid;
  v_payment_provider_ref text;
  v_total_amount numeric(12, 2);
  v_currency text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'authenticated user is required' using errcode = '28000';
  end if;

  if p_listing_id is null then
    raise exception 'p_listing_id is required' using errcode = '22023';
  end if;

  if p_move_in_date is null then
    raise exception 'p_move_in_date is required' using errcode = '22023';
  end if;

  if p_move_in_date < current_date then
    raise exception 'p_move_in_date cannot be in the past' using errcode = '22023';
  end if;

  if p_stay_months is null or p_stay_months < 1 or p_stay_months > 12 then
    raise exception 'p_stay_months must be between 1 and 12' using errcode = '22023';
  end if;

  if p_guest_count is null or p_guest_count < 1 then
    raise exception 'p_guest_count must be a positive integer' using errcode = '22023';
  end if;

  select *
  into v_listing
  from public.listings
  where id = p_listing_id
  for update;

  if not found then
    raise exception 'listing is not available for checkout: %', p_listing_id using errcode = 'P0002';
  end if;

  if v_listing.status <> 'active' or v_listing.type <> 'rent' then
    raise exception 'listing is not available for checkout: %', p_listing_id using errcode = 'P0002';
  end if;

  perform 1
  from public.reservations
  where listing_id = p_listing_id
    and status = 'pending';

  if found then
    raise exception 'listing is not available for checkout: %', p_listing_id using errcode = 'P0002';
  end if;

  v_note := nullif(btrim(coalesce(p_note, '')), '');

  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'p_note is too long' using errcode = '22023';
  end if;

  perform 1
  from public.listing_main_item_options lmo
  join public.main_item_catalog mic
    on mic.id = lmo.main_item_id
  join unnest(coalesce(p_main_item_codes, array[]::text[])) as requested(code)
    on lower(btrim(mic.code)) = lower(btrim(requested.code))
  where lmo.listing_id = p_listing_id
  for share of lmo, mic;

  perform 1
  from public.listing_service_options lso
  join public.service_catalog sc
    on sc.id = lso.service_id
  join unnest(coalesce(p_service_item_codes, array[]::text[])) as requested(code)
    on lower(btrim(sc.code)) = lower(btrim(requested.code))
  where lso.listing_id = p_listing_id
  for share of lso, sc;

  v_quote := public.calculate_checkout_quote(
    p_listing_id,
    p_main_item_codes,
    coalesce(p_service_item_codes, array[]::text[]),
    p_stay_months
  );

  v_total_amount := (v_quote->>'total_amount')::numeric(12, 2);
  v_currency := upper(coalesce(nullif(v_quote->>'currency', ''), 'TRY'));

  if v_total_amount is null or v_total_amount < 0 then
    raise exception 'invalid checkout quote total' using errcode = '22023';
  end if;

  begin
    insert into public.reservations (
      listing_id,
      user_id,
      move_in_date,
      stay_months,
      guest_count,
      note,
      status
    )
    values (
      p_listing_id,
      v_user_id,
      p_move_in_date,
      p_stay_months,
      p_guest_count,
      v_note,
      'pending'
    )
    returning id into v_reservation_id;
  exception
    when unique_violation then
      if position('reservations_single_pending_per_listing_idx' in sqlerrm) > 0 then
        raise exception 'listing is not available for checkout: %', p_listing_id using errcode = 'P0002';
      end if;
      raise;
  end;

  insert into public.orders (
    reservation_id,
    user_id,
    total_amount,
    currency,
    status
  )
  values (
    v_reservation_id,
    v_user_id,
    v_total_amount,
    v_currency,
    'pending'
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id,
    item_type,
    code,
    label,
    amount,
    service_catalog_id,
    listing_id
  )
  select
    v_order_id,
    (item.value->>'item_type')::public.order_item_type,
    item.value->>'code',
    item.value->>'label',
    (item.value->>'amount')::numeric(12, 2),
    nullif(item.value->>'service_catalog_id', '')::uuid,
    p_listing_id
  from jsonb_array_elements(v_quote->'items') with ordinality as item(value, ordinality)
  order by item.ordinality;

  insert into public.payments (
    order_id,
    user_id,
    amount,
    currency,
    status,
    provider
  )
  values (
    v_order_id,
    v_user_id,
    v_total_amount,
    v_currency,
    'pending',
    'isbank'
  )
  returning id, provider_ref into v_payment_id, v_payment_provider_ref;

  if v_payment_provider_ref <> v_payment_id::text then
    raise exception 'isbank provider_ref invariant violated for payment: %', v_payment_id
      using errcode = '22023';
  end if;

  return jsonb_build_object(
    'result', 'created',
    'reservation_id', v_reservation_id,
    'order_id', v_order_id,
    'payment_id', v_payment_id,
    'listing_id', p_listing_id,
    'total_amount', v_total_amount,
    'currency', v_currency,
    'payment_status', 'pending'
  );
end;
$$;

create or replace function public.create_checkout(
  p_listing_id uuid,
  p_move_in_date date,
  p_stay_months integer,
  p_guest_count integer,
  p_main_item_codes text[],
  p_service_item_codes text[] default array[]::text[],
  p_note text default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal.create_checkout(
    p_listing_id,
    p_move_in_date,
    p_stay_months,
    p_guest_count,
    p_main_item_codes,
    p_service_item_codes,
    p_note
  );
$$;

revoke all on function internal.create_checkout(uuid, date, integer, integer, text[], text[], text)
from public;
grant execute on function internal.create_checkout(uuid, date, integer, integer, text[], text[], text)
to service_role;

revoke all on function public.create_checkout(uuid, date, integer, integer, text[], text[], text)
from public;
revoke execute on function public.create_checkout(uuid, date, integer, integer, text[], text[], text)
from anon;
grant execute on function public.create_checkout(uuid, date, integer, integer, text[], text[], text)
to authenticated;
