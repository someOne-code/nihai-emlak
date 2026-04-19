-- Phase 1 / Task 7 hardening:
-- Prevent multiple open Isbank pending payments for the same order.

with ranked_pending as (
  select
    id,
    row_number() over (
      partition by order_id
      order by created_at desc, id desc
    ) as rn
  from public.payments
  where provider = 'isbank'
    and status = 'pending'
)
update public.payments p
set
  status = 'conflict',
  updated_at = now()
from ranked_pending r
where p.id = r.id
  and r.rn > 1;

create unique index if not exists payments_unique_pending_isbank_per_order
  on public.payments (order_id)
  where provider = 'isbank'
    and status = 'pending';
