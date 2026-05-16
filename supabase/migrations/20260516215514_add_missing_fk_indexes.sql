-- Add covering indexes for foreign key columns reported by the Supabase
-- performance advisor. Existing composite indexes that do not start with the
-- FK column are not sufficient for parent-row update/delete checks.

create index if not exists admin_workflow_events_admin_user_id_idx
  on public.admin_workflow_events (admin_user_id);

create index if not exists admin_workflow_events_order_id_idx
  on public.admin_workflow_events (order_id);

create index if not exists admin_workflow_events_payment_id_idx
  on public.admin_workflow_events (payment_id);

create index if not exists listing_service_options_service_id_idx
  on public.listing_service_options (service_id);

create index if not exists order_items_listing_id_idx
  on public.order_items (listing_id);

create index if not exists order_items_service_catalog_id_idx
  on public.order_items (service_catalog_id);

create index if not exists payment_finance_ops_last_admin_user_id_idx
  on public.payment_finance_ops (last_admin_user_id);

create index if not exists payment_finance_ops_order_id_idx
  on public.payment_finance_ops (order_id);

create index if not exists reservation_document_tracking_last_admin_user_id_idx
  on public.reservation_document_tracking (last_admin_user_id);

create index if not exists reservation_document_tracking_order_id_idx
  on public.reservation_document_tracking (order_id);

create index if not exists sale_lead_events_actor_user_id_idx
  on public.sale_lead_events (actor_user_id);

create index if not exists sale_leads_chatwoot_conversation_id_idx
  on public.sale_leads (chatwoot_conversation_id);
