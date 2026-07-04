\set ON_ERROR_STOP on

-- Security advisor contract for warnings surfaced by Supabase.
-- Mirrors function_search_path_mutable and extension_in_public checks.

do $$
declare
  v_function regprocedure;
  v_config text[];
begin
  foreach v_function in array array[
    'public.set_profiles_updated_at()'::regprocedure,
    'public.set_row_updated_at()'::regprocedure,
    'public.validate_order_item_service()'::regprocedure
  ]
  loop
    select p.proconfig
    into v_config
    from pg_proc p
    where p.oid = v_function;

    if v_config is null or not (v_config @> array['search_path=""']) then
      raise exception 'Function % must set search_path to empty string', v_function;
    end if;
  end loop;
end;
$$;

do $$
declare
  v_dblink_schema text;
begin
  select n.nspname
  into v_dblink_schema
  from pg_extension e
  join pg_namespace n
    on n.oid = e.extnamespace
  where e.extname = 'dblink';

  if v_dblink_schema = 'public' then
    raise exception 'Extension dblink must not be installed in public schema';
  end if;

  if v_dblink_schema is not null and v_dblink_schema <> 'extensions' then
    raise exception 'Extension dblink must be installed in extensions schema, got %', v_dblink_schema;
  end if;
end;
$$;

select 'security_advisor_warnings_ok' as result;
