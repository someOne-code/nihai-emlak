-- Supabase security advisor hardening:
-- - Fix role-mutable search_path on trigger/helper functions.
-- - Keep dblink out of the exposed public schema.

alter function public.set_profiles_updated_at()
  set search_path = '';

alter function public.set_row_updated_at()
  set search_path = '';

alter function public.validate_order_item_service()
  set search_path = '';

create schema if not exists extensions;

do $$
begin
  if exists (
    select 1
    from pg_extension
    where extname = 'dblink'
  ) then
    execute 'alter extension dblink set schema extensions';
  elsif exists (
    select 1
    from pg_available_extensions
    where name = 'dblink'
  ) then
    execute 'create extension dblink with schema extensions';
  end if;
end;
$$;
