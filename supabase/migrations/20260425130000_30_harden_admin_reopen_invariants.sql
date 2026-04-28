-- Phase 5.5 hotfix: admin reopen must fail closed on terminal-state drift
-- and listing snapshot eligibility must mirror the write-path guard.

create or replace function internal.admin_reopen_listing(
  p_listing_id uuid,
  p_reason text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_user_id uuid;
  v_listing public.listings%rowtype;
  v_reason text;
  v_note text;
  v_live_reservation_count integer;
  v_live_order_count integer;
  v_pending_payment_count integer;
  v_succeeded_payment_drift_count integer;
  v_event_id uuid;
begin
  v_admin_user_id := auth.uid();

  if v_admin_user_id is null then
    raise exception 'authenticated admin is required' using errcode = '28000';
  end if;

  if not (select public.is_admin()) then
    raise exception 'admin role is required' using errcode = '42501';
  end if;

  if p_listing_id is null then
    raise exception 'p_listing_id is required' using errcode = '22023';
  end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  v_note := nullif(btrim(coalesce(p_note, '')), '');

  if v_reason is null then
    raise exception 'p_reason is required' using errcode = '22023';
  end if;

  if char_length(v_reason) > 120 then
    raise exception 'p_reason is too long' using errcode = '22023';
  end if;

  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'p_note is too long' using errcode = '22023';
  end if;

  -- Listing row is the serialization boundary for reopen versus checkout create.
  -- Keep this as the only row lock here: payment callback already locks
  -- payment -> order -> reservation before listing, so reversing that order
  -- inside reopen would create a deadlock-prone lock cycle.
  select *
  into v_listing
  from public.listings
  where id = p_listing_id
  for update;

  if not found then
    raise exception 'listing not found: %', p_listing_id using errcode = 'P0002';
  end if;

  if v_listing.status <> 'passive' then
    raise exception 'listing cannot be reopened from status: %', v_listing.status using errcode = 'P0001';
  end if;

  select count(*)
  into v_live_reservation_count
  from public.reservations r
  where r.listing_id = v_listing.id
    and r.status in ('pending', 'confirmed');

  if v_live_reservation_count > 0 then
    raise exception 'listing cannot be reopened while live reservations exist: %', v_listing.id using errcode = 'P0001';
  end if;

  select count(*)
  into v_live_order_count
  from public.orders o
  join public.reservations r
    on r.id = o.reservation_id
  where r.listing_id = v_listing.id
    and o.status in ('pending', 'completed');

  if v_live_order_count > 0 then
    raise exception 'listing cannot be reopened while live orders exist: %', v_listing.id using errcode = 'P0001';
  end if;

  select count(*)
  into v_pending_payment_count
  from public.payments p
  join public.orders o
    on o.id = p.order_id
  join public.reservations r
    on r.id = o.reservation_id
  where r.listing_id = v_listing.id
    and p.status = 'pending';

  if v_pending_payment_count > 0 then
    raise exception 'listing cannot be reopened while pending payments exist: %', v_listing.id using errcode = 'P0001';
  end if;

  select count(*)
  into v_succeeded_payment_drift_count
  from public.payments p
  join public.orders o
    on o.id = p.order_id
  join public.reservations r
    on r.id = o.reservation_id
  where r.listing_id = v_listing.id
    and p.status = 'succeeded'
    and (
      o.status is distinct from 'cancelled'
      or r.status is distinct from 'cancelled'
    );

  if v_succeeded_payment_drift_count > 0 then
    raise exception 'listing reopen invariant drift: %', v_listing.id using errcode = 'P0004';
  end if;

  update public.listings
  set
    status = 'active',
    updated_at = now()
  where id = v_listing.id;

  v_event_id := internal.log_admin_workflow_event(
    'admin_reopen_listing',
    v_admin_user_id,
    null,
    null,
    null,
    v_listing.id,
    v_reason,
    v_note,
    jsonb_build_object(
      'before_listing_status', v_listing.status
    )
  );

  return jsonb_build_object(
    'result', 'reopened',
    'event_id', v_event_id,
    'listing_id', v_listing.id,
    'listing_status', 'active'
  );
end;
$$;

create or replace function public.get_admin_listing_workflow_snapshot(
  p_listing_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing public.listings%rowtype;
  v_latest_event jsonb;
  v_live_reservation_count integer;
  v_live_order_count integer;
  v_pending_payment_count integer;
  v_succeeded_payment_drift_count integer;
  v_can_reopen boolean := false;
begin
  if auth.uid() is null then
    raise exception 'authenticated admin is required' using errcode = '28000';
  end if;

  if not (select public.is_admin()) then
    raise exception 'admin role is required' using errcode = '42501';
  end if;

  if p_listing_id is null then
    raise exception 'p_listing_id is required' using errcode = '22023';
  end if;

  select *
  into v_listing
  from public.listings
  where id = p_listing_id;

  if not found then
    raise exception 'listing not found: %', p_listing_id using errcode = 'P0002';
  end if;

  select jsonb_build_object(
    'id', e.id,
    'workflow_name', e.workflow_name,
    'reason', e.reason,
    'note', e.note,
    'created_at', e.created_at
  )
  into v_latest_event
  from public.admin_workflow_events e
  where e.listing_id = v_listing.id
  order by e.created_at desc
  limit 1;

  select count(*)
  into v_live_reservation_count
  from public.reservations r
  where r.listing_id = v_listing.id
    and r.status in ('pending', 'confirmed');

  select count(*)
  into v_live_order_count
  from public.orders o
  join public.reservations r
    on r.id = o.reservation_id
  where r.listing_id = v_listing.id
    and o.status in ('pending', 'completed');

  select count(*)
  into v_pending_payment_count
  from public.payments p
  join public.orders o
    on o.id = p.order_id
  join public.reservations r
    on r.id = o.reservation_id
  where r.listing_id = v_listing.id
    and p.status = 'pending';

  select count(*)
  into v_succeeded_payment_drift_count
  from public.payments p
  join public.orders o
    on o.id = p.order_id
  join public.reservations r
    on r.id = o.reservation_id
  where r.listing_id = v_listing.id
    and p.status = 'succeeded'
    and (
      o.status is distinct from 'cancelled'
      or r.status is distinct from 'cancelled'
    );

  v_can_reopen := (
    v_listing.status = 'passive'
    and v_live_reservation_count = 0
    and v_live_order_count = 0
    and v_pending_payment_count = 0
    and v_succeeded_payment_drift_count = 0
  );

  return jsonb_build_object(
    'listing', jsonb_build_object(
      'id', v_listing.id,
      'status', v_listing.status
    ),
    'latest_event', coalesce(v_latest_event, '{}'::jsonb),
    'eligibility', jsonb_build_object(
      'can_reopen', v_can_reopen
    )
  );
end;
$$;
