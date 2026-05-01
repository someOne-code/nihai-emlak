-- Phase 7.1: Chatwoot conversation mapping contract

do $$
begin
  create type public.chatwoot_conversation_status as enum (
    'provisioning',
    'ready',
    'failed'
  );
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.chatwoot_conversations (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete restrict,
  chatwoot_source_id text,
  chatwoot_conversation_id text,
  status public.chatwoot_conversation_status not null default 'provisioning',
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chatwoot_conversations_user_listing_key unique (user_id, listing_id),
  constraint chatwoot_conversations_ready_requires_external_ids check (
    status <> 'ready'
    or (
      nullif(btrim(chatwoot_source_id), '') is not null
      and nullif(btrim(chatwoot_conversation_id), '') is not null
    )
  ),
  constraint chatwoot_conversations_failure_reason_bounded check (
    failure_reason is null or char_length(failure_reason) <= 200
  )
);

create index if not exists chatwoot_conversations_listing_lookup_idx
  on public.chatwoot_conversations (listing_id, status, updated_at desc);

create index if not exists chatwoot_conversations_user_lookup_idx
  on public.chatwoot_conversations (user_id, status, updated_at desc);

drop trigger if exists trg_chatwoot_conversations_set_updated_at on public.chatwoot_conversations;
create trigger trg_chatwoot_conversations_set_updated_at
before update on public.chatwoot_conversations
for each row
execute function public.set_row_updated_at();

alter table public.chatwoot_conversations enable row level security;

revoke all on public.chatwoot_conversations from anon, authenticated;
grant select on public.chatwoot_conversations to authenticated;

drop policy if exists chatwoot_conversations_select_own_or_admin on public.chatwoot_conversations;
create policy chatwoot_conversations_select_own_or_admin
on public.chatwoot_conversations
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create or replace function public.claim_chatwoot_conversation(p_listing_id uuid)
returns table (
  result text,
  conversation_id uuid,
  listing_id uuid,
  status public.chatwoot_conversation_status,
  chatwoot_source_id text,
  chatwoot_conversation_id text,
  failure_reason text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_mapping public.chatwoot_conversations%rowtype;
begin
  if v_user_id is null then
    raise exception 'authenticated user is required' using errcode = '28000';
  end if;

  perform 1
  from public.listings l
  where l.id = p_listing_id
    and l.status = 'active';

  if not found then
    raise exception 'listing is not available for chat' using errcode = '22023';
  end if;

  insert into public.chatwoot_conversations (user_id, listing_id, status)
  values (v_user_id, p_listing_id, 'provisioning')
  on conflict on constraint chatwoot_conversations_user_listing_key do nothing
  returning * into v_mapping;

  if v_mapping.id is null then
    select *
    into v_mapping
    from public.chatwoot_conversations c
    where c.user_id = v_user_id
      and c.listing_id = p_listing_id
    for update;

    if not found then
      raise exception 'chatwoot conversation claim invariant violated' using errcode = 'P0004';
    end if;
  else
    return query
    select
      'claimed'::text,
      v_mapping.id,
      v_mapping.listing_id,
      v_mapping.status,
      v_mapping.chatwoot_source_id,
      v_mapping.chatwoot_conversation_id,
      v_mapping.failure_reason;
    return;
  end if;

  if v_mapping.status = 'ready' then
    return query
    select
      'ready'::text,
      v_mapping.id,
      v_mapping.listing_id,
      v_mapping.status,
      v_mapping.chatwoot_source_id,
      v_mapping.chatwoot_conversation_id,
      v_mapping.failure_reason;
    return;
  end if;

  if v_mapping.status = 'provisioning'
    and v_mapping.updated_at > now() - interval '5 minutes'
  then
    return query
    select
      'in_progress'::text,
      v_mapping.id,
      v_mapping.listing_id,
      v_mapping.status,
      v_mapping.chatwoot_source_id,
      v_mapping.chatwoot_conversation_id,
      v_mapping.failure_reason;
    return;
  end if;

  update public.chatwoot_conversations
  set
    status = 'provisioning',
    chatwoot_source_id = null,
    chatwoot_conversation_id = null,
    failure_reason = null
  where id = v_mapping.id
  returning * into v_mapping;

  return query
  select
    'claimed'::text,
    v_mapping.id,
    v_mapping.listing_id,
    v_mapping.status,
    v_mapping.chatwoot_source_id,
    v_mapping.chatwoot_conversation_id,
    v_mapping.failure_reason;
end;
$$;

create or replace function public.complete_chatwoot_conversation_claim(
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
  chatwoot_conversation_id text,
  failure_reason text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_mapping public.chatwoot_conversations%rowtype;
  v_source_id text := nullif(btrim(p_chatwoot_source_id), '');
  v_conversation_id text := nullif(btrim(p_chatwoot_conversation_id), '');
begin
  if v_user_id is null then
    raise exception 'authenticated user is required' using errcode = '28000';
  end if;

  if v_source_id is null or v_conversation_id is null then
    raise exception 'chatwoot identifiers are required' using errcode = '22023';
  end if;

  update public.chatwoot_conversations as c
  set
    status = 'ready',
    chatwoot_source_id = v_source_id,
    chatwoot_conversation_id = v_conversation_id,
    failure_reason = null
  where c.id = p_mapping_id
    and c.user_id = v_user_id
    and c.status = 'provisioning'
  returning * into v_mapping;

  if not found then
    raise exception 'chatwoot conversation claim not found' using errcode = '42501';
  end if;

  return query
  select
    'ready'::text,
    v_mapping.id,
    v_mapping.listing_id,
    v_mapping.status,
    v_mapping.chatwoot_source_id,
    v_mapping.chatwoot_conversation_id,
    v_mapping.failure_reason;
end;
$$;

create or replace function public.mark_chatwoot_conversation_claim_failed(
  p_mapping_id uuid,
  p_failure_reason text
)
returns table (
  result text,
  conversation_id uuid,
  listing_id uuid,
  status public.chatwoot_conversation_status,
  chatwoot_source_id text,
  chatwoot_conversation_id text,
  failure_reason text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_mapping public.chatwoot_conversations%rowtype;
  v_failure_reason text := left(coalesce(nullif(btrim(p_failure_reason), ''), 'Chatwoot provisioning failed'), 200);
begin
  if v_user_id is null then
    raise exception 'authenticated user is required' using errcode = '28000';
  end if;

  update public.chatwoot_conversations as c
  set
    status = 'failed',
    failure_reason = v_failure_reason
  where c.id = p_mapping_id
    and c.user_id = v_user_id
    and c.status = 'provisioning'
  returning * into v_mapping;

  if not found then
    raise exception 'chatwoot conversation claim not found' using errcode = '42501';
  end if;

  return query
  select
    'failed'::text,
    v_mapping.id,
    v_mapping.listing_id,
    v_mapping.status,
    v_mapping.chatwoot_source_id,
    v_mapping.chatwoot_conversation_id,
    v_mapping.failure_reason;
end;
$$;

revoke all on function public.claim_chatwoot_conversation(uuid) from public;
grant execute on function public.claim_chatwoot_conversation(uuid) to authenticated;

revoke all on function public.complete_chatwoot_conversation_claim(uuid, text, text) from public;
grant execute on function public.complete_chatwoot_conversation_claim(uuid, text, text) to authenticated;

revoke all on function public.mark_chatwoot_conversation_claim_failed(uuid, text) from public;
grant execute on function public.mark_chatwoot_conversation_claim_failed(uuid, text) to authenticated;
