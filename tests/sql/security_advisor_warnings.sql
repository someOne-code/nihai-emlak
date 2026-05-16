\set ON_ERROR_STOP on

-- Supabase security advisor warnings covered by this contract:
-- function_search_path_mutable_public_set_profiles_updated_at_608ef48381668ad5cc300914a52c93f5
-- function_search_path_mutable_public_set_row_updated_at_608ef48381668ad5cc300914a52c93f5
-- function_search_path_mutable_public_validate_order_item_service_55e2a69f6d246745d3c311680be5c1df
-- extension_in_public_dblink

do $$
declare
  v_signature text;
  v_config text;
begin
  foreach v_signature in array array[
    'public.set_profiles_updated_at()',
    'public.set_row_updated_at()',
    'public.validate_order_item_service()'
  ]
  loop
    select config_value
    into v_config
    from pg_proc p
    cross join lateral unnest(coalesce(p.proconfig, array[]::text[])) as config_value
    where p.oid = v_signature::regprocedure
      and config_value like 'search_path=%'
    limit 1;

    if v_config is null then
      raise exception '% must set a fixed search_path', v_signature;
    end if;

    if v_config not in ('search_path=', 'search_path=""') then
      raise exception '% must use empty search_path, got %', v_signature, v_config;
    end if;
  end loop;
end;
$$;

do $$
declare
  v_schema text;
begin
  select n.nspname
  into v_schema
  from pg_extension e
  join pg_namespace n
    on n.oid = e.extnamespace
  where e.extname = 'dblink';

  if v_schema is null then
    raise exception 'dblink extension must be installed in extensions schema';
  end if;

  if v_schema = 'public' then
    raise exception 'dblink extension must not live in public schema';
  end if;

  if v_schema <> 'extensions' then
    raise exception 'dblink extension must live in extensions schema, got %', v_schema;
  end if;
end;
$$;

select 'security_advisor_warnings_ok' as result;
