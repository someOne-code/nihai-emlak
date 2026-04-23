-- Launch hardening: remove direct client-side UPDATE paths on transactional tables.
-- Transactional state changes must flow through authoritative DB functions/routes,
-- not ad hoc admin PostgREST updates that bypass invariants and audit semantics.

revoke update on public.reservations from authenticated;
revoke update on public.orders from authenticated;
revoke update on public.payments from authenticated;

drop policy if exists reservations_update_admin on public.reservations;
drop policy if exists orders_update_admin on public.orders;
drop policy if exists payments_update_admin on public.payments;
