-- Phase D: system-side completion/failure helpers for Chatwoot retry workers.
--
-- These RPCs are intended for trusted server-side orchestration only. They let
-- the Inngest worker complete or fail a mapping that an admin retry reset to
-- `provisioning`, while keeping the state transition in database functions.

create or replace function internal.system_complete_chatwoot_conversation_claim(
  p_mapping_id uuid,
  p_chatwoot_source_id text,
  p_chatwoot_conversation_id text
)
returns table (
  result text,
  conversation_id uuid,
  listing_id uuid,
  status public.chatwoot_conversation_status,
  chatwoot_source_id text,
  chatwoot_conversation_id text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mapping public.chatwoot_conversations%rowtype;
begin
  if p_mapping_id is null then
    raise exception 'p_mapping_id is required' using errcode = '22023';
  end if;

  if nullif(btrim(p_chatwoot_source_id), '') is null
    or nullif(btrim(p_chatwoot_conversation_id), '') is null
  then
    raise exception 'chatwoot provider identifiers are required' using errcode = '22023';
  end if;

  update public.chatwoot_conversations as c
  set
    status = 'ready',
    chatwoot_source_id = btrim(p_chatwoot_source_id),
    chatwoot_conversation_id = btrim(p_chatwoot_conversation_id),
    failure_reason = null
  where c.id = p_mapping_id
    and c.status = 'provisioning'
  returning * into v_mapping;

  if not found then
    raise exception 'chatwoot conversation claim not found' using errcode = 'P0002';
  end if;

  return query
  select
    'ready'::text,
    v_mapping.id,
    v_mapping.listing_id,
    v_mapping.status,
    v_mapping.chatwoot_source_id,
    v_mapping.chatwoot_conversation_id;
end;
$$;

create or replace function public.system_complete_chatwoot_conversation_claim(
  p_mapping_id uuid,
  p_chatwoot_source_id text,
  p_chatwoot_conversation_id text
)
returns table (
  result text,
  conversation_id uuid,
  listing_id uuid,
  status public.chatwoot_conversation_status,
  chatwoot_source_id text,
  chatwoot_conversation_id text
)
language sql
security definer
set search_path = ''
as $$
  select *
  from internal.system_complete_chatwoot_conversation_claim(
    p_mapping_id,
    p_chatwoot_source_id,
    p_chatwoot_conversation_id
  );
$$;

create or replace function internal.system_mark_chatwoot_conversation_claim_failed(
  p_mapping_id uuid,
  p_failure_reason text
)
returns table (
  result text,
  conversation_id uuid,
  listing_id uuid,
  status public.chatwoot_conversation_status,
  failure_reason text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mapping public.chatwoot_conversations%rowtype;
  v_failure_reason text := left(
    coalesce(nullif(btrim(p_failure_reason), ''), 'Chatwoot provisioning failed'),
    200
  );
begin
  if p_mapping_id is null then
    raise exception 'p_mapping_id is required' using errcode = '22023';
  end if;

  update public.chatwoot_conversations as c
  set
    status = 'failed',
    failure_reason = v_failure_reason
  where c.id = p_mapping_id
    and c.status = 'provisioning'
  returning * into v_mapping;

  if not found then
    raise exception 'chatwoot conversation claim not found' using errcode = 'P0002';
  end if;

  return query
  select
    'failed'::text,
    v_mapping.id,
    v_mapping.listing_id,
    v_mapping.status,
    v_mapping.failure_reason;
end;
$$;

create or replace function public.system_mark_chatwoot_conversation_claim_failed(
  p_mapping_id uuid,
  p_failure_reason text
)
returns table (
  result text,
  conversation_id uuid,
  listing_id uuid,
  status public.chatwoot_conversation_status,
  failure_reason text
)
language sql
security definer
set search_path = ''
as $$
  select *
  from internal.system_mark_chatwoot_conversation_claim_failed(
    p_mapping_id,
    p_failure_reason
  );
$$;

revoke all on function internal.system_complete_chatwoot_conversation_claim(uuid, text, text) from public;
revoke all on function internal.system_mark_chatwoot_conversation_claim_failed(uuid, text) from public;

revoke all on function public.system_complete_chatwoot_conversation_claim(uuid, text, text) from public;
revoke all on function public.system_mark_chatwoot_conversation_claim_failed(uuid, text) from public;
revoke execute on function public.system_complete_chatwoot_conversation_claim(uuid, text, text) from anon, authenticated;
revoke execute on function public.system_mark_chatwoot_conversation_claim_failed(uuid, text) from anon, authenticated;
grant execute on function public.system_complete_chatwoot_conversation_claim(uuid, text, text) to service_role;
grant execute on function public.system_mark_chatwoot_conversation_claim_failed(uuid, text) to service_role;
