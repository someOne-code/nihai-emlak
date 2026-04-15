-- Phase 1 / Task 5: Admin access model — UPDATE policies for transactional tables
-- + admin INSERT on payment_events (audit log)
-- + GRANT UPDATE on transactional tables to authenticated

-- ============================================================
-- 1. GRANTS — admin needs UPDATE permission on transactional tables
-- ============================================================
grant update on public.reservations to authenticated;
grant update on public.orders to authenticated;
grant update on public.payments to authenticated;

-- admin needs INSERT on payment_events for manual audit entries
grant insert on public.payment_events to authenticated;

-- ============================================================
-- 2. RLS UPDATE policies — admin-only updates on transactional tables
-- ============================================================

-- reservations: only admin can update (e.g. cancel, confirm)
drop policy if exists reservations_update_admin on public.reservations;
create policy reservations_update_admin
on public.reservations
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- orders: only admin can update (e.g. mark completed, failed)
drop policy if exists orders_update_admin on public.orders;
create policy orders_update_admin
on public.orders
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- payments: only admin can update (e.g. mark succeeded, refunded)
drop policy if exists payments_update_admin on public.payments;
create policy payments_update_admin
on public.payments
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- ============================================================
-- 3. RLS INSERT policy — admin-only insert on payment_events
-- ============================================================
drop policy if exists payment_events_insert_admin on public.payment_events;
create policy payment_events_insert_admin
on public.payment_events
for insert
to authenticated
with check ((select public.is_admin()));
