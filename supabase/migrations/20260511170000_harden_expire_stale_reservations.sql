-- Harden expire_stale_reservations to also cover the checkout-initiated-but-unpaid scenario.
--
-- Previous version only expired reservations WITHOUT an order (abandoned before checkout).
-- This version also expires reservations WITH an order where the payment is still pending
-- after the threshold. This prevents a DoS vector where a bad actor repeatedly triggers
-- checkout but never completes payment, blocking the listing indefinitely.
--
-- Expired reservations free the single-pending-per-listing slot so other customers
-- can proceed. The listing status is NOT touched (it stays active; it only becomes
-- passive on successful payment callback).

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
  update public.reservations r
  set
    status = 'expired'::public.reservation_status,
    updated_at = now()
  where r.status = 'pending'::public.reservation_status
    and r.created_at < now() - p_stale_threshold
    -- Expire if EITHER:
    --   (a) no order exists (abandoned before checkout pipeline), OR
    --   (b) order exists but no payment has succeeded yet
    and not exists (
      select 1
      from public.orders o
      join public.payments p on p.order_id = o.id
      where o.reservation_id = r.id
        and p.status = 'succeeded'
    );

  get diagnostics v_expired_count = row_count;
  return v_expired_count;
end;
$$;
