-- Phase 3 / Task 4: atomically create checkout reservation/order/items/payment.

alter table public.order_items
  add column if not exists code text;

alter table public.order_items
  add constraint order_items_code_normalized check (
    code is null
    or (
      code = lower(btrim(code))
      and code <> ''
      and char_length(code) <= 64
      and code ~ '^[a-z0-9][a-z0-9_-]*$'
    )
  );

create index if not exists order_items_code_lookup_idx
  on public.order_items (order_id, item_type, code);

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
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
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

  if p_stay_months is null or p_stay_months < 1 or p_stay_months > 12 then
    raise exception 'p_stay_months must be between 1 and 12' using errcode = '22023';
  end if;

  if p_guest_count is null or p_guest_count < 1 then
    raise exception 'p_guest_count must be a positive integer' using errcode = '22023';
  end if;

  v_note := nullif(btrim(coalesce(p_note, '')), '');

  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'p_note is too long' using errcode = '22023';
  end if;

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

revoke all on function public.create_checkout(uuid, date, integer, integer, text[], text[], text)
from public;

revoke execute on function public.create_checkout(uuid, date, integer, integer, text[], text[], text)
from anon;

grant execute on function public.create_checkout(uuid, date, integer, integer, text[], text[], text)
to authenticated;
