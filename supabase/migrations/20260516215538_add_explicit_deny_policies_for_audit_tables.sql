-- Supabase security advisor: close RLS Enabled No Policy warnings without
-- opening any direct client-facing table access.

alter table public.admin_workflow_events enable row level security;
alter table public.payment_callback_receipts enable row level security;
alter table public.payment_events enable row level security;

drop policy if exists "deny client access to admin workflow events"
on public.admin_workflow_events;
create policy "deny client access to admin workflow events"
on public.admin_workflow_events
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "deny client access to payment callback receipts"
on public.payment_callback_receipts;
create policy "deny client access to payment callback receipts"
on public.payment_callback_receipts
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "deny client access to payment events"
on public.payment_events;
create policy "deny client access to payment events"
on public.payment_events
for all
to anon, authenticated
using (false)
with check (false);
