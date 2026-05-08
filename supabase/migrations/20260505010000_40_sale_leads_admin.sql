-- Phase E: Sale leads admin workflow.
--
-- Sale listings do not enter checkout. Interested users create sale_leads
-- through a user-context RPC; admins read all leads and transition status
-- through an audited admin RPC.

do $$
begin
  create type public.sale_lead_status as enum (
    'new',
    'called',
    'meeting_planned',
    'not_interested',
    'closed'
  );
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.sale_leads (
  id uuid primary key default extensions.gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  chatwoot_conversation_id uuid null references public.chatwoot_conversations(id) on delete set null,
  contact_name text not null,
  contact_email text null,
  contact_phone text null,
  message text not null,
  status public.sale_lead_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sale_leads_contact_name_length check (char_length(btrim(contact_name)) between 2 and 120),
  constraint sale_leads_contact_email_length check (contact_email is null or char_length(contact_email) <= 254),
  constraint sale_leads_contact_phone_length check (contact_phone is null or char_length(contact_phone) <= 40),
  constraint sale_leads_message_length check (char_length(btrim(message)) between 5 and 2000)
);

create table if not exists public.sale_lead_events (
  id bigint generated always as identity primary key,
  lead_id uuid not null references public.sale_leads(id) on delete cascade,
  actor_user_id uuid null references public.profiles(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint sale_lead_events_type_length check (char_length(btrim(event_type)) between 2 and 80)
);

create index if not exists sale_leads_owner_lookup_idx
  on public.sale_leads (user_id, updated_at desc);

create index if not exists sale_leads_admin_lookup_idx
  on public.sale_leads (status, updated_at desc);

create index if not exists sale_leads_listing_lookup_idx
  on public.sale_leads (listing_id, updated_at desc);

create index if not exists sale_lead_events_lead_lookup_idx
  on public.sale_lead_events (lead_id, created_at desc);

drop trigger if exists trg_sale_leads_set_updated_at on public.sale_leads;
create trigger trg_sale_leads_set_updated_at
before update on public.sale_leads
for each row
execute function public.set_row_updated_at();

alter table public.sale_leads enable row level security;
alter table public.sale_lead_events enable row level security;

revoke all on public.sale_leads from anon, authenticated;
revoke all on public.sale_lead_events from anon, authenticated;

grant select, insert on public.sale_leads to authenticated;
grant select on public.sale_lead_events to authenticated;

drop policy if exists sale_leads_select_own_or_admin on public.sale_leads;
create policy sale_leads_select_own_or_admin
on public.sale_leads
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists sale_leads_insert_own_sale_listing on public.sale_leads;
create policy sale_leads_insert_own_sale_listing
on public.sale_leads
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.listings as l
    where l.id = listing_id
      and l.type = 'sale'
      and l.status = 'active'
  )
);

drop policy if exists sale_lead_events_select_own_or_admin on public.sale_lead_events;
create policy sale_lead_events_select_own_or_admin
on public.sale_lead_events
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.sale_leads as sl
    where sl.id = lead_id
      and sl.user_id = auth.uid()
  )
);

create or replace function public.create_sale_lead(
  p_listing_id uuid,
  p_contact_name text,
  p_contact_email text default null,
  p_contact_phone text default null,
  p_message text default null
)
returns table (
  result text,
  lead_id uuid,
  listing_id uuid,
  status public.sale_lead_status
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_listing public.listings%rowtype;
  v_lead public.sale_leads%rowtype;
  v_contact_name text := nullif(btrim(p_contact_name), '');
  v_contact_email text := lower(nullif(btrim(p_contact_email), ''));
  v_contact_phone text := nullif(btrim(p_contact_phone), '');
  v_message text := nullif(btrim(p_message), '');
begin
  if v_user_id is null then
    raise exception 'authenticated user is required' using errcode = '28000';
  end if;

  if p_listing_id is null then
    raise exception 'p_listing_id is required' using errcode = '22023';
  end if;

  select *
  into v_listing
  from public.listings
  where id = p_listing_id;

  if not found then
    raise exception 'listing not found: %', p_listing_id using errcode = 'P0002';
  end if;

  if v_listing.type <> 'sale' then
    raise exception 'listing is not sale: %', p_listing_id using errcode = 'P0001';
  end if;

  if v_listing.status <> 'active' then
    raise exception 'listing is not active: %', p_listing_id using errcode = '22023';
  end if;

  insert into public.sale_leads (
    listing_id,
    user_id,
    contact_name,
    contact_email,
    contact_phone,
    message
  )
  values (
    p_listing_id,
    v_user_id,
    v_contact_name,
    v_contact_email,
    v_contact_phone,
    v_message
  )
  returning * into v_lead;

  return query
  select
    'created'::text,
    v_lead.id,
    v_lead.listing_id,
    v_lead.status;
end;
$$;

create or replace function internal.admin_update_sale_lead_status(
  p_lead_id uuid,
  p_status public.sale_lead_status,
  p_note text default null
)
returns public.sale_leads
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_user_id uuid := auth.uid();
  v_lead public.sale_leads%rowtype;
  v_previous_status public.sale_lead_status;
  v_note text := nullif(btrim(p_note), '');
begin
  if v_admin_user_id is null then
    raise exception 'authenticated admin is required' using errcode = '28000';
  end if;

  if not (select public.is_admin()) then
    raise exception 'admin role is required' using errcode = '42501';
  end if;

  if p_lead_id is null then
    raise exception 'p_lead_id is required' using errcode = '22023';
  end if;

  if p_status is null then
    raise exception 'p_status is required' using errcode = '22023';
  end if;

  select *
  into v_lead
  from public.sale_leads
  where id = p_lead_id
  for update;

  if not found then
    raise exception 'sale lead not found: %', p_lead_id using errcode = 'P0002';
  end if;

  v_previous_status := v_lead.status;

  update public.sale_leads
  set status = p_status
  where id = v_lead.id
  returning * into v_lead;

  insert into public.sale_lead_events (
    lead_id,
    actor_user_id,
    event_type,
    payload
  )
  values (
    v_lead.id,
    v_admin_user_id,
    'status_change',
    jsonb_build_object(
      'previous_status', v_previous_status,
      'status', v_lead.status,
      'note', v_note
    )
  );

  return v_lead;
end;
$$;

create or replace function public.admin_update_sale_lead_status(
  p_lead_id uuid,
  p_status public.sale_lead_status,
  p_note text default null
)
returns public.sale_leads
language sql
security definer
set search_path = ''
as $$
  select * from internal.admin_update_sale_lead_status(p_lead_id, p_status, p_note);
$$;

revoke all on function public.create_sale_lead(uuid, text, text, text, text) from public;
revoke execute on function public.create_sale_lead(uuid, text, text, text, text) from anon;
grant execute on function public.create_sale_lead(uuid, text, text, text, text) to authenticated;

revoke all on function internal.admin_update_sale_lead_status(uuid, public.sale_lead_status, text) from public;

revoke all on function public.admin_update_sale_lead_status(uuid, public.sale_lead_status, text) from public;
revoke execute on function public.admin_update_sale_lead_status(uuid, public.sale_lead_status, text) from anon;
grant execute on function public.admin_update_sale_lead_status(uuid, public.sale_lead_status, text) to authenticated;
