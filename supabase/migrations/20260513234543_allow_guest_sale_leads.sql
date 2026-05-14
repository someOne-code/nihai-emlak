-- Allow public sale listing contact requests from guest users.
--
-- POST /api/sale-leads remains a thin JSON/origin/body boundary. The database
-- RPC stays authoritative for listing eligibility, normalization, and writes.

alter table public.sale_leads
  alter column user_id drop not null;

alter table public.sale_leads
  drop constraint if exists sale_leads_contact_channel_required;

alter table public.sale_leads
  add constraint sale_leads_contact_channel_required
  check (
    nullif(btrim(coalesce(contact_email, '')), '') is not null
    or nullif(btrim(coalesce(contact_phone, '')), '') is not null
  );

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

-- Intentional exposed-schema facade: public clients can execute this narrow
-- RPC, while the privileged implementation and all write checks stay in
-- internal.create_sale_lead.
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

revoke all on public.sale_leads from anon;
revoke insert, update, delete on public.sale_leads from authenticated;

revoke all on function internal.create_sale_lead(uuid, text, text, text, text)
from public;

revoke all on function public.create_sale_lead(uuid, text, text, text, text)
from public;

grant execute on function public.create_sale_lead(uuid, text, text, text, text)
to anon, authenticated;
