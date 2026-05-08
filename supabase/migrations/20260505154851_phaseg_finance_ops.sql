do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'finance_ops_status'
  ) then
    create type public.finance_ops_status as enum (
      'refund_required',
      'refund_requested',
      'refund_completed',
      'deposit_forfeited',
      'manual_resolution_required',
      'conflict_payment',
      'issue_resolved',
      'payment_not_received'
    );
  end if;
end;
$$;

alter type public.finance_ops_status add value if not exists 'payment_not_received';

create table if not exists public.payment_finance_ops (
  id uuid primary key default extensions.gen_random_uuid(),
  payment_id uuid references public.payments(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  status public.finance_ops_status not null,
  admin_note text,
  last_admin_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_finance_ops_admin_note_length
    check (admin_note is null or length(admin_note) <= 1000)
);

create index if not exists idx_payment_finance_ops_reservation
on public.payment_finance_ops(reservation_id, updated_at desc);

create unique index if not exists idx_payment_finance_ops_payment_unique
on public.payment_finance_ops(payment_id)
where payment_id is not null;

create unique index if not exists idx_payment_finance_ops_missing_payment_unique
on public.payment_finance_ops(reservation_id)
where payment_id is null;

create index if not exists idx_payment_finance_ops_status
on public.payment_finance_ops(status, updated_at desc);

drop trigger if exists trg_payment_finance_ops_set_updated_at on public.payment_finance_ops;
create trigger trg_payment_finance_ops_set_updated_at
before update on public.payment_finance_ops
for each row
execute function public.set_row_updated_at();

alter table public.payment_finance_ops enable row level security;

revoke all on public.payment_finance_ops from anon, authenticated;
grant select on public.payment_finance_ops to authenticated;

drop policy if exists "Admins can read payment finance ops" on public.payment_finance_ops;
create policy "Admins can read payment finance ops"
on public.payment_finance_ops
for select
to authenticated
using (public.is_admin());

create or replace function internal.finance_ops_status_label(p_status public.finance_ops_status)
returns text
language sql
stable
set search_path = ''
as $$
  select case p_status
    when 'refund_required'::public.finance_ops_status then 'İade gerekli'
    when 'refund_requested'::public.finance_ops_status then 'Manuel iade bekliyor'
    when 'refund_completed'::public.finance_ops_status then 'İade tamamlandı'
    when 'deposit_forfeited'::public.finance_ops_status then 'Kapora iade edilmeyecek'
    when 'manual_resolution_required'::public.finance_ops_status then 'Ödeme sorunu'
    when 'conflict_payment'::public.finance_ops_status then 'Ödeme sorunu'
    when 'issue_resolved'::public.finance_ops_status then 'Ödeme sorunu çözüldü'
    when 'payment_not_received'::public.finance_ops_status then 'Ödeme alınmadı'
  end
$$;

create or replace function internal.finance_ops_workflow_name(p_status public.finance_ops_status)
returns text
language sql
stable
set search_path = ''
as $$
  select case p_status
    when 'refund_required'::public.finance_ops_status then 'admin_mark_refund_required'
    when 'refund_requested'::public.finance_ops_status then 'admin_mark_refund_requested'
    when 'refund_completed'::public.finance_ops_status then 'admin_mark_refund_completed'
    when 'deposit_forfeited'::public.finance_ops_status then 'admin_mark_deposit_forfeited'
    when 'manual_resolution_required'::public.finance_ops_status then 'admin_mark_manual_resolution_required'
    when 'conflict_payment'::public.finance_ops_status then 'admin_mark_conflict_payment'
    when 'issue_resolved'::public.finance_ops_status then 'admin_mark_payment_issue_resolved'
    when 'payment_not_received'::public.finance_ops_status then 'admin_mark_payment_not_received'
  end
$$;

create or replace function internal.admin_set_finance_ops_status(
  p_reservation_id uuid,
  p_status public.finance_ops_status,
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
  v_existing_status public.finance_ops_status;
  v_note text;
  v_order_count integer;
  v_payment_count integer;
  v_amount_drift boolean := false;
  v_ownership_drift boolean := false;
  v_event_id uuid;
  v_updated_at timestamptz;
  v_workflow_name text;
begin
  v_admin_user_id := auth.uid();

  if v_admin_user_id is null then
    raise exception 'authenticated admin is required' using errcode = '28000';
  end if;

  if not public.is_admin() then
    raise exception 'admin role is required' using errcode = '42501';
  end if;

  if p_reservation_id is null or p_status is null then
    raise exception 'reservation and finance status are required' using errcode = '22023';
  end if;

  v_note := nullif(btrim(coalesce(p_note, '')), '');
  if v_note is not null and length(v_note) > 1000 then
    raise exception 'p_note is too long' using errcode = '22023';
  end if;

  if p_status in (
       'refund_completed'::public.finance_ops_status,
       'manual_resolution_required'::public.finance_ops_status,
       'conflict_payment'::public.finance_ops_status,
       'issue_resolved'::public.finance_ops_status,
       'payment_not_received'::public.finance_ops_status
     )
     and v_note is null then
    raise exception 'admin note is required for finance operation: %', p_status using errcode = '22023';
  end if;

  select count(*)
  into v_order_count
  from public.orders
  where reservation_id = p_reservation_id;

  if v_order_count <> 1 then
    raise exception 'reservation order invariant violated: %', p_reservation_id using errcode = 'P0004';
  end if;

  select *
  into v_order
  from public.orders
  where reservation_id = p_reservation_id;

  select count(*)
  into v_payment_count
  from public.payments
  where order_id = v_order.id;

  if v_payment_count = 0 and p_status <> 'manual_resolution_required'::public.finance_ops_status then
    raise exception 'order payment invariant violated: %', v_order.id using errcode = 'P0004';
  end if;

  if v_payment_count > 1 then
    raise exception 'order payment invariant violated: %', v_order.id using errcode = 'P0004';
  end if;

  if v_payment_count = 1 then
    select *
    into v_payment
    from public.payments
    where order_id = v_order.id
    for update;
  end if;

  select *
  into v_order
  from public.orders
  where id = v_order.id
  for update;

  if not found then
    raise exception 'order not found for reservation: %', p_reservation_id using errcode = 'P0002';
  end if;

  select *
  into v_reservation
  from public.reservations
  where id = p_reservation_id
  for update;

  if not found then
    raise exception 'reservation not found: %', p_reservation_id using errcode = 'P0002';
  end if;

  select *
  into v_listing
  from public.listings
  where id = v_reservation.listing_id
  for update;

  if not found then
    raise exception 'listing not found for reservation: %', p_reservation_id using errcode = 'P0002';
  end if;

  if v_payment_count = 1 then
    v_amount_drift := v_payment.amount <> v_order.total_amount or v_payment.currency <> v_order.currency;
    v_ownership_drift := v_reservation.user_id <> v_order.user_id or v_order.user_id <> v_payment.user_id;

    if (v_amount_drift or v_ownership_drift)
       and p_status not in (
         'manual_resolution_required'::public.finance_ops_status,
         'conflict_payment'::public.finance_ops_status,
         'issue_resolved'::public.finance_ops_status,
         'payment_not_received'::public.finance_ops_status
       ) then
      raise exception 'finance ops invariant drift for reservation: %', p_reservation_id using errcode = 'P0004';
    end if;

    if p_status not in (
         'manual_resolution_required'::public.finance_ops_status,
         'conflict_payment'::public.finance_ops_status,
         'issue_resolved'::public.finance_ops_status,
         'payment_not_received'::public.finance_ops_status
       )
       and v_payment.status <> 'succeeded'::public.payment_status then
      raise exception 'finance ops requires succeeded payment: %', p_reservation_id using errcode = 'P0001';
    end if;
  end if;

  select status
  into v_existing_status
  from public.payment_finance_ops
  where (v_payment_count = 1 and payment_id = v_payment.id)
     or (v_payment_count = 0 and reservation_id = v_reservation.id and payment_id is null)
  limit 1;

  if v_existing_status in (
    'refund_completed'::public.finance_ops_status,
    'deposit_forfeited'::public.finance_ops_status,
    'issue_resolved'::public.finance_ops_status,
    'payment_not_received'::public.finance_ops_status
  ) then
    raise exception 'terminal finance ops status cannot transition: %', v_existing_status using errcode = 'P0001';
  end if;

  if p_status = 'refund_requested'::public.finance_ops_status
     and v_existing_status is distinct from 'refund_required'::public.finance_ops_status
     and v_existing_status is not null then
    raise exception 'invalid finance transition: % to %', v_existing_status, p_status using errcode = 'P0001';
  end if;

  if p_status = 'refund_completed'::public.finance_ops_status
     and v_existing_status is distinct from 'refund_requested'::public.finance_ops_status then
    raise exception 'invalid finance transition: % to %', v_existing_status, p_status using errcode = 'P0001';
  end if;

  if p_status = 'issue_resolved'::public.finance_ops_status
     and v_existing_status not in (
       'manual_resolution_required'::public.finance_ops_status,
       'conflict_payment'::public.finance_ops_status
     ) then
    raise exception 'invalid finance transition: % to %', v_existing_status, p_status using errcode = 'P0001';
  end if;

  if p_status = 'payment_not_received'::public.finance_ops_status
     and v_existing_status not in (
       'manual_resolution_required'::public.finance_ops_status,
       'conflict_payment'::public.finance_ops_status
     ) then
    raise exception 'invalid finance transition: % to %', v_existing_status, p_status using errcode = 'P0001';
  end if;

  if p_status = 'issue_resolved'::public.finance_ops_status then
    update public.payments
    set status = 'succeeded'::public.payment_status
    where id = v_payment.id;

    update public.orders
    set status = 'completed'::public.order_status
    where id = v_order.id;
  end if;

  if p_status = 'payment_not_received'::public.finance_ops_status then
    update public.payments
    set status = 'failed'::public.payment_status
    where id = v_payment.id;

    update public.orders
    set status = 'failed'::public.order_status
    where id = v_order.id;

    update public.reservations
    set status = 'cancelled'::public.reservation_status
    where id = v_reservation.id;

    update public.listings
    set status = 'active'::public.listing_status
    where id = v_reservation.listing_id;
  end if;

  v_workflow_name := internal.finance_ops_workflow_name(p_status);

  v_event_id := internal.log_admin_workflow_event(
    p_workflow_name => v_workflow_name,
    p_admin_user_id => v_admin_user_id,
    p_reservation_id => v_reservation.id,
    p_order_id => v_order.id,
    p_payment_id => case when v_payment_count = 1 then v_payment.id else null end,
    p_listing_id => v_reservation.listing_id,
    p_reason => null,
    p_note => v_note,
    p_payload => jsonb_build_object(
      'finance_status_before', v_existing_status::text,
      'finance_status_after', p_status::text,
      'amount_drift', v_amount_drift,
      'ownership_drift', v_ownership_drift,
      'no_provider_refund_triggered', true
    )
  );

  if v_payment_count = 1 then
    insert into public.payment_events (payment_id, event_type, provider, payload)
    values (
      v_payment.id,
      'admin_finance_ops_decision',
      'backoffice',
      jsonb_build_object(
        'workflow_name', v_workflow_name,
        'admin_user_id', v_admin_user_id,
        'reservation_id', v_reservation.id,
        'order_id', v_order.id,
        'finance_status_before', v_existing_status::text,
        'finance_status_after', p_status::text,
        'note', v_note,
        'no_provider_refund_triggered', true
      )
    );

    update public.payment_finance_ops
    set
      order_id = v_order.id,
      reservation_id = v_reservation.id,
      status = p_status,
      admin_note = v_note,
      last_admin_user_id = v_admin_user_id
    where payment_id = v_payment.id
    returning updated_at into v_updated_at;

    if not found then
      insert into public.payment_finance_ops (
        payment_id,
        order_id,
        reservation_id,
        status,
        admin_note,
        last_admin_user_id
      )
      values (
        v_payment.id,
        v_order.id,
        v_reservation.id,
        p_status,
        v_note,
        v_admin_user_id
      )
      returning updated_at into v_updated_at;
    end if;
  else
    update public.payment_finance_ops
    set
      order_id = v_order.id,
      status = p_status,
      admin_note = v_note,
      last_admin_user_id = v_admin_user_id
    where reservation_id = v_reservation.id
      and payment_id is null
    returning updated_at into v_updated_at;

    if not found then
      insert into public.payment_finance_ops (
        payment_id,
        order_id,
        reservation_id,
        status,
        admin_note,
        last_admin_user_id
      )
      values (
        null,
        v_order.id,
        v_reservation.id,
        p_status,
        v_note,
        v_admin_user_id
      )
      returning updated_at into v_updated_at;
    end if;
  end if;

  return jsonb_build_object(
    'result', 'finance_' || p_status::text,
    'event_id', v_event_id,
    'reservation_id', v_reservation.id,
    'order_id', v_order.id,
    'payment_id', case when v_payment_count = 1 then v_payment.id else null end,
    'listing_id', v_reservation.listing_id,
    'finance_status', p_status::text,
    'admin_note', v_note,
    'updated_at', v_updated_at
  );
end;
$$;

create or replace function public.get_admin_reservation_finance_ops(p_reservation_id uuid)
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
  v_finance public.payment_finance_ops%rowtype;
  v_order_count integer := 0;
  v_payment_count integer := 0;
  v_amount_drift boolean := false;
  v_ownership_drift boolean := false;
  v_missing_payment boolean := false;
  v_recommended_status text := null;
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

  select count(*)
  into v_order_count
  from public.orders
  where reservation_id = p_reservation_id;

  if v_order_count <> 1 then
    raise exception 'reservation order invariant violated: %', p_reservation_id using errcode = 'P0004';
  end if;

  select *
  into v_order
  from public.orders
  where reservation_id = p_reservation_id;

  select count(*)
  into v_payment_count
  from public.payments
  where order_id = v_order.id;

  v_missing_payment := v_payment_count = 0;

  if v_payment_count = 1 then
    select *
    into v_payment
    from public.payments
    where order_id = v_order.id;

    v_amount_drift := v_payment.amount <> v_order.total_amount or v_payment.currency <> v_order.currency;
    v_ownership_drift := v_reservation.user_id <> v_order.user_id or v_order.user_id <> v_payment.user_id;

    select *
    into v_finance
    from public.payment_finance_ops
    where payment_id = v_payment.id;
  elsif v_payment_count = 0 then
    select *
    into v_finance
    from public.payment_finance_ops
    where reservation_id = v_reservation.id
      and payment_id is null;
  end if;

  if v_missing_payment or v_amount_drift or v_ownership_drift then
    v_recommended_status := 'manual_resolution_required';
  elsif v_payment_count = 1 and (v_payment.status = 'conflict'::public.payment_status or v_order.status = 'conflict'::public.order_status) then
    v_recommended_status := 'conflict_payment';
  elsif v_payment_count = 1
        and v_payment.status = 'succeeded'::public.payment_status
        and v_reservation.status = 'cancelled'::public.reservation_status then
    v_recommended_status := 'refund_required';
  end if;

  return jsonb_build_object(
    'reservation_id', v_reservation.id,
    'order_id', v_order.id,
    'payment_id', case when v_payment_count = 1 then v_payment.id else null end,
    'finance_status', case when v_finance.id is not null then v_finance.status::text else null end,
    'status_label', case
      when v_finance.id is not null then internal.finance_ops_status_label(v_finance.status)
      else 'No finance decision'
    end,
    'recommended_status', v_recommended_status,
    'admin_note', v_finance.admin_note,
    'updated_at', v_finance.updated_at,
    'last_admin_user_id', v_finance.last_admin_user_id,
    'admin_display', (
      select case
        when nullif(btrim(p.full_name), '') is not null then 'Admin - ' || btrim(p.full_name)
        when nullif(btrim(p.email), '') is not null then 'Admin - ' || btrim(p.email)
        else 'Admin'
      end
      from public.profiles p
      where p.id = v_finance.last_admin_user_id
    ),
    'deposit_refund_window', jsonb_build_object(
      'has_deposit', exists (
        select 1
        from public.order_items oi
        where oi.order_id = v_order.id
          and lower(oi.label) like '%kapora%'
      ),
      'payment_date', v_payment.created_at,
      'elapsed_days', case
        when v_payment.id is null then null
        else greatest(0, floor(extract(epoch from (now() - v_payment.created_at)) / 86400))::integer
      end,
      'is_expired', case
        when v_payment.id is null then false
        else v_payment.created_at < now() - interval '14 days'
      end,
      'system_recommendation', case
        when v_payment.id is null then 'no_payment'
        when v_payment.created_at < now() - interval '14 days' then 'manual_review_required'
        else 'refund_allowed'
      end
    ),
    'issue_flags', jsonb_build_object(
      'amount_drift', v_amount_drift,
      'ownership_drift', v_ownership_drift,
      'missing_payment', v_missing_payment
    )
  );
end;
$$;

create or replace function public.admin_mark_refund_required(p_reservation_id uuid, p_note text default null)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal.admin_set_finance_ops_status(p_reservation_id, 'refund_required'::public.finance_ops_status, p_note)
$$;

create or replace function public.admin_mark_documents_completed(
  p_reservation_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_finance_status public.finance_ops_status;
begin
  select status
  into v_finance_status
  from public.payment_finance_ops
  where reservation_id = p_reservation_id
  order by updated_at desc, created_at desc
  limit 1
  for update;

  if v_finance_status in (
    'refund_required'::public.finance_ops_status,
    'refund_requested'::public.finance_ops_status,
    'manual_resolution_required'::public.finance_ops_status,
    'conflict_payment'::public.finance_ops_status
  ) then
    raise exception 'document completion requires closed finance workflow: %', v_finance_status using errcode = 'P0001';
  end if;

  return internal.admin_set_reservation_documents(
    p_reservation_id,
    'completed'::public.document_tracking_status,
    p_note
  );
end;
$$;

create or replace function public.admin_mark_refund_requested(p_reservation_id uuid, p_note text default null)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal.admin_set_finance_ops_status(p_reservation_id, 'refund_requested'::public.finance_ops_status, p_note)
$$;

create or replace function public.admin_mark_refund_completed(p_reservation_id uuid, p_note text default null)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal.admin_set_finance_ops_status(p_reservation_id, 'refund_completed'::public.finance_ops_status, p_note)
$$;

create or replace function public.admin_mark_deposit_forfeited(p_reservation_id uuid, p_note text default null)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal.admin_set_finance_ops_status(p_reservation_id, 'deposit_forfeited'::public.finance_ops_status, p_note)
$$;

create or replace function public.admin_mark_manual_resolution_required(p_reservation_id uuid, p_note text default null)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal.admin_set_finance_ops_status(p_reservation_id, 'manual_resolution_required'::public.finance_ops_status, p_note)
$$;

create or replace function public.admin_mark_conflict_payment(p_reservation_id uuid, p_note text default null)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal.admin_set_finance_ops_status(p_reservation_id, 'conflict_payment'::public.finance_ops_status, p_note)
$$;

create or replace function public.admin_mark_payment_issue_resolved(p_reservation_id uuid, p_note text default null)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal.admin_set_finance_ops_status(p_reservation_id, 'issue_resolved'::public.finance_ops_status, p_note)
$$;

create or replace function public.admin_mark_payment_not_received(p_reservation_id uuid, p_note text default null)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal.admin_set_finance_ops_status(p_reservation_id, 'payment_not_received'::public.finance_ops_status, p_note)
$$;

drop function if exists public.admin_cancel_reservation(uuid, text, text);
drop function if exists internal.admin_cancel_reservation(uuid, text, text);

create function internal.admin_cancel_reservation(
  p_reservation_id uuid,
  p_refund_decision text,
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
  v_refund_decision text;
  v_note text;
  v_event_id uuid;
  v_finance_updated_at timestamptz;
  v_is_paid_held_document_workflow boolean := false;
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

  v_refund_decision := nullif(btrim(coalesce(p_refund_decision, '')), '');
  v_note := nullif(btrim(coalesce(p_note, '')), '');

  if v_refund_decision not in ('manual_refund', 'no_refund') then
    raise exception 'refund decision is required' using errcode = '22023';
  end if;

  if v_note is null then
    raise exception 'admin cancel note is required' using errcode = '22023';
  end if;

  if char_length(v_note) > 1000 then
    raise exception 'p_note is too long' using errcode = '22023';
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

  select *
  into v_payment
  from public.payments
  where id = v_payment.id
  for update;

  select *
  into v_order
  from public.orders
  where id = v_order.id
  for update;

  select *
  into v_reservation
  from public.reservations
  where id = v_reservation.id
  for update;

  select *
  into v_listing
  from public.listings
  where id = v_listing.id
  for update;

  if v_order.user_id is distinct from v_reservation.user_id
     or v_payment.user_id is distinct from v_reservation.user_id then
    raise exception 'reservation ownership invariant violated: %', v_reservation.id using errcode = 'P0004';
  end if;

  if v_payment.order_id is distinct from v_order.id then
    raise exception 'payment order invariant violated: %', v_payment.id using errcode = 'P0004';
  end if;

  if v_listing.status is null
     or v_listing.status not in ('active', 'passive') then
    raise exception 'listing status invariant violated: %', v_listing.id using errcode = 'P0004';
  end if;

  if v_payment.amount is distinct from v_order.total_amount then
    raise exception 'payment amount invariant violated: %', v_payment.id using errcode = 'P0004';
  end if;

  if v_payment.currency is distinct from v_order.currency then
    raise exception 'payment currency invariant violated: %', v_payment.id using errcode = 'P0004';
  end if;

  v_is_paid_held_document_workflow := (
    coalesce(v_payment.status = 'succeeded'::public.payment_status, false)
    and coalesce(v_reservation.status = 'pending'::public.reservation_status, false)
    and coalesce(v_order.status = 'completed'::public.order_status, false)
    and coalesce(v_listing.status = 'passive'::public.listing_status, false)
  );

  if (
    coalesce(v_payment.status = 'succeeded', false)
    or coalesce(v_reservation.status = 'confirmed', false)
    or coalesce(v_order.status = 'completed', false)
    or coalesce(v_listing.status = 'passive', false)
  ) and not (
    coalesce(v_payment.status = 'succeeded', false)
    and coalesce(v_reservation.status = 'confirmed', false)
    and coalesce(v_order.status = 'completed', false)
    and coalesce(v_listing.status = 'passive', false)
  )
  and not v_is_paid_held_document_workflow then
    raise exception 'reservation cancel invariant drift: %', v_reservation.id using errcode = 'P0004';
  end if;

  if v_reservation.status is null
     or v_reservation.status in ('cancelled', 'expired') then
    raise exception 'reservation cannot be cancelled from status: %', v_reservation.status using errcode = 'P0001';
  end if;

  if v_order.status is null
     or v_order.status = 'cancelled' then
    raise exception 'order cannot be cancelled from status: %', v_order.status using errcode = 'P0001';
  end if;

  if v_payment.status = 'pending' then
    raise exception 'bank payment approval is still pending: %', v_reservation.id using errcode = 'P0001';
  end if;

  if v_refund_decision = 'manual_refund'
     and v_payment.status <> 'succeeded'::public.payment_status then
    raise exception 'manual refund requires succeeded payment: %', v_reservation.id using errcode = 'P0001';
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

  update public.listings
  set
    status = 'active',
    updated_at = now()
  where id = v_listing.id;

  if v_refund_decision = 'manual_refund' then
    insert into public.payment_finance_ops (
      payment_id,
      order_id,
      reservation_id,
      status,
      admin_note,
      last_admin_user_id
    )
    values (
      v_payment.id,
      v_order.id,
      v_reservation.id,
      'refund_requested'::public.finance_ops_status,
      v_note,
      v_admin_user_id
    )
    on conflict (payment_id) where payment_id is not null do update
    set
      order_id = excluded.order_id,
      reservation_id = excluded.reservation_id,
      status = 'refund_requested'::public.finance_ops_status,
      admin_note = excluded.admin_note,
      last_admin_user_id = excluded.last_admin_user_id
    returning updated_at into v_finance_updated_at;

    insert into public.payment_events (payment_id, event_type, provider, payload)
    values (
      v_payment.id,
      'manual_refund_pending',
      'backoffice',
      jsonb_build_object(
        'reservation_id', v_reservation.id,
        'order_id', v_order.id,
        'admin_user_id', v_admin_user_id,
        'note', v_note,
        'no_provider_refund_triggered', true
      )
    );
  end if;

  v_event_id := internal.log_admin_workflow_event(
    'admin_cancel_reservation',
    v_admin_user_id,
    v_reservation.id,
    v_order.id,
    v_payment.id,
    v_listing.id,
    v_refund_decision,
    v_note,
    jsonb_build_object(
      'before_reservation_status', v_reservation.status,
      'before_order_status', v_order.status,
      'before_payment_status', v_payment.status,
      'before_listing_status', v_listing.status,
      'refund_decision', v_refund_decision,
      'finance_status_after', case when v_refund_decision = 'manual_refund' then 'refund_requested' else null end,
      'no_provider_refund_triggered', true
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
    'listing_status', 'active',
    'refund_decision', v_refund_decision,
    'finance_status', case when v_refund_decision = 'manual_refund' then 'refund_requested' else null end,
    'finance_updated_at', v_finance_updated_at
  );
end;
$$;

create function public.admin_cancel_reservation(
  p_reservation_id uuid,
  p_refund_decision text,
  p_note text default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal.admin_cancel_reservation(
    p_reservation_id,
    p_refund_decision,
    p_note
  );
$$;

revoke all on function public.get_admin_reservation_finance_ops(uuid) from public, anon;
revoke all on function public.admin_mark_refund_required(uuid, text) from public, anon;
revoke all on function public.admin_mark_refund_requested(uuid, text) from public, anon;
revoke all on function public.admin_mark_refund_completed(uuid, text) from public, anon;
revoke all on function public.admin_mark_deposit_forfeited(uuid, text) from public, anon;
revoke all on function public.admin_mark_manual_resolution_required(uuid, text) from public, anon;
revoke all on function public.admin_mark_conflict_payment(uuid, text) from public, anon;
revoke all on function public.admin_mark_payment_issue_resolved(uuid, text) from public, anon;
revoke all on function public.admin_mark_payment_not_received(uuid, text) from public, anon;

grant execute on function public.get_admin_reservation_finance_ops(uuid) to authenticated;
grant execute on function public.admin_mark_refund_required(uuid, text) to authenticated;
grant execute on function public.admin_mark_refund_requested(uuid, text) to authenticated;
grant execute on function public.admin_mark_refund_completed(uuid, text) to authenticated;
grant execute on function public.admin_mark_deposit_forfeited(uuid, text) to authenticated;
grant execute on function public.admin_mark_manual_resolution_required(uuid, text) to authenticated;
grant execute on function public.admin_mark_conflict_payment(uuid, text) to authenticated;
grant execute on function public.admin_mark_payment_issue_resolved(uuid, text) to authenticated;
grant execute on function public.admin_mark_payment_not_received(uuid, text) to authenticated;
