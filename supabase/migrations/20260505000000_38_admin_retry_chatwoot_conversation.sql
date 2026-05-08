-- Phase D: admin-only RPC to retry a failed Chatwoot conversation mapping.
--
-- Unlike claim_chatwoot_conversation() which operates on the currently
-- authenticated user, this RPC resets a specific failed mapping back to
-- provisioning so the mapping owner's next claim/provisioning attempt can
-- retry. Only admins can execute it and the action is audited.

create or replace function internal.admin_retry_chatwoot_conversation(
  p_conversation_id uuid
)
returns table (
  result text,
  conversation_id uuid,
  listing_id uuid,
  user_id uuid,
  status public.chatwoot_conversation_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_user_id uuid;
  v_mapping public.chatwoot_conversations%rowtype;
begin
  v_admin_user_id := auth.uid();

  if v_admin_user_id is null then
    raise exception 'authenticated admin is required' using errcode = '28000';
  end if;

  if not (select public.is_admin()) then
    raise exception 'admin role is required' using errcode = '42501';
  end if;

  if p_conversation_id is null then
    raise exception 'p_conversation_id is required' using errcode = '22023';
  end if;

  select *
  into v_mapping
  from public.chatwoot_conversations
  where id = p_conversation_id
  for update;

  if not found then
    raise exception 'chatwoot conversation mapping not found: %', p_conversation_id
      using errcode = 'P0002';
  end if;

  if v_mapping.status <> 'failed' then
    raise exception 'chatwoot conversation mapping is not in failed state: %', v_mapping.status
      using errcode = '22023';
  end if;

  update public.chatwoot_conversations
  set
    status = 'provisioning',
    chatwoot_source_id = null,
    chatwoot_conversation_id = null,
    failure_reason = null
  where id = v_mapping.id
  returning * into v_mapping;

  perform internal.log_admin_workflow_event(
    p_workflow_name => 'admin_retry_chatwoot_conversation',
    p_admin_user_id => v_admin_user_id,
    p_listing_id => v_mapping.listing_id,
    p_payload => jsonb_build_object(
      'conversation_mapping_id', v_mapping.id,
      'target_user_id', v_mapping.user_id
    )
  );

  return query
  select
    'retry_started'::text,
    v_mapping.id,
    v_mapping.listing_id,
    v_mapping.user_id,
    v_mapping.status;
end;
$$;

-- Public wrapper so Supabase client can call it via rpc(). The wrapper
-- delegates to the internal function (which enforces auth + admin role).
-- Must be SECURITY DEFINER so authenticated callers (which lack USAGE on
-- the `internal` schema) can dispatch to the internal SECURITY DEFINER
-- function. auth.uid() still resolves to the request JWT subject, so the
-- internal function's admin guard remains effective.
create or replace function public.admin_retry_chatwoot_conversation(
  p_conversation_id uuid
)
returns table (
  result text,
  conversation_id uuid,
  listing_id uuid,
  user_id uuid,
  status public.chatwoot_conversation_status
)
language sql
security definer
set search_path = ''
as $$
  select * from internal.admin_retry_chatwoot_conversation(p_conversation_id);
$$;

revoke all on function internal.admin_retry_chatwoot_conversation(uuid) from public;

revoke all on function public.admin_retry_chatwoot_conversation(uuid) from public;
revoke execute on function public.admin_retry_chatwoot_conversation(uuid) from anon;
grant execute on function public.admin_retry_chatwoot_conversation(uuid) to authenticated;
