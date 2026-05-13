-- Phase 8 hardening: listing/payment state-changing writes must stay behind RPCs.
-- Admin UI and route handlers may call RPCs, but authenticated clients must not
-- mutate these tables directly through PostgREST/table DML.

do $$
declare
  v_table text;
  v_privilege text;
begin
  foreach v_table in array array[
    'public.listings',
    'public.listing_images',
    'public.listing_main_item_options',
    'public.listing_service_options',
    'public.payment_events'
  ]
  loop
    foreach v_privilege in array array['INSERT', 'UPDATE', 'DELETE']
    loop
      if has_table_privilege('authenticated', v_table, v_privilege) then
        raise exception
          'authenticated must not have direct % privilege on %; use admin/workflow RPC boundaries',
          v_privilege,
          v_table;
      end if;
    end loop;
  end loop;
end;
$$;

do $$
declare
  v_signature text;
  v_is_definer boolean;
begin
  foreach v_signature in array array[
    'public.admin_create_listing(jsonb)',
    'public.admin_update_listing(uuid, jsonb)',
    'public.admin_set_listing_status(uuid, public.listing_status)',
    'public.admin_add_listing_image(uuid, text, text, boolean)',
    'public.admin_reorder_listing_images(uuid, jsonb)',
    'public.admin_delete_listing_image(uuid, uuid)',
    'public.admin_configure_listing_main_item(uuid, text, jsonb)',
    'public.admin_configure_listing_service(uuid, text, jsonb)'
  ]
  loop
    select p.prosecdef
    into v_is_definer
    from pg_proc p
    where p.oid = v_signature::regprocedure;

    if v_is_definer is not true then
      raise exception '% must be SECURITY DEFINER so RPCs do not depend on direct table DML grants', v_signature;
    end if;
  end loop;
end;
$$;

do $$
declare
  v_failure text;
begin
  with rpc_owned_tables(table_name) as (
    values
      ('listings'),
      ('listing_images'),
      ('listing_main_item_options'),
      ('listing_service_options'),
      ('payment_events')
  ),
  function_defs as (
    select
      n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as signature,
      p.prosecdef,
      lower(pg_get_functiondef(p.oid)) as definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'internal')
      and p.prokind = 'f'
  ),
  unsafe as (
    select
      f.signature,
      'public.' || t.table_name as table_name
    from function_defs f
    join rpc_owned_tables t on
      f.definition like '%insert into public.' || t.table_name || '%'
      or f.definition like '%update public.' || t.table_name || '%'
      or f.definition like '%delete from public.' || t.table_name || '%'
    where f.prosecdef is not true
  )
  select string_agg(signature || ' writes ' || table_name, '; ' order by signature, table_name)
  into v_failure
  from unsafe;

  if v_failure is not null then
    raise exception
      'RPC-owned write functions must be SECURITY DEFINER after direct DML revocation: %',
      v_failure;
  end if;
end;
$$;

select 'phase8_admin_listing_write_surface_ok' as result;
