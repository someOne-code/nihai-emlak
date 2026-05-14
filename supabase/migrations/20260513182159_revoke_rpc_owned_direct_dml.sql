-- Phase 8 hardening: listing/config/payment audit state changes are RPC-owned.
-- Authenticated users, including admins, must not be able to mutate these tables
-- directly via PostgREST/table DML and bypass route/RPC validation.

revoke insert, update, delete on public.listings from authenticated;
revoke insert, update, delete on public.listing_images from authenticated;
revoke insert, update, delete on public.listing_main_item_options from authenticated;
revoke insert, update, delete on public.listing_service_options from authenticated;
revoke insert, update, delete on public.payment_events from authenticated;

drop policy if exists payment_events_insert_admin on public.payment_events;

alter function public.admin_create_listing(jsonb) security definer;
alter function public.admin_update_listing(uuid, jsonb) security definer;
alter function public.admin_set_listing_status(uuid, public.listing_status) security definer;
alter function public.admin_configure_listing_main_item(uuid, text, jsonb) security definer;
alter function public.admin_configure_listing_service(uuid, text, jsonb) security definer;
