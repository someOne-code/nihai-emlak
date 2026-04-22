-- Phase 3 / P1 hardening:
-- - transactional checkout rows are created only through create_checkout
-- - payment completion re-validates ownership and amount invariants in DB

create schema if not exists internal;

revoke all on schema internal from public;
revoke usage on schema internal from anon, authenticated;
grant usage on schema internal to service_role;

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

revoke insert on public.reservations from authenticated;
revoke insert on public.orders from authenticated;
revoke insert on public.order_items from authenticated;
revoke insert on public.payments from authenticated;

drop policy if exists reservations_insert_own on public.reservations;
drop policy if exists orders_insert_own on public.orders;
drop policy if exists order_items_insert_own on public.order_items;
drop policy if exists payments_insert_own on public.payments;

create or replace function internal.process_payment_checkout(
  p_payment_id uuid,
  p_event_type text default 'payment_callback',
  p_provider_ref text default null,
  p_event_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
  v_reservation public.reservations%rowtype;
  v_listing public.listings%rowtype;
  v_provider_ref text;
  v_normalized_event_type text;
  v_is_failed_callback boolean;
begin
  if p_payment_id is null then
    raise exception 'p_payment_id is required' using errcode = '22023';
  end if;

  if coalesce(length(trim(p_event_type)), 0) = 0 then
    raise exception 'p_event_type is required' using errcode = '22023';
  end if;

  if p_event_payload is null then
    p_event_payload := '{}'::jsonb;
  end if;

  v_provider_ref := nullif(trim(coalesce(p_provider_ref, '')), '');
  v_normalized_event_type := lower(trim(p_event_type));
  v_is_failed_callback :=
    v_normalized_event_type like 'isbank_callback_%'
    and v_normalized_event_type <> 'isbank_callback_approved';

  select *
  into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'payment not found: %', p_payment_id using errcode = 'P0002';
  end if;

  select *
  into v_order
  from public.orders
  where id = v_payment.order_id
  for update;

  if not found then
    raise exception 'order not found for payment: %', p_payment_id using errcode = 'P0002';
  end if;

  select *
  into v_reservation
  from public.reservations
  where id = v_order.reservation_id
  for update;

  if not found then
    raise exception 'reservation not found for order: %', v_order.id using errcode = 'P0002';
  end if;

  select *
  into v_listing
  from public.listings
  where id = v_reservation.listing_id
  for update;

  if not found then
    raise exception 'listing not found for reservation: %', v_reservation.id using errcode = 'P0002';
  end if;

  if v_payment.user_id <> v_order.user_id
     or v_order.user_id <> v_reservation.user_id then
    raise exception 'payment ownership invariant violated for payment: %', v_payment.id
      using errcode = '22023';
  end if;

  if v_payment.amount <> v_order.total_amount
     or upper(v_payment.currency) <> upper(v_order.currency) then
    raise exception 'payment amount invariant violated for payment: %', v_payment.id
      using errcode = '22023';
  end if;

  if v_payment.provider <> 'isbank' then
    raise exception 'unsupported payment provider: %', v_payment.provider using errcode = '22023';
  end if;

  if v_payment.provider_ref is null
     or length(trim(v_payment.provider_ref)) = 0
     or trim(v_payment.provider_ref) <> v_payment.id::text then
    raise exception 'isbank provider_ref invariant violated for payment: %', v_payment.id using errcode = '22023';
  end if;

  if v_provider_ref is not null and v_provider_ref <> v_payment.provider_ref then
    raise exception 'provider_ref mismatch for payment: %', v_payment.id using errcode = '22023';
  end if;

  if v_order.status = 'completed'
     or v_payment.status = 'succeeded'
     or v_reservation.status = 'confirmed' then
    insert into public.payment_events (payment_id, event_type, provider, payload)
    values (
      v_payment.id,
      'payment_checkout_idempotent',
      v_payment.provider,
      jsonb_build_object(
        'source_event_type', p_event_type,
        'order_status', v_order.status,
        'payment_status', v_payment.status,
        'reservation_status', v_reservation.status,
        'listing_status', v_listing.status,
        'provider_ref', v_provider_ref
      ) || p_event_payload
    );

    return jsonb_build_object(
      'result', 'idempotent',
      'payment_id', v_payment.id,
      'order_id', v_order.id,
      'reservation_id', v_reservation.id,
      'listing_id', v_listing.id
    );
  end if;

  if v_payment.status in ('failed', 'cancelled', 'refunded', 'conflict')
     or v_order.status in ('failed', 'cancelled', 'conflict')
     or v_reservation.status in ('cancelled', 'expired') then
    insert into public.payment_events (payment_id, event_type, provider, payload)
    values (
      v_payment.id,
      'payment_checkout_conflict',
      v_payment.provider,
      jsonb_build_object(
        'source_event_type', p_event_type,
        'reason', 'terminal_state',
        'order_status', v_order.status,
        'payment_status', v_payment.status,
        'reservation_status', v_reservation.status,
        'listing_status', v_listing.status,
        'provider_ref', v_provider_ref
      ) || p_event_payload
    );

    return jsonb_build_object(
      'result', 'conflict',
      'payment_id', v_payment.id,
      'order_id', v_order.id,
      'reservation_id', v_reservation.id,
      'listing_id', v_listing.id
    );
  end if;

  if v_order.status <> 'pending' or v_reservation.status <> 'pending' then
    insert into public.payment_events (payment_id, event_type, provider, payload)
    values (
      v_payment.id,
      'payment_checkout_conflict',
      v_payment.provider,
      jsonb_build_object(
        'source_event_type', p_event_type,
        'reason', 'non_pending_state',
        'order_status', v_order.status,
        'reservation_status', v_reservation.status,
        'provider_ref', v_provider_ref
      ) || p_event_payload
    );

    return jsonb_build_object(
      'result', 'conflict',
      'payment_id', v_payment.id,
      'order_id', v_order.id,
      'reservation_id', v_reservation.id,
      'listing_id', v_listing.id
    );
  end if;

  if v_listing.status = 'passive' then
    update public.payments
    set
      status = 'conflict',
      provider_ref = coalesce(v_provider_ref, provider_ref),
      updated_at = now()
    where id = v_payment.id;

    update public.orders
    set
      status = 'conflict',
      updated_at = now()
    where id = v_order.id;

    update public.reservations
    set
      status = 'expired',
      updated_at = now()
    where id = v_reservation.id;

    insert into public.payment_events (payment_id, event_type, provider, payload)
    values (
      v_payment.id,
      'payment_checkout_conflict',
      v_payment.provider,
      jsonb_build_object(
        'source_event_type', p_event_type,
        'reason', 'listing_already_passive',
        'provider_ref', v_provider_ref
      ) || p_event_payload
    );

    return jsonb_build_object(
      'result', 'conflict',
      'payment_id', v_payment.id,
      'order_id', v_order.id,
      'reservation_id', v_reservation.id,
      'listing_id', v_listing.id
    );
  end if;

  if v_listing.status <> 'active' then
    insert into public.payment_events (payment_id, event_type, provider, payload)
    values (
      v_payment.id,
      'payment_checkout_conflict',
      v_payment.provider,
      jsonb_build_object(
        'source_event_type', p_event_type,
        'reason', 'listing_not_active',
        'listing_status', v_listing.status,
        'provider_ref', v_provider_ref
      ) || p_event_payload
    );

    return jsonb_build_object(
      'result', 'conflict',
      'payment_id', v_payment.id,
      'order_id', v_order.id,
      'reservation_id', v_reservation.id,
      'listing_id', v_listing.id
    );
  end if;

  if v_is_failed_callback then
    update public.payments
    set
      status = 'failed',
      provider_ref = coalesce(v_provider_ref, provider_ref),
      updated_at = now()
    where id = v_payment.id;

    update public.orders
    set
      status = 'failed',
      updated_at = now()
    where id = v_order.id;

    update public.reservations
    set
      status = 'expired',
      updated_at = now()
    where id = v_reservation.id;

    insert into public.payment_events (payment_id, event_type, provider, payload)
    values (
      v_payment.id,
      'payment_checkout_failed',
      v_payment.provider,
      jsonb_build_object(
        'source_event_type', p_event_type,
        'provider_ref', v_provider_ref
      ) || p_event_payload
    );

    return jsonb_build_object(
      'result', 'failed',
      'payment_id', v_payment.id,
      'order_id', v_order.id,
      'reservation_id', v_reservation.id,
      'listing_id', v_listing.id
    );
  end if;

  update public.payments
  set
    status = 'succeeded',
    provider_ref = coalesce(v_provider_ref, provider_ref),
    updated_at = now()
  where id = v_payment.id;

  if p_event_type = '__force_error_after_payment_update__' then
    raise exception 'Forced process_payment_checkout failure after payment update';
  end if;

  update public.orders
  set
    status = 'completed',
    updated_at = now()
  where id = v_order.id;

  update public.reservations
  set
    status = 'confirmed',
    updated_at = now()
  where id = v_reservation.id;

  update public.listings
  set
    status = 'passive',
    updated_at = now()
  where id = v_listing.id;

  insert into public.payment_events (payment_id, event_type, provider, payload)
  values (
    v_payment.id,
    'payment_checkout_succeeded',
    v_payment.provider,
    jsonb_build_object(
      'source_event_type', p_event_type,
      'provider_ref', v_provider_ref
    ) || p_event_payload
  );

  return jsonb_build_object(
    'result', 'succeeded',
    'payment_id', v_payment.id,
    'order_id', v_order.id,
    'reservation_id', v_reservation.id,
    'listing_id', v_listing.id
  );
end;
$$;

revoke all on function internal.process_payment_checkout(uuid, text, text, jsonb)
from public;
grant execute on function internal.process_payment_checkout(uuid, text, text, jsonb)
to service_role;
