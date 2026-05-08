-- Phase 5.6: checkout intake / pre-payment contact information.

create table if not exists public.reservation_intake (
  reservation_id uuid primary key references public.reservations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  contact_full_name text not null,
  contact_phone text not null,
  contact_email text,
  preferred_contact_method text not null,
  preferred_contact_time text,
  occupant_full_name text,
  document_readiness text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservation_intake_full_name_length check (
    char_length(btrim(contact_full_name)) between 2 and 120
  ),
  constraint reservation_intake_phone_length check (
    char_length(btrim(contact_phone)) between 7 and 32
  ),
  constraint reservation_intake_email_length check (
    contact_email is null or char_length(btrim(contact_email)) <= 254
  ),
  constraint reservation_intake_email_shape check (
    contact_email is null or btrim(contact_email) ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  constraint reservation_intake_preferred_method_check check (
    preferred_contact_method in ('phone', 'whatsapp', 'email')
  ),
  constraint reservation_intake_preferred_time_length check (
    preferred_contact_time is null or char_length(btrim(preferred_contact_time)) <= 120
  ),
  constraint reservation_intake_occupant_name_length check (
    occupant_full_name is null or char_length(btrim(occupant_full_name)) <= 120
  ),
  constraint reservation_intake_document_readiness_check check (
    document_readiness in ('ready', 'needs_help', 'later')
  ),
  constraint reservation_intake_note_length check (
    note is null or char_length(btrim(note)) <= 1000
  )
);

create index if not exists reservation_intake_user_lookup_idx
  on public.reservation_intake (user_id, created_at desc);

alter table public.reservation_intake enable row level security;

drop policy if exists reservation_intake_select_own_or_admin on public.reservation_intake;
create policy reservation_intake_select_own_or_admin
on public.reservation_intake
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

grant select on public.reservation_intake to authenticated;
revoke insert, update, delete on public.reservation_intake from authenticated;

drop function if exists public.create_checkout(uuid, date, integer, integer, text[], text[], text);
drop function if exists internal.create_checkout(uuid, date, integer, integer, text[], text[], text);
drop function if exists public.create_checkout(uuid, date, integer, integer, text[], text[], text, text, text, text, text, text, text, text, text);
drop function if exists internal.create_checkout(uuid, date, integer, integer, text[], text[], text, text, text, text, text, text, text, text, text);

create or replace function internal.create_checkout(
  p_listing_id uuid,
  p_move_in_date date,
  p_stay_months integer,
  p_guest_count integer,
  p_main_item_codes text[],
  p_service_item_codes text[] default array[]::text[],
  p_note text default null,
  p_contact_full_name text default null,
  p_contact_phone text default null,
  p_contact_email text default null,
  p_contact_preferred_method text default null,
  p_contact_preferred_time text default null,
  p_contact_occupant_full_name text default null,
  p_contact_document_readiness text default null,
  p_contact_note text default null
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
  v_constraint_name text;
  v_contact_full_name text;
  v_contact_phone text;
  v_contact_email text;
  v_contact_preferred_method text;
  v_contact_preferred_time text;
  v_contact_occupant_full_name text;
  v_contact_document_readiness text;
  v_contact_note text;
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

  v_contact_full_name := nullif(btrim(coalesce(p_contact_full_name, '')), '');
  if v_contact_full_name is null then
    raise exception 'p_contact_full_name is required' using errcode = '22023';
  end if;
  if char_length(v_contact_full_name) < 2 or char_length(v_contact_full_name) > 120 then
    raise exception 'p_contact_full_name must be between 2 and 120 characters' using errcode = '22023';
  end if;

  v_contact_phone := nullif(btrim(coalesce(p_contact_phone, '')), '');
  if v_contact_phone is null then
    raise exception 'p_contact_phone is required' using errcode = '22023';
  end if;
  if char_length(v_contact_phone) < 7 or char_length(v_contact_phone) > 32 then
    raise exception 'p_contact_phone must be between 7 and 32 characters' using errcode = '22023';
  end if;

  v_contact_email := nullif(lower(btrim(coalesce(p_contact_email, ''))), '');
  if v_contact_email is not null and (
    char_length(v_contact_email) > 254
    or v_contact_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ) then
    raise exception 'p_contact_email must be a valid email address' using errcode = '22023';
  end if;

  v_contact_preferred_method := lower(nullif(btrim(coalesce(p_contact_preferred_method, '')), ''));
  if v_contact_preferred_method is null
     or v_contact_preferred_method not in ('phone', 'whatsapp', 'email') then
    raise exception 'p_contact_preferred_method must be one of phone, whatsapp, email' using errcode = '22023';
  end if;

  v_contact_preferred_time := nullif(btrim(coalesce(p_contact_preferred_time, '')), '');
  if v_contact_preferred_time is not null and char_length(v_contact_preferred_time) > 120 then
    raise exception 'p_contact_preferred_time is too long' using errcode = '22023';
  end if;

  v_contact_occupant_full_name := nullif(btrim(coalesce(p_contact_occupant_full_name, '')), '');
  if v_contact_occupant_full_name is not null and char_length(v_contact_occupant_full_name) > 120 then
    raise exception 'p_contact_occupant_full_name is too long' using errcode = '22023';
  end if;

  v_contact_document_readiness := lower(nullif(btrim(coalesce(p_contact_document_readiness, '')), ''));
  if v_contact_document_readiness is null
     or v_contact_document_readiness not in ('ready', 'needs_help', 'later') then
    raise exception 'p_contact_document_readiness must be one of ready, needs_help, later' using errcode = '22023';
  end if;

  v_contact_note := nullif(btrim(coalesce(p_contact_note, '')), '');
  if v_contact_note is not null and char_length(v_contact_note) > 1000 then
    raise exception 'p_contact_note is too long' using errcode = '22023';
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

  if v_note is null then
    raise exception 'p_note is required' using errcode = '22023';
  end if;

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
      get stacked diagnostics v_constraint_name = CONSTRAINT_NAME;

      if v_constraint_name = 'reservations_single_pending_per_listing_idx' then
        raise exception 'listing is not available for checkout: %', p_listing_id
          using
            errcode = 'P0002',
            detail = format(
              'reservation insert conflicted on constraint %s',
              v_constraint_name
            );
      end if;

      raise;
  end;

  insert into public.reservation_intake (
    reservation_id,
    user_id,
    contact_full_name,
    contact_phone,
    contact_email,
    preferred_contact_method,
    preferred_contact_time,
    occupant_full_name,
    document_readiness,
    note
  )
  values (
    v_reservation_id,
    v_user_id,
    v_contact_full_name,
    v_contact_phone,
    v_contact_email,
    v_contact_preferred_method,
    v_contact_preferred_time,
    v_contact_occupant_full_name,
    v_contact_document_readiness,
    v_contact_note
  );

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
  p_note text default null,
  p_contact_full_name text default null,
  p_contact_phone text default null,
  p_contact_email text default null,
  p_contact_preferred_method text default null,
  p_contact_preferred_time text default null,
  p_contact_occupant_full_name text default null,
  p_contact_document_readiness text default null,
  p_contact_note text default null
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
    p_note,
    p_contact_full_name,
    p_contact_phone,
    p_contact_email,
    p_contact_preferred_method,
    p_contact_preferred_time,
    p_contact_occupant_full_name,
    p_contact_document_readiness,
    p_contact_note
  );
$$;

revoke all on function internal.create_checkout(uuid, date, integer, integer, text[], text[], text, text, text, text, text, text, text, text, text)
from public;
grant execute on function internal.create_checkout(uuid, date, integer, integer, text[], text[], text, text, text, text, text, text, text, text, text)
to service_role;

revoke all on function public.create_checkout(uuid, date, integer, integer, text[], text[], text, text, text, text, text, text, text, text, text)
from public;
revoke execute on function public.create_checkout(uuid, date, integer, integer, text[], text[], text, text, text, text, text, text, text, text, text)
from anon;
grant execute on function public.create_checkout(uuid, date, integer, integer, text[], text[], text, text, text, text, text, text, text, text, text)
to authenticated;

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
begin
  return public.list_admin_reservations(p_status, 'all'::text, p_limit, p_offset);
end;
$$;

create or replace function public.list_admin_reservations(
  p_status public.reservation_status,
  p_queue text,
  p_limit integer,
  p_offset integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
stable
as $$
declare
  v_items jsonb;
  v_queue text;
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

  v_queue := coalesce(nullif(btrim(p_queue), ''), 'all');
  if v_queue not in ('all', 'document_waiting', 'refund_requests', 'manual_refunds', 'payment_issues', 'completed') then
    raise exception 'invalid reservation queue'
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
        'contact', jsonb_build_object(
          'fullName', i.contact_full_name,
          'phone', i.contact_phone,
          'email', i.contact_email,
          'preferredContactMethod', i.preferred_contact_method,
          'preferredContactTime', i.preferred_contact_time,
          'occupantFullName', i.occupant_full_name,
          'documentReadiness', i.document_readiness,
          'note', i.note
        ),
        'document_tracking', case
          when dt.reservation_id is null then null
          else jsonb_build_object(
            'status', dt.status,
            'updated_at', dt.updated_at
          )
        end,
        'finance_ops', case
          when fo.id is null then null
          else jsonb_build_object(
            'status', fo.status,
            'updated_at', fo.updated_at
          )
        end,
        'created_at', r.created_at,
        'updated_at', r.updated_at
      )
      order by r.created_at desc, r.id
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select r.*, dt.status as document_status, fo.status as finance_status
    from public.reservations as r
    left join public.reservation_document_tracking as dt on dt.reservation_id = r.id
    left join lateral (
      select *
      from public.payment_finance_ops candidate
      where candidate.reservation_id = r.id
      order by candidate.updated_at desc, candidate.created_at desc
      limit 1
    ) as fo on true
    where (p_status is null or r.status = p_status)
      and (
        v_queue = 'all'
        or (v_queue = 'document_waiting' and dt.status in ('requested'::public.document_tracking_status, 'waiting'::public.document_tracking_status))
        or (v_queue = 'refund_requests' and fo.status = 'refund_required'::public.finance_ops_status)
        or (v_queue = 'manual_refunds' and fo.status = 'refund_requested'::public.finance_ops_status)
        or (v_queue = 'payment_issues' and fo.status in ('manual_resolution_required'::public.finance_ops_status, 'conflict_payment'::public.finance_ops_status))
        or (v_queue = 'completed' and (dt.status = 'completed'::public.document_tracking_status or r.status = 'confirmed'::public.reservation_status))
      )
    order by r.created_at desc, r.id
    limit p_limit
    offset p_offset
  ) as r
  join public.listings as l on l.id = r.listing_id
  left join public.reservation_intake as i on i.reservation_id = r.id
  left join public.reservation_document_tracking as dt on dt.reservation_id = r.id
  left join lateral (
    select *
    from public.payment_finance_ops candidate
    where candidate.reservation_id = r.id
    order by candidate.updated_at desc, candidate.created_at desc
    limit 1
  ) as fo on true;

  return jsonb_build_object(
    'items', v_items,
    'limit', p_limit,
    'offset', p_offset
  );
