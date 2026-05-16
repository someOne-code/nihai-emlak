-- Contract: foreign key columns reported by Supabase performance advisor must
-- have a covering btree index. A composite index is accepted only when the FK
-- column is the first indexed column.

do $$
declare
  v_missing text;
begin
  with target_fk(table_name, constraint_name, column_name) as (
    values
      ('admin_workflow_events', 'admin_workflow_events_admin_user_id_fkey', 'admin_user_id'),
      ('admin_workflow_events', 'admin_workflow_events_order_id_fkey', 'order_id'),
      ('admin_workflow_events', 'admin_workflow_events_payment_id_fkey', 'payment_id'),
      ('listing_service_options', 'listing_service_options_service_id_fkey', 'service_id'),
      ('order_items', 'order_items_listing_id_fkey', 'listing_id'),
      ('order_items', 'order_items_service_catalog_id_fkey', 'service_catalog_id'),
      ('payment_finance_ops', 'payment_finance_ops_last_admin_user_id_fkey', 'last_admin_user_id'),
      ('payment_finance_ops', 'payment_finance_ops_order_id_fkey', 'order_id'),
      ('reservation_document_tracking', 'reservation_document_tracking_last_admin_user_id_fkey', 'last_admin_user_id'),
      ('reservation_document_tracking', 'reservation_document_tracking_order_id_fkey', 'order_id'),
      ('sale_lead_events', 'sale_lead_events_actor_user_id_fkey', 'actor_user_id'),
      ('sale_leads', 'sale_leads_chatwoot_conversation_id_fkey', 'chatwoot_conversation_id')
  ),
  missing_fk as (
    select
      target_fk.table_name,
      target_fk.constraint_name,
      target_fk.column_name
    from target_fk
    join pg_namespace table_schema
      on table_schema.nspname = 'public'
    join pg_class indexed_table
      on indexed_table.relnamespace = table_schema.oid
     and indexed_table.relname = target_fk.table_name
    join pg_attribute fk_column
      on fk_column.attrelid = indexed_table.oid
     and fk_column.attname = target_fk.column_name
    join pg_constraint fk_constraint
      on fk_constraint.conrelid = indexed_table.oid
     and fk_constraint.conname = target_fk.constraint_name
     and fk_constraint.contype = 'f'
    where not exists (
      select 1
      from pg_index index_meta
      join pg_class index_class
        on index_class.oid = index_meta.indexrelid
      join pg_am index_method
        on index_method.oid = index_class.relam
      where index_meta.indrelid = indexed_table.oid
        and index_meta.indisvalid
        and index_meta.indisready
        and index_method.amname = 'btree'
        and index_meta.indkey[0] = fk_column.attnum
    )
  )
  select string_agg(
    format('%I.%I (%I, %s)', 'public', table_name, column_name, constraint_name),
    ', '
    order by table_name, column_name
  )
  into v_missing
  from missing_fk;

  if v_missing is not null then
    raise exception 'Missing covering FK index(es): %', v_missing;
  end if;
end;
$$;
