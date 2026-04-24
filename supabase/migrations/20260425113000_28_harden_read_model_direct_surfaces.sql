-- Phase 5 security hardening:
-- audit/event tables are storage tables. Client-facing reads must go through
-- sanitized RPC/snapshot surfaces that enforce their own admin checks.

revoke select on public.payment_events from public;
revoke select on public.payment_events from anon;
revoke select on public.payment_events from authenticated;
drop policy if exists payment_events_select_admin on public.payment_events;

revoke select on public.admin_workflow_events from public;
revoke select on public.admin_workflow_events from anon;
revoke select on public.admin_workflow_events from authenticated;
drop policy if exists admin_workflow_events_select_admin on public.admin_workflow_events;

-- Existing environments may already have earlier migrations applied. Keep the
-- sanitized read RPCs consistent with the edited baseline migrations.
alter function public.calculate_checkout_quote(uuid, text[], text[], integer)
  security definer;

alter function public.get_admin_reservation_workflow_snapshot(uuid)
  security definer;
alter function public.get_admin_listing_workflow_snapshot(uuid)
  security definer;

alter function public.list_public_listings(public.listing_type, text, integer, integer)
  security definer;
alter function public.get_public_listing_detail(uuid)
  security definer;
alter function public.list_public_listing_services(uuid)
  security definer;
alter function public.list_admin_payment_events(uuid, integer, integer)
  security definer;