end;
$$;

revoke all on function public.list_admin_reservations(public.reservation_status, text, integer, integer)
from public;
revoke execute on function public.list_admin_reservations(public.reservation_status, text, integer, integer)
from anon;
grant execute on function public.list_admin_reservations(public.reservation_status, text, integer, integer)
to authenticated;

create or replace function public.get_admin_reservation_workflow_snapshot(
  p_reservation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation public.reservations%rowtype;
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
  v_listing public.listings%rowtype;
  v_intake public.reservation_intake%rowtype;
  v_order_count integer;
  v_payment_count integer;
  v_other_occupant_count integer;
  v_latest_event jsonb;
  v_can_cancel boolean := false;
  v_can_confirm boolean := false;
  v_has_consistent_ownership boolean := false;
  v_has_consistent_payment_order_link boolean := false;
  v_has_valid_listing_status boolean := false;
  v_has_matching_payment_amount boolean := false;
  v_has_matching_payment_currency boolean := false;
  v_has_success_terminal_tuple boolean := false;
  v_has_terminal_signal boolean := false;
  v_has_confirm_terminal_signal boolean := false;
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

  select *
  into v_intake
  from public.reservation_intake
  where reservation_id = v_reservation.id;

  select count(*)
  into v_order_count
  from public.orders
  where reservation_id = v_reservation.id;

  if v_order_count <> 1 then
    raise exception 'reservation order invariant violated: %', v_reservation.id using errcode = 'P0004';
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
    raise exception 'order payment invariant violated: %', v_order.id using errcode = 'P0004';
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

  v_has_consistent_ownership := (
    v_order.user_id = v_reservation.user_id
    and v_payment.user_id = v_reservation.user_id
  );
  v_has_consistent_payment_order_link := v_payment.order_id = v_order.id;
  v_has_valid_listing_status := v_listing.status in ('active', 'passive');
  v_has_matching_payment_amount := v_payment.amount = v_order.total_amount;
  v_has_matching_payment_currency := v_payment.currency = v_order.currency;
  v_has_success_terminal_tuple := (
    v_payment.status = 'succeeded'
    and v_reservation.status = 'confirmed'
    and v_order.status = 'completed'
    and v_listing.status = 'passive'
  );
  v_has_terminal_signal := (
    v_payment.status = 'succeeded'
    or v_reservation.status = 'confirmed'
    or v_order.status = 'completed'
    or v_listing.status = 'passive'
  );
  v_has_confirm_terminal_signal := (
    v_reservation.status = 'confirmed'
    or v_order.status = 'completed'
    or v_listing.status = 'passive'
  );

  v_can_cancel := (
    v_has_consistent_ownership
    and v_has_consistent_payment_order_link
    and v_has_valid_listing_status
    and v_has_matching_payment_amount
    and v_has_matching_payment_currency
    and v_reservation.status not in ('cancelled', 'expired')
    and v_order.status <> 'cancelled'
    and (not v_has_terminal_signal or v_has_success_terminal_tuple)
  );

  select count(*)
  into v_other_occupant_count
  from public.reservations as r
  join public.orders as o
    on o.reservation_id = r.id
  join public.payments as p
    on p.order_id = o.id
  where r.listing_id = v_listing.id
    and r.id <> v_reservation.id
    and r.status = 'confirmed'
    and o.status = 'completed'
    and p.status = 'succeeded';

  v_can_confirm := (
    v_has_consistent_ownership
    and v_has_consistent_payment_order_link
    and v_has_valid_listing_status
    and v_has_matching_payment_amount
    and v_has_matching_payment_currency
    and v_payment.status = 'succeeded'
    and v_reservation.status not in ('cancelled', 'expired')
    and v_order.status not in ('cancelled', 'failed', 'conflict')
    and v_other_occupant_count = 0
    and not v_has_confirm_terminal_signal
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
    'contact', jsonb_build_object(
      'fullName', v_intake.contact_full_name,
      'phone', v_intake.contact_phone,
      'email', v_intake.contact_email,
      'preferredContactMethod', v_intake.preferred_contact_method,
      'preferredContactTime', v_intake.preferred_contact_time,
      'occupantFullName', v_intake.occupant_full_name,
      'documentReadiness', v_intake.document_readiness,
      'note', v_intake.note
    ),
    'latest_event', coalesce(v_latest_event, '{}'::jsonb),
    'eligibility', jsonb_build_object(
      'can_cancel', v_can_cancel,
      'can_confirm', v_can_confirm
    )
  );
end;
$$;
