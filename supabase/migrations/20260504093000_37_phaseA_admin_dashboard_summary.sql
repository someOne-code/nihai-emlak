create or replace function public.admin_dashboard_summary()
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_listing_total integer;
  v_listing_active integer;
  v_listing_passive integer;
  v_listing_without_images integer;
  v_rent_listings_not_checkout_ready integer;
  v_pending_reservations integer;
  v_failed_or_conflict_payments integer;
  v_manual_resolution_required integer;
begin
  if auth.uid() is null then
    raise exception 'authenticated admin is required'
      using errcode = '28000';
  end if;

  if not (select public.is_admin()) then
    raise exception 'admin role is required'
      using errcode = '42501';
  end if;

  select count(*)::integer
  into v_listing_total
  from public.listings;

  select count(*)::integer
  into v_listing_active
  from public.listings
  where status = 'active';

  select count(*)::integer
  into v_listing_passive
  from public.listings
  where status = 'passive';

  select count(*)::integer
  into v_listing_without_images
  from public.listings l
  where not exists (
    select 1
    from public.listing_images li
    where li.listing_id = l.id
  );

  select count(*)::integer
  into v_rent_listings_not_checkout_ready
  from public.listings l
  where l.type = 'rent'
    and not public.admin_listing_is_checkout_ready(l.id);

  select count(*)::integer
  into v_pending_reservations
  from public.reservations
  where status = 'pending';

  select count(*)::integer
  into v_failed_or_conflict_payments
  from public.payments
  where status in ('failed', 'conflict');

  select count(*)::integer
  into v_manual_resolution_required
  from public.admin_workflow_events e
  where e.workflow_name in (
    'admin_cancel_reservation_rejected',
    'admin_confirm_reservation_rejected',
    'admin_reopen_listing_rejected'
  );

  return jsonb_build_object(
    'listing_total', v_listing_total,
    'listing_active', v_listing_active,
    'listing_passive', v_listing_passive,
    'listing_without_images', v_listing_without_images,
    'rent_listings_not_checkout_ready', v_rent_listings_not_checkout_ready,
    'pending_reservations', v_pending_reservations,
    'failed_or_conflict_payments', v_failed_or_conflict_payments,
    'manual_resolution_required', v_manual_resolution_required,
    'communication_items', null
  );
end;
$$;

revoke all on function public.admin_dashboard_summary()
from public;
revoke execute on function public.admin_dashboard_summary()
from anon;
grant execute on function public.admin_dashboard_summary()
to authenticated;
