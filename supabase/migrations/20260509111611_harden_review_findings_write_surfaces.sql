-- Harden write surfaces introduced during the checkout/admin review branch.
-- Keep user-visible state changes behind authoritative RPCs/routes, and keep
-- trusted Chatwoot provider completion behind service-role orchestration.

revoke execute on function public.complete_chatwoot_conversation_claim(uuid, text, text)
from authenticated;

revoke execute on function public.mark_chatwoot_conversation_claim_failed(uuid, text)
from authenticated;

revoke insert on public.sale_leads from authenticated;

create or replace function internal.create_sale_lead(
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
security definer
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
language sql
security definer
set search_path = ''
as $$
  select *
  from internal.create_sale_lead(
    p_listing_id,
    p_contact_name,
    p_contact_email,
    p_contact_phone,
    p_message
  );
$$;

revoke all on function internal.create_sale_lead(uuid, text, text, text, text)
from public;

revoke all on function public.create_sale_lead(uuid, text, text, text, text)
from public;

revoke execute on function public.create_sale_lead(uuid, text, text, text, text)
from anon;

grant execute on function public.create_sale_lead(uuid, text, text, text, text)
to authenticated;

alter table public.sale_leads
drop constraint if exists sale_leads_contact_email_format;

alter table public.sale_leads
add constraint sale_leads_contact_email_format
check (
  contact_email is null
  or contact_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
);
