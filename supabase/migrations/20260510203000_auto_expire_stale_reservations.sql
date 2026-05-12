-- Auto-expire stale pending reservations that never entered the checkout pipeline.
--
-- Business rule:
--   A reservation that stays "pending" for more than 30 minutes without a
--   corresponding order record means the customer abandoned before checkout.
--   These reservations are expired automatically so they stop occupying space
--   in admin queries and do not block the listing from future checkout attempts.
--
-- The listing status is NOT touched here because:
--   Listings become "passive" only after successful payment callback.
--   A reservation without an order never triggered a payment, so the listing
--   is still "active" and needs no release.

-- Enable pg_cron extension (already available in Supabase hosted; needed for local dev)
create extension if not exists pg_cron with schema extensions;

-- The cleanup function: expire stale pre-checkout reservations
create or replace function public.expire_stale_reservations(
  p_stale_threshold interval default interval '30 minutes'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expired_count integer;
begin
  update public.reservations
  set
    status = 'expired'::public.reservation_status,
    updated_at = now()
  where status = 'pending'::public.reservation_status
    and created_at < now() - p_stale_threshold
    and not exists (
      select 1 from public.orders o where o.reservation_id = reservations.id
    );

  get diagnostics v_expired_count = row_count;
  return v_expired_count;
end;
$$;

-- Lock down: only postgres (cron) and service_role can call this
revoke all on function public.expire_stale_reservations(interval) from public;
revoke execute on function public.expire_stale_reservations(interval) from anon;
revoke execute on function public.expire_stale_reservations(interval) from authenticated;

-- Schedule: run every 15 minutes
select cron.schedule(
  'expire-stale-reservations',
  '*/15 * * * *',
  $$select public.expire_stale_reservations()$$
);
