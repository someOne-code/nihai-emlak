-- Phase 4/5: explicit admin workflow RPCs for manual cancel / reopen / confirm
-- These workflows replace direct admin UPDATE access on transactional tables.

create table if not exists public.admin_workflow_events (
  id uuid primary key default extensions.gen_random_uuid(),
  workflow_name text not null,
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  reservation_id uuid references public.reservations(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  listing_id uuid references public.listings(id) on delete set null,
  reason text,
  note text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint admin_workflow_events_workflow_name_check check (btrim(workflow_name) <> ''),
  constraint admin_workflow_events_reason_check check (
    reason is null or (btrim(reason) <> '' and char_length(reason) <= 120)
  ),
  constraint admin_workflow_events_note_check check (
    note is null or char_length(note) <= 1000
  ),
  constraint admin_workflow_events_has_target check (
    reservation_id is not null
    or order_id is not null
    or payment_id is not null
    or listing_id is not null
  )
);

create index if not exists admin_workflow_events_reservation_lookup_idx
  on public.admin_workflow_events (reservation_id, created_at desc)
  where reservation_id is not null;

create index if not exists admin_workflow_events_listing_lookup_idx
  on public.admin_workflow_events (listing_id, created_at desc)
  where listing_id is not null;

grant select on public.admin_workflow_events to authenticated;

alter table public.admin_workflow_events enable row level security;

drop policy if exists admin_workflow_events_select_admin on public.admin_workflow_events;
create policy admin_workflow_events_select_admin
on public.admin_workflow_events
for select
to authenticated
using ((select public.is_admin()));

create or replace function internal.log_admin_workflow_event(
  p_workflow_name text,
  p_admin_user_id uuid,
  p_reservation_id uuid default null,
  p_order_id uuid default null,
  p_payment_id uuid default null,
  p_listing_id uuid default null,
  p_reason text default null,
  p_note text default null,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
begin
  if p_admin_user_id is null then
    raise exception 'p_admin_user_id is required' using errcode = '22023';
  end if;

  if coalesce(length(btrim(coalesce(p_workflow_name, ''))), 0) = 0 then
    raise exception 'p_workflow_name is required' using errcode = '22023';
  end if;

  if p_payload is null then
    p_payload := '{}'::jsonb;
  end if;

  insert into public.admin_workflow_events (
    workflow_name,
    admin_user_id,
    reservation_id,
    order_id,
    payment_id,
    listing_id,
    reason,
    note,
    payload
  )
  values (
    btrim(p_workflow_name),
    p_admin_user_id,
    p_reservation_id,
    p_order_id,
    p_payment_id,
    p_listing_id,
    nullif(btrim(coalesce(p_reason, '')), ''),
    nullif(btrim(coalesce(p_note, '')), ''),
    p_payload
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

create or replace function internal.admin_cancel_reservation(
  p_reservation_id uuid,
  p_cancel_reason text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_user_id uuid;
  v_reservation public.reservations%rowtype;
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
  v_listing public.listings%rowtype;
  v_order_count integer;
  v_payment_count integer;
  v_reason text;
  v_note text;
  v_event_id uuid;
begin
  v_admin_user_id := auth.uid();

  if v_admin_user_id is null then
    raise exception 'authenticated admin is required' using errcode = '28000';
  end if;

  if not (select public.is_admin()) then
    raise exception 'admin role is required' using errcode = '42501';
  end if;

  if p_reservation_id is null then
    raise exception 'p_reservation_id is required' using errcode = '22023';
  end if;

  v_reason := nullif(btrim(coalesce(p_cancel_reason, '')), '');
  v_note := nullif(btrim(coalesce(p_note, '')), '');

  if v_reason is null then
    raise exception 'p_cancel_reason is required' using errcode = '22023';
  end if;

  if char_length(v_reason) > 120 then
    raise exception 'p_cancel_reason is too long' using errcode = '22023';
  end if;

  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'p_note is too long' using errcode = '22023';
  end if;

  select *
  into v_reservation
  from public.reservations
  where id = p_reservation_id
  for update;

  if not found then
    raise exception 'reservation not found: %', p_reservation_id using errcode = 'P0002';
  end if;

  select count(*)
  into v_order_count
  from public.orders
  where reservation_id = v_reservation.id;

  if v_order_count <> 1 then
    raise exception 'reservation order invariant violated: %', v_reservation.id using errcode = '22023';
  end if;

  select *
  into v_order
  from public.orders
  where reservation_id = v_reservation.id
  for update;

  select count(*)
  into v_payment_count
  from public.payments
  where order_id = v_order.id;

  if v_payment_count <> 1 then
    raise exception 'order payment invariant violated: %', v_order.id using errcode = '22023';
  end if;

  select *
  into v_payment
  from public.payments
  where order_id = v_order.id
  for update;

  select *
  into v_listing
  from public.listings
  where id = v_reservation.listing_id
  for update;

  if not found then
    raise exception 'listing not found for reservation: %', v_reservation.id using errcode = 'P0002';
  end if;

  if v_order.user_id <> v_reservation.user_id
     or v_payment.user_id <> v_reservation.user_id then
    raise exception 'reservation ownership invariant violated: %', v_reservation.id using errcode = '22023';
  end if;

  if v_payment.order_id <> v_order.id then
    raise exception 'payment order invariant violated: %', v_payment.id using errcode = '22023';
  end if;

  if v_listing.status not in ('active', 'passive') then
    raise exception 'listing status invariant violated: %', v_listing.id using errcode = '22023';
  end if;

  if v_reservation.status in ('cancelled', 'expired') then
    raise exception 'reservation cannot be cancelled from status: %', v_reservation.status using errcode = 'P0001';
  end if;

  if v_order.status = 'cancelled' then
    raise exception 'order cannot be cancelled from status: %', v_order.status using errcode = 'P0001';
  end if;

  if v_payment.status = 'pending' then
    update public.payments
    set
      status = 'cancelled',
      updated_at = now()
    where id = v_payment.id;
  end if;

  update public.orders
  set
    status = 'cancelled',
    updated_at = now()
  where id = v_order.id;

  update public.reservations
  set
    status = 'cancelled',
    updated_at = now()
  where id = v_reservation.id;

  v_event_id := internal.log_admin_workflow_event(
    'admin_cancel_reservation',
    v_admin_user_id,
    v_reservation.id,
    v_order.id,
    v_payment.id,
    v_listing.id,
    v_reason,
    v_note,
    jsonb_build_object(
      'before_reservation_status', v_reservation.status,
      'before_order_status', v_order.status,
      'before_payment_status', v_payment.status,
      'before_listing_status', v_listing.status
    )
  );

  return jsonb_build_object(
    'result', 'cancelled',
    'event_id', v_event_id,
    'reservation_id', v_reservation.id,
    'order_id', v_order.id,
    'payment_id', v_payment.id,
    'listing_id', v_listing.id,
    'reservation_status', 'cancelled',
    'order_status', 'cancelled',
    'payment_status', (
      select p.status::text
      from public.payments p
      where p.id = v_payment.id
    ),
    'listing_status', (
      select l.status::text
      from public.listings l
      where l.id = v_listing.id
    )
  );
end;
$$;

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

create or replace function internal.admin_confirm_reservation(
  p_reservation_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_user_id uuid;
  v_reservation public.reservations%rowtype;
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
  v_listing public.listings%rowtype;
  v_order_count integer;
  v_payment_count integer;
  v_note text;
  v_event_id uuid;
begin
  v_admin_user_id := auth.uid();

  if v_admin_user_id is null then
    raise exception 'authenticated admin is required' using errcode = '28000';
  end if;

  if not (select public.is_admin()) then
    raise exception 'admin role is required' using errcode = '42501';
  end if;

  if p_reservation_id is null then
    raise exception 'p_reservation_id is required' using errcode = '22023';
  end if;

  v_note := nullif(btrim(coalesce(p_note, '')), '');

  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'p_note is too long' using errcode = '22023';
  end if;

  select *
  into v_reservation
  from public.reservations
  where id = p_reservation_id
  for update;

  if not found then
    raise exception 'reservation not found: %', p_reservation_id using errcode = 'P0002';
  end if;

  select count(*)
  into v_order_count
  from public.orders
  where reservation_id = v_reservation.id;

  if v_order_count <> 1 then
    raise exception 'reservation order invariant violated: %', v_reservation.id using errcode = '22023';
  end if;

  select *
  into v_order
  from public.orders
  where reservation_id = v_reservation.id
  for update;

  select count(*)
  into v_payment_count
  from public.payments
  where order_id = v_order.id;

  if v_payment_count <> 1 then
    raise exception 'order payment invariant violated: %', v_order.id using errcode = '22023';
  end if;

  select *
  into v_payment
  from public.payments
  where order_id = v_order.id
  for update;

  select *
  into v_listing
  from public.listings
  where id = v_reservation.listing_id
  for update;

  if not found then
    raise exception 'listing not found for reservation: %', v_reservation.id using errcode = 'P0002';
  end if;

  if v_order.user_id <> v_reservation.user_id
     or v_payment.user_id <> v_reservation.user_id then
    raise exception 'reservation ownership invariant violated: %', v_reservation.id using errcode = '22023';
  end if;

  if v_payment.order_id <> v_order.id then
    raise exception 'payment order invariant violated: %', v_payment.id using errcode = '22023';
  end if;

  if v_payment.status <> 'succeeded' then
    raise exception 'reservation cannot be confirmed without succeeded payment: %', v_payment.status using errcode = 'P0001';
  end if;

  if v_reservation.status in ('cancelled', 'expired') then
    raise exception 'reservation cannot be confirmed from status: %', v_reservation.status using errcode = 'P0001';
  end if;

  if v_order.status in ('cancelled', 'failed', 'conflict') then
    raise exception 'order cannot be confirmed from status: %', v_order.status using errcode = 'P0001';
  end if;

  if v_reservation.status = 'confirmed'
     and v_order.status = 'completed'
     and v_listing.status = 'passive' then
    raise exception 'reservation is already confirmed: %', v_reservation.id using errcode = 'P0001';
  end if;

  if v_listing.status not in ('active', 'passive') then
    raise exception 'listing status invariant violated: %', v_listing.id using errcode = '22023';
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

  v_event_id := internal.log_admin_workflow_event(
    'admin_confirm_reservation',
    v_admin_user_id,
    v_reservation.id,
    v_order.id,
    v_payment.id,
    v_listing.id,
    null,
    v_note,
    jsonb_build_object(
      'before_reservation_status', v_reservation.status,
      'before_order_status', v_order.status,
      'before_payment_status', v_payment.status,
      'before_listing_status', v_listing.status
    )
  );

  return jsonb_build_object(
    'result', 'confirmed',
    'event_id', v_event_id,
    'reservation_id', v_reservation.id,
    'order_id', v_order.id,
    'payment_id', v_payment.id,
    'listing_id', v_listing.id,
    'reservation_status', 'confirmed',
    'order_status', 'completed',
    'payment_status', 'succeeded',
    'listing_status', 'passive'
  );
end;
$$;

create or replace function public.admin_cancel_reservation(
  p_reservation_id uuid,
  p_cancel_reason text,
  p_note text default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal.admin_cancel_reservation(
    p_reservation_id,
    p_cancel_reason,
    p_note
  );
$$;

create or replace function public.admin_reopen_listing(
  p_listing_id uuid,
  p_reason text,
  p_note text default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal.admin_reopen_listing(
    p_listing_id,
    p_reason,
    p_note
  );
$$;

create or replace function public.admin_confirm_reservation(
  p_reservation_id uuid,
  p_note text default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal.admin_confirm_reservation(
    p_reservation_id,
    p_note
  );
$$;

create or replace function public.get_admin_reservation_workflow_snapshot(
  p_reservation_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_reservation public.reservations%rowtype;
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
  v_listing public.listings%rowtype;
  v_order_count integer;
  v_payment_count integer;
  v_latest_event jsonb;
  v_can_cancel boolean := false;
  v_can_confirm boolean := false;
begin
  if auth.uid() is null then
    raise exception 'authenticated admin is required' using errcode = '28000';
  end if;

  if not (select public.is_admin()) then
    raise exception 'admin role is required' using errcode = '42501';
  end if;

  if p_reservation_id is null then
    raise exception 'p_reservation_id is required' using errcode = '22023';
  end if;

  select *
  into v_reservation
  from public.reservations
  where id = p_reservation_id;

  if not found then
    raise exception 'reservation not found: %', p_reservation_id using errcode = 'P0002';
  end if;

  select count(*)
  into v_order_count
  from public.orders
  where reservation_id = v_reservation.id;

  if v_order_count <> 1 then
    raise exception 'reservation order invariant violated: %', v_reservation.id using errcode = '22023';
  end if;

  select *
  into v_order
  from public.orders
  where reservation_id = v_reservation.id;

  select count(*)
  into v_payment_count
  from public.payments
  where order_id = v_order.id;

  if v_payment_count <> 1 then
    raise exception 'order payment invariant violated: %', v_order.id using errcode = '22023';
  end if;

  select *
  into v_payment
  from public.payments
  where order_id = v_order.id;

  select *
  into v_listing
  from public.listings
  where id = v_reservation.listing_id;

  if not found then
    raise exception 'listing not found for reservation: %', v_reservation.id using errcode = 'P0002';
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
  where e.reservation_id = v_reservation.id
  order by e.created_at desc
  limit 1;

  v_can_cancel := (
    v_reservation.status not in ('cancelled', 'expired')
    and v_order.status <> 'cancelled'
  );

  v_can_confirm := (
    v_payment.status = 'succeeded'
    and v_reservation.status not in ('cancelled', 'expired')
    and v_order.status not in ('cancelled', 'failed', 'conflict')
    and not (
      v_reservation.status = 'confirmed'
      and v_order.status = 'completed'
      and v_listing.status = 'passive'
    )
  );

  return jsonb_build_object(
    'reservation', jsonb_build_object(
      'id', v_reservation.id,
      'status', v_reservation.status,
      'move_in_date', v_reservation.move_in_date,
      'stay_months', v_reservation.stay_months
    ),
    'order', jsonb_build_object(
      'id', v_order.id,
      'status', v_order.status,
      'total_amount', v_order.total_amount,
      'currency', v_order.currency
    ),
    'payment', jsonb_build_object(
      'id', v_payment.id,
      'status', v_payment.status,
      'amount', v_payment.amount,
      'currency', v_payment.currency
    ),
    'listing', jsonb_build_object(
      'id', v_listing.id,
      'status', v_listing.status
    ),
    'latest_event', coalesce(v_latest_event, '{}'::jsonb),
    'eligibility', jsonb_build_object(
      'can_cancel', v_can_cancel,
      'can_confirm', v_can_confirm
    )
  );
end;
$$;

create or replace function public.get_admin_listing_workflow_snapshot(
  p_listing_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_listing public.listings%rowtype;
  v_latest_event jsonb;
  v_live_reservation_count integer;
  v_live_order_count integer;
  v_pending_payment_count integer;
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

  v_can_reopen := (
    v_listing.status = 'passive'
    and v_live_reservation_count = 0
    and v_live_order_count = 0
    and v_pending_payment_count = 0
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

revoke all on function internal.log_admin_workflow_event(text, uuid, uuid, uuid, uuid, uuid, text, text, jsonb)
from public;
revoke all on function internal.admin_cancel_reservation(uuid, text, text)
from public;
revoke all on function internal.admin_reopen_listing(uuid, text, text)
from public;
revoke all on function internal.admin_confirm_reservation(uuid, text)
from public;

revoke all on function public.admin_cancel_reservation(uuid, text, text)
from public;
revoke execute on function public.admin_cancel_reservation(uuid, text, text)
from anon;
grant execute on function public.admin_cancel_reservation(uuid, text, text)
to authenticated;

revoke all on function public.admin_reopen_listing(uuid, text, text)
from public;
revoke execute on function public.admin_reopen_listing(uuid, text, text)
from anon;
grant execute on function public.admin_reopen_listing(uuid, text, text)
to authenticated;

revoke all on function public.admin_confirm_reservation(uuid, text)
from public;
revoke execute on function public.admin_confirm_reservation(uuid, text)
from anon;
grant execute on function public.admin_confirm_reservation(uuid, text)
to authenticated;

revoke all on function public.get_admin_reservation_workflow_snapshot(uuid)
from public;
revoke execute on function public.get_admin_reservation_workflow_snapshot(uuid)
from anon;
grant execute on function public.get_admin_reservation_workflow_snapshot(uuid)
to authenticated;

revoke all on function public.get_admin_listing_workflow_snapshot(uuid)
from public;
revoke execute on function public.get_admin_listing_workflow_snapshot(uuid)
from anon;
grant execute on function public.get_admin_listing_workflow_snapshot(uuid)
to authenticated;
