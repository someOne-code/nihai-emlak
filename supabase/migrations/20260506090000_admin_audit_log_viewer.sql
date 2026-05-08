-- Backend closure: sanitized admin audit read model.

create or replace function public.list_admin_audit_events(
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_actor_id uuid default null,
  p_action text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_items jsonb;
  v_allowed_entity_types constant text[] := array['reservation', 'order', 'payment', 'listing', 'sale_lead', 'chatwoot_conversation'];
begin
  if auth.uid() is null then
    raise exception 'authenticated admin is required'
      using errcode = '28000';
  end if;

  if not (select public.is_admin()) then
    raise exception 'admin role is required'
      using errcode = '42501';
  end if;

  if p_limit is null or p_offset is null or p_limit < 1 or p_limit > 100 or p_offset < 0 then
    raise exception 'invalid pagination'
      using errcode = '22023';
  end if;

  if p_entity_type is not null and not (lower(p_entity_type) = any(v_allowed_entity_types)) then
    raise exception 'invalid entity type'
      using errcode = '22023';
  end if;

  if p_from is not null and p_to is not null and p_from > p_to then
    raise exception 'invalid audit date range'
      using errcode = '22023';
  end if;

  with audit_rows as (
    select
      e.id::text as id,
      'admin_workflow'::text as source,
      e.workflow_name as action,
      case
        when e.reservation_id is not null then 'reservation'
        when e.order_id is not null then 'order'
        when e.payment_id is not null then 'payment'
        when e.listing_id is not null then 'listing'
        else 'unknown'
      end as entity_type,
      coalesce(e.reservation_id, e.order_id, e.payment_id, e.listing_id) as entity_id,
      'admin'::text as actor_type,
      e.admin_user_id as actor_id,
      coalesce(nullif(btrim(e.reason), ''), nullif(btrim(e.note), ''), e.workflow_name) as summary,
      e.created_at,
      jsonb_strip_nulls(jsonb_build_object(
        'reservation_id', e.reservation_id,
        'order_id', e.order_id,
        'payment_id', e.payment_id,
        'listing_id', e.listing_id
      )) as related_ids
    from public.admin_workflow_events e

    union all

    select
      e.id::text as id,
      'payment_event'::text as source,
      e.event_type as action,
      'payment'::text as entity_type,
      e.payment_id as entity_id,
      'provider'::text as actor_type,
      null::uuid as actor_id,
      concat_ws(' ', e.provider, e.event_type) as summary,
      e.created_at,
      jsonb_build_object('payment_id', e.payment_id) as related_ids
    from public.payment_events e

    union all

    select
      e.id::text as id,
      'sale_lead_event'::text as source,
      e.event_type as action,
      'sale_lead'::text as entity_type,
      e.lead_id as entity_id,
      case when e.actor_user_id is null then 'system' else 'admin' end as actor_type,
      e.actor_user_id as actor_id,
      e.event_type as summary,
      e.created_at,
      jsonb_build_object('lead_id', e.lead_id) as related_ids
    from public.sale_lead_events e
  ),
  filtered_rows as (
    select *
    from audit_rows r
    where (p_entity_type is null or r.entity_type = lower(p_entity_type))
      and (p_entity_id is null or r.entity_id = p_entity_id)
      and (p_actor_id is null or r.actor_id = p_actor_id)
      and (p_action is null or r.action = p_action)
      and (p_from is null or r.created_at >= p_from)
      and (p_to is null or r.created_at <= p_to)
    order by r.created_at desc, r.id desc
    limit p_limit
    offset p_offset
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'source', source,
        'action', action,
        'entity_type', entity_type,
        'entity_id', entity_id,
        'actor_type', actor_type,
        'actor_id', actor_id,
        'summary', summary,
        'created_at', created_at,
        'related_ids', related_ids
      )
      order by created_at desc, id desc
    ),
    '[]'::jsonb
  )
  into v_items
  from filtered_rows;

  return jsonb_build_object(
    'items', v_items,
    'limit', p_limit,
    'offset', p_offset
  );
end;
$$;

revoke all on function public.list_admin_audit_events(text, uuid, uuid, text, timestamptz, timestamptz, integer, integer)
from public;
revoke execute on function public.list_admin_audit_events(text, uuid, uuid, text, timestamptz, timestamptz, integer, integer)
from anon;
grant execute on function public.list_admin_audit_events(text, uuid, uuid, text, timestamptz, timestamptz, integer, integer)
to authenticated;
