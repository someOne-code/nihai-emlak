do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'document_tracking_status'
  ) then
    create type public.document_tracking_status as enum (
      'not_requested',
      'requested',
      'waiting',
      'completed',
      'failed'
    );
  end if;
end;
$$;

create table if not exists public.reservation_document_tracking (
  reservation_id uuid primary key references public.reservations(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete restrict,
  status public.document_tracking_status not null default 'not_requested',
  admin_note text,
  last_admin_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservation_document_tracking_admin_note_length
    check (admin_note is null or length(admin_note) <= 1000)
);

create index if not exists idx_reservation_document_tracking_status
on public.reservation_document_tracking(status, updated_at desc);

drop trigger if exists trg_reservation_document_tracking_set_updated_at
on public.reservation_document_tracking;
create trigger trg_reservation_document_tracking_set_updated_at
before update on public.reservation_document_tracking
for each row
execute function public.set_row_updated_at();

alter table public.reservation_document_tracking enable row level security;

revoke all on public.reservation_document_tracking from anon, authenticated;
grant select on public.reservation_document_tracking to authenticated;

drop policy if exists "Admins can read reservation document tracking" on public.reservation_document_tracking;
create policy "Admins can read reservation document tracking"
on public.reservation_document_tracking
for select
to authenticated
using (public.is_admin());

create or replace function internal.document_status_label(p_status public.document_tracking_status)
returns text
language sql
stable
set search_path = ''
as $$
  select case p_status
    when 'not_requested'::public.document_tracking_status then 'Belge istenmedi'
    when 'requested'::public.document_tracking_status then 'Belge istendi'
    when 'waiting'::public.document_tracking_status then 'Bekleniyor'
    when 'completed'::public.document_tracking_status then 'Tamamlandi'
    when 'failed'::public.document_tracking_status then 'Eksik/basarisiz'
  end
$$;

create or replace function internal.admin_set_reservation_documents(
  p_reservation_id uuid,
  p_status public.document_tracking_status,
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
  v_existing_status public.document_tracking_status := 'not_requested';
  v_note text;
  v_workflow_name text;
  v_result text;
  v_event_id uuid;
  v_updated_at timestamptz;
begin
  v_admin_user_id := auth.uid();

  if v_admin_user_id is null then
    raise exception 'authenticated admin is required' using errcode = '28000';
  end if;

  if not public.is_admin() then
    raise exception 'admin role is required' using errcode = '42501';
  end if;

  if p_reservation_id is null then
    raise exception 'p_reservation_id is required' using errcode = '22023';
  end if;

  if p_status is null or p_status = 'not_requested'::public.document_tracking_status then
    raise exception 'document workflow target status is invalid' using errcode = '22023';
  end if;

  v_note := nullif(btrim(coalesce(p_note, '')), '');
  if v_note is not null and length(v_note) > 1000 then
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

  if v_reservation.status in ('cancelled'::public.reservation_status, 'expired'::public.reservation_status) then
    raise exception 'terminal reservation cannot enter document workflow: %', p_reservation_id using errcode = 'P0001';
  end if;

  select *
  into v_order
  from public.orders
  where reservation_id = p_reservation_id
  for update;

  if not found then
    raise exception 'order not found for reservation: %', p_reservation_id using errcode = 'P0004';
  end if;

  select *
  into v_payment
  from public.payments
  where order_id = v_order.id
    and status = 'succeeded'::public.payment_status
  order by updated_at desc, created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'document workflow requires succeeded payment: %', p_reservation_id using errcode = 'P0001';
  end if;

  select *
  into v_listing
  from public.listings
  where id = v_reservation.listing_id
  for update;

  if not found then
    raise exception 'listing not found for reservation: %', p_reservation_id using errcode = 'P0002';
  end if;

  select status
  into v_existing_status
  from public.reservation_document_tracking
  where reservation_id = p_reservation_id
  for update;

  v_existing_status := coalesce(v_existing_status, 'not_requested'::public.document_tracking_status);

  if p_status = 'requested'::public.document_tracking_status
     and v_existing_status not in ('not_requested'::public.document_tracking_status, 'failed'::public.document_tracking_status) then
    raise exception 'invalid document workflow transition: % to %', v_existing_status, p_status using errcode = 'P0001';
  end if;

  if p_status = 'waiting'::public.document_tracking_status
     and v_existing_status not in ('requested'::public.document_tracking_status, 'failed'::public.document_tracking_status) then
    raise exception 'invalid document workflow transition: % to %', v_existing_status, p_status using errcode = 'P0001';
  end if;

  if p_status = 'completed'::public.document_tracking_status
     and v_existing_status not in ('requested'::public.document_tracking_status, 'waiting'::public.document_tracking_status) then
    raise exception 'invalid document workflow transition: % to %', v_existing_status, p_status using errcode = 'P0001';
  end if;

  if p_status = 'failed'::public.document_tracking_status
     and v_existing_status not in ('requested'::public.document_tracking_status, 'waiting'::public.document_tracking_status) then
    raise exception 'invalid document workflow transition: % to %', v_existing_status, p_status using errcode = 'P0001';
  end if;

  if p_status = 'completed'::public.document_tracking_status then
    if v_order.status in ('cancelled'::public.order_status, 'failed'::public.order_status, 'conflict'::public.order_status) then
      raise exception 'document completion requires a valid order status: %', v_order.status using errcode = 'P0001';
    end if;

    if v_listing.status not in ('active'::public.listing_status, 'passive'::public.listing_status) then
      raise exception 'document completion requires a valid listing status: %', v_listing.status using errcode = 'P0004';
    end if;
  end if;

  v_workflow_name := case p_status
    when 'requested'::public.document_tracking_status then 'admin_request_documents'
    when 'waiting'::public.document_tracking_status then 'admin_mark_documents_waiting'
    when 'completed'::public.document_tracking_status then 'admin_mark_documents_completed'
    when 'failed'::public.document_tracking_status then 'admin_mark_documents_failed'
    else null
  end;

  v_result := case p_status
    when 'requested'::public.document_tracking_status then 'documents_requested'
    when 'waiting'::public.document_tracking_status then 'documents_waiting'
    when 'completed'::public.document_tracking_status then 'documents_completed'
    when 'failed'::public.document_tracking_status then 'documents_failed'
    else null
  end;

  v_event_id := internal.log_admin_workflow_event(
    p_workflow_name => v_workflow_name,
    p_admin_user_id => v_admin_user_id,
    p_reservation_id => v_reservation.id,
    p_order_id => v_order.id,
    p_payment_id => v_payment.id,
    p_listing_id => v_reservation.listing_id,
    p_reason => null,
    p_note => v_note,
    p_payload => jsonb_build_object(
      'document_status_before', v_existing_status::text,
      'document_status_after', p_status::text
    )
  );

  insert into public.reservation_document_tracking (
    reservation_id,
    order_id,
    status,
    admin_note,
    last_admin_user_id
  )
  values (
    v_reservation.id,
    v_order.id,
    p_status,
    v_note,
    v_admin_user_id
  )
  on conflict (reservation_id) do update
  set
    order_id = excluded.order_id,
    status = excluded.status,
    admin_note = excluded.admin_note,
    last_admin_user_id = excluded.last_admin_user_id
  returning updated_at into v_updated_at;

  if p_status = 'completed'::public.document_tracking_status then
    update public.orders
    set
      status = 'completed'::public.order_status,
      updated_at = now()
    where id = v_order.id;

    update public.reservations
    set
      status = 'confirmed'::public.reservation_status,
      updated_at = now()
    where id = v_reservation.id;

    update public.listings
    set
      status = 'passive'::public.listing_status,
      updated_at = now()
    where id = v_listing.id;
  end if;

  return jsonb_build_object(
    'result', v_result,
    'event_id', v_event_id,
    'reservation_id', v_reservation.id,
    'order_id', v_order.id,
    'payment_id', v_payment.id,
    'listing_id', v_reservation.listing_id,
    'document_status', p_status::text,
    'admin_note', v_note,
    'updated_at', v_updated_at
  );
end;
$$;

create or replace function public.admin_request_documents(
  p_reservation_id uuid,
  p_note text default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal.admin_set_reservation_documents(
    p_reservation_id,
    'requested'::public.document_tracking_status,
    p_note
  )
$$;

create or replace function public.admin_mark_documents_waiting(
  p_reservation_id uuid,
  p_note text default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal.admin_set_reservation_documents(
    p_reservation_id,
    'waiting'::public.document_tracking_status,
    p_note
  )
$$;

create or replace function public.admin_mark_documents_completed(
  p_reservation_id uuid,
  p_note text default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal.admin_set_reservation_documents(
    p_reservation_id,
    'completed'::public.document_tracking_status,
    p_note
  )
$$;

create or replace function public.admin_mark_documents_failed(
  p_reservation_id uuid,
  p_note text default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal.admin_set_reservation_documents(
    p_reservation_id,
    'failed'::public.document_tracking_status,
    p_note
  )
$$;

create or replace function public.get_admin_reservation_documents(p_reservation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_user_id uuid;
  v_reservation public.reservations%rowtype;
  v_order public.orders%rowtype;
  v_tracking public.reservation_document_tracking%rowtype;
  v_status public.document_tracking_status := 'not_requested';
begin
  v_admin_user_id := auth.uid();

  if v_admin_user_id is null then
    raise exception 'authenticated admin is required' using errcode = '28000';
  end if;

  if not public.is_admin() then
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
  into v_order
  from public.orders
  where reservation_id = p_reservation_id
  order by created_at desc
  limit 1;

  select *
  into v_tracking
  from public.reservation_document_tracking
  where reservation_id = p_reservation_id;

  if found then
    v_status := v_tracking.status;
  end if;

  return jsonb_build_object(
    'reservation_id', v_reservation.id,
    'order_id', v_order.id,
    'document_status', v_status::text,
    'status_label', internal.document_status_label(v_status),
    'admin_note', v_tracking.admin_note,
    'updated_at', v_tracking.updated_at,
    'last_admin_user_id', v_tracking.last_admin_user_id,
    'admin_display', (
      select case
        when nullif(btrim(p.full_name), '') is not null then 'Admin - ' || btrim(p.full_name)
        when nullif(btrim(p.email), '') is not null then 'Admin - ' || btrim(p.email)
        else 'Admin'
      end
      from public.profiles p
      where p.id = v_tracking.last_admin_user_id
    )
  );
end;
$$;

revoke all on function public.admin_request_documents(uuid, text) from public, anon;
revoke all on function public.admin_mark_documents_waiting(uuid, text) from public, anon;
revoke all on function public.admin_mark_documents_completed(uuid, text) from public, anon;
revoke all on function public.admin_mark_documents_failed(uuid, text) from public, anon;
revoke all on function public.get_admin_reservation_documents(uuid) from public, anon;

grant execute on function public.admin_request_documents(uuid, text) to authenticated;
grant execute on function public.admin_mark_documents_waiting(uuid, text) to authenticated;
grant execute on function public.admin_mark_documents_completed(uuid, text) to authenticated;
grant execute on function public.admin_mark_documents_failed(uuid, text) to authenticated;
grant execute on function public.get_admin_reservation_documents(uuid) to authenticated;
