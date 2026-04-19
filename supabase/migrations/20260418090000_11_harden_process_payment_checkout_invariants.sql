-- Phase 1 / Task 7 hardening:
-- Enforce provider and state invariants in DB-side atomic checkout function.

create or replace function public.process_payment_checkout(
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

  -- Lock rows in deterministic order for concurrency safety.
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

  update public.payments
  set
    status = 'succeeded',
    provider_ref = coalesce(v_provider_ref, provider_ref),
    updated_at = now()
  where id = v_payment.id;

  -- Deterministic failure hook for SQL rollback tests.
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

revoke all on function public.process_payment_checkout(uuid, text, text, jsonb) from public;
grant execute on function public.process_payment_checkout(uuid, text, text, jsonb)
to service_role;
