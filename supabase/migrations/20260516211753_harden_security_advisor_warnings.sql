-- Harden Supabase security advisor warnings:
-- - function_search_path_mutable for trigger/helper functions
-- - extension_in_public for test-installed dblink extension

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.validate_order_item_service()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.item_type <> 'service_item' then
    return new;
  end if;

  if new.listing_id is null then
    raise exception 'service_item requires listing_id for validation';
  end if;

  if not exists (
    select 1
    from public.listing_service_options lso
    where lso.listing_id = new.listing_id
      and lso.service_id = new.service_catalog_id
      and lso.is_enabled = true
  ) then
    raise exception 'Service % is not available for listing %',
      new.service_catalog_id, new.listing_id;
  end if;

  return new;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_extension e
    join pg_namespace n
      on n.oid = e.extnamespace
    where e.extname = 'dblink'
      and n.nspname = 'public'
  ) then
    alter extension dblink set schema extensions;
  end if;
end;
$$;
