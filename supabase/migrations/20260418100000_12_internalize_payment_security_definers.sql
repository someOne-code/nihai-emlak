-- Phase 1 / Task 8 hardening:
-- Move critical payment SECURITY DEFINER functions into internal schema and keep thin public wrappers.

create schema if not exists internal;

revoke all on schema internal from public;
revoke usage on schema internal from anon, authenticated;
grant usage on schema internal to service_role;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'register_payment_callback_receipt'
      and pg_get_function_identity_arguments(p.oid) = 'p_provider text, p_event_key text, p_payload_hash text, p_content_type text'
  ) then
    alter function public.register_payment_callback_receipt(text, text, text, text)
      set schema internal;
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'process_payment_checkout'
      and pg_get_function_identity_arguments(p.oid) = 'p_payment_id uuid, p_event_type text, p_provider_ref text, p_event_payload jsonb'
  ) then
    alter function public.process_payment_checkout(uuid, text, text, jsonb)
      set schema internal;
  end if;
end;
$$;

create or replace function public.register_payment_callback_receipt(
  p_provider text,
  p_event_key text,
  p_payload_hash text,
  p_content_type text
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select internal.register_payment_callback_receipt(
    p_provider,
    p_event_key,
    p_payload_hash,
    p_content_type
  );
$$;

create or replace function public.process_payment_checkout(
  p_payment_id uuid,
  p_event_type text default 'payment_callback',
  p_provider_ref text default null,
  p_event_payload jsonb default '{}'::jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select internal.process_payment_checkout(
    p_payment_id,
    p_event_type,
    p_provider_ref,
    p_event_payload
  );
$$;

revoke all on function internal.register_payment_callback_receipt(text, text, text, text)
from public;
grant execute on function internal.register_payment_callback_receipt(text, text, text, text)
to service_role;

revoke all on function internal.process_payment_checkout(uuid, text, text, jsonb)
from public;
grant execute on function internal.process_payment_checkout(uuid, text, text, jsonb)
to service_role;

revoke all on function public.register_payment_callback_receipt(text, text, text, text)
from public;
revoke execute on function public.register_payment_callback_receipt(text, text, text, text)
from anon, authenticated;
grant execute on function public.register_payment_callback_receipt(text, text, text, text)
to service_role;

revoke all on function public.process_payment_checkout(uuid, text, text, jsonb)
from public;
grant execute on function public.process_payment_checkout(uuid, text, text, jsonb)
to service_role;
