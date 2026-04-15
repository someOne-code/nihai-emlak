-- Phase 1 / Task 3: public catalog and listing tables with public-read RLS

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table if not exists public.consultants (
  id uuid primary key default extensions.gen_random_uuid(),
  full_name text not null,
  slug text not null unique,
  title text,
  bio text,
  phone text,
  email text,
  photo_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listings (
  id uuid primary key default extensions.gen_random_uuid(),
  type public.listing_type not null,
  status public.listing_status not null default 'active',
  title text not null,
  slug text not null unique,
  summary text,
  description text,
  city text not null,
  district text,
  address_line text,
  price numeric(12, 2) not null,
  currency text not null default 'TRY',
  room_count integer,
  bathroom_count integer,
  gross_area_m2 numeric(10, 2),
  is_furnished boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listings_price_non_negative check (price >= 0),
  constraint listings_currency_code_check check (char_length(currency) = 3),
  constraint listings_room_count_non_negative check (room_count is null or room_count >= 0),
  constraint listings_bathroom_count_non_negative check (bathroom_count is null or bathroom_count >= 0),
  constraint listings_gross_area_non_negative check (gross_area_m2 is null or gross_area_m2 >= 0)
);

create table if not exists public.listing_images (
  id uuid primary key default extensions.gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.service_catalog (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  base_price numeric(12, 2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_catalog_base_price_non_negative check (base_price >= 0)
);

create table if not exists public.listing_service_options (
  id uuid primary key default extensions.gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  service_id uuid not null references public.service_catalog(id) on delete cascade,
  override_price numeric(12, 2),
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint listing_service_options_listing_service_key unique (listing_id, service_id),
  constraint listing_service_options_override_price_non_negative check (
    override_price is null or override_price >= 0
  )
);

create index if not exists consultants_public_lookup_idx
  on public.consultants (is_active, sort_order, created_at desc);

create index if not exists listings_public_lookup_idx
  on public.listings (status, type, city, created_at desc);

create index if not exists listing_images_listing_lookup_idx
  on public.listing_images (listing_id, sort_order, created_at);

create index if not exists service_catalog_public_lookup_idx
  on public.service_catalog (is_active, code);

create index if not exists listing_service_options_listing_lookup_idx
  on public.listing_service_options (listing_id, is_enabled);

drop trigger if exists trg_consultants_set_updated_at on public.consultants;
create trigger trg_consultants_set_updated_at
before update on public.consultants
for each row
execute function public.set_row_updated_at();

drop trigger if exists trg_listings_set_updated_at on public.listings;
create trigger trg_listings_set_updated_at
before update on public.listings
for each row
execute function public.set_row_updated_at();

drop trigger if exists trg_service_catalog_set_updated_at on public.service_catalog;
create trigger trg_service_catalog_set_updated_at
before update on public.service_catalog
for each row
execute function public.set_row_updated_at();

grant select on public.consultants to anon, authenticated;
grant select on public.listings to anon, authenticated;
grant select on public.listing_images to anon, authenticated;
grant select on public.service_catalog to anon, authenticated;
grant select on public.listing_service_options to anon, authenticated;

grant insert, update, delete on public.consultants to authenticated;
grant insert, update, delete on public.listings to authenticated;
grant insert, update, delete on public.listing_images to authenticated;
grant insert, update, delete on public.service_catalog to authenticated;
grant insert, update, delete on public.listing_service_options to authenticated;

alter table public.consultants enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.service_catalog enable row level security;
alter table public.listing_service_options enable row level security;

drop policy if exists consultants_public_read_active on public.consultants;
create policy consultants_public_read_active
on public.consultants
for select
to anon, authenticated
using (is_active = true);

drop policy if exists consultants_admin_manage on public.consultants;
create policy consultants_admin_manage
on public.consultants
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists listings_public_read_active on public.listings;
create policy listings_public_read_active
on public.listings
for select
to anon, authenticated
using (status = 'active');

drop policy if exists listings_admin_manage on public.listings;
create policy listings_admin_manage
on public.listings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists listing_images_public_read_active_listings on public.listing_images;
create policy listing_images_public_read_active_listings
on public.listing_images
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.listings l
    where l.id = listing_images.listing_id
      and l.status = 'active'
  )
);

drop policy if exists listing_images_admin_manage on public.listing_images;
create policy listing_images_admin_manage
on public.listing_images
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists service_catalog_public_read_active on public.service_catalog;
create policy service_catalog_public_read_active
on public.service_catalog
for select
to anon, authenticated
using (is_active = true);

drop policy if exists service_catalog_admin_manage on public.service_catalog;
create policy service_catalog_admin_manage
on public.service_catalog
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists listing_service_options_public_read_active on public.listing_service_options;
create policy listing_service_options_public_read_active
on public.listing_service_options
for select
to anon, authenticated
using (
  is_enabled = true
  and exists (
    select 1
    from public.listings l
    where l.id = listing_service_options.listing_id
      and l.status = 'active'
  )
  and exists (
    select 1
    from public.service_catalog s
    where s.id = listing_service_options.service_id
      and s.is_active = true
  )
);

drop policy if exists listing_service_options_admin_manage on public.listing_service_options;
create policy listing_service_options_admin_manage
on public.listing_service_options
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
