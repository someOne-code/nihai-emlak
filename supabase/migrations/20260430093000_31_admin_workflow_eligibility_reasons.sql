-- Phase 5: admin workflow snapshot eligibility reasons

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
  v_can_cancel_reason text := null;
  v_can_confirm_reason text := null;
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
    and v_payment.status <> 'pending'
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

  if not v_can_cancel then
    if not v_has_consistent_ownership then
      v_can_cancel_reason := 'Rezervasyon, siparis ve odeme sahipligi tutarsiz.';
    elsif not v_has_consistent_payment_order_link then
      v_can_cancel_reason := 'Odeme dogru siparise bagli degil.';
    elsif not v_has_valid_listing_status then
      v_can_cancel_reason := 'Ilan durumu bu islem icin uygun degil.';
    elsif not v_has_matching_payment_amount then
      v_can_cancel_reason := 'Odeme tutari siparis toplamiyla eslesmiyor.';
    elsif not v_has_matching_payment_currency then
      v_can_cancel_reason := 'Odeme para birimi siparis para birimiyle eslesmiyor.';
    elsif v_payment.status = 'pending' then
      v_can_cancel_reason := 'Banka odeme onayi bekleniyor.';
    elsif v_reservation.status in ('cancelled', 'expired') then
      v_can_cancel_reason := 'Rezervasyon zaten iptal edilmis veya suresi dolmus.';
    elsif v_order.status = 'cancelled' then
      v_can_cancel_reason := 'Siparis zaten iptal edilmis.';
    elsif v_has_terminal_signal and not v_has_success_terminal_tuple then
      v_can_cancel_reason := 'Kayit terminal durumda ve iptal icin uygun degil.';
    else
      v_can_cancel_reason := 'Bu rezervasyon su an iptal edilemez.';
    end if;
  end if;

  if not v_can_confirm then
    if not v_has_consistent_ownership then
      v_can_confirm_reason := 'Rezervasyon, siparis ve odeme sahipligi tutarsiz.';
    elsif not v_has_consistent_payment_order_link then
      v_can_confirm_reason := 'Odeme dogru siparise bagli degil.';
    elsif not v_has_valid_listing_status then
      v_can_confirm_reason := 'Ilan durumu bu islem icin uygun degil.';
    elsif not v_has_matching_payment_amount then
      v_can_confirm_reason := 'Odeme tutari siparis toplamiyla eslesmiyor.';
    elsif not v_has_matching_payment_currency then
      v_can_confirm_reason := 'Odeme para birimi siparis para birimiyle eslesmiyor.';
    elsif v_reservation.status = 'confirmed' then
      v_can_confirm_reason := 'Rezervasyon zaten onaylanmis.';
    elsif v_reservation.status in ('cancelled', 'expired') then
      v_can_confirm_reason := 'Rezervasyon iptal edilmis veya suresi dolmus.';
    elsif v_payment.status <> 'succeeded' then
      v_can_confirm_reason := 'Odeme henuz basarili degil.';
    elsif v_order.status in ('cancelled', 'failed', 'conflict') then
      v_can_confirm_reason := 'Siparis iptal/basarisiz/uyusmazlik durumunda.';
    elsif v_has_confirm_terminal_signal then
      v_can_confirm_reason := 'Ilan durumu bu islem icin uygun degil.';
    elsif v_other_occupant_count > 0 then
      v_can_confirm_reason := 'Bu ilan icin baska tamamlanmis rezervasyon var.';
    else
      v_can_confirm_reason := 'Bu rezervasyon su an onaylanamaz.';
    end if;
  end if;

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
      'currency', v_payment.currency,
      'created_at', v_payment.created_at,
      'updated_at', v_payment.updated_at
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
      'can_cancel_reason', v_can_cancel_reason,
      'can_confirm', v_can_confirm,
      'can_confirm_reason', v_can_confirm_reason
    )
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
  v_can_reopen_reason text := null;
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

  if not v_can_reopen then
    if v_listing.status <> 'passive' then
      v_can_reopen_reason := 'Ilan durumu bu islem icin uygun degil.';
    elsif v_live_reservation_count > 0 then
      v_can_reopen_reason := 'Bu ilan icin aktif/onayli rezervasyon var.';
    elsif v_live_order_count > 0 then
      v_can_reopen_reason := 'Bu ilana bagli bekleyen/tamamlanan siparis var.';
    elsif v_pending_payment_count > 0 then
      v_can_reopen_reason := 'Bu ilana bagli bekleyen odeme var.';
    elsif v_succeeded_payment_drift_count > 0 then
      v_can_reopen_reason := 'Bu ilana bagli tamamlanmis odeme kaydi var.';
    else
      v_can_reopen_reason := 'Bu ilan su an yeniden acilamaz.';
    end if;
  end if;

  return jsonb_build_object(
    'listing', jsonb_build_object(
      'id', v_listing.id,
      'status', v_listing.status
    ),
    'latest_event', coalesce(v_latest_event, '{}'::jsonb),
    'eligibility', jsonb_build_object(
      'can_reopen', v_can_reopen,
      'can_reopen_reason', v_can_reopen_reason
    )
  );
end;
$$;
