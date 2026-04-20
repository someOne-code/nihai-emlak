-- Phase 3 / Task 2: configurable main checkout item catalog and listing options

create table if not exists public.main_item_catalog (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  label text not null,
  description text,
  pricing_strategy text not null default 'fixed',
  default_amount numeric(12, 2),
  default_multiplier numeric(12, 4),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint main_item_catalog_pricing_strategy_check check (
    pricing_strategy in ('fixed', 'listing_price_multiplier', 'stay_months_multiplier')
  ),
  constraint main_item_catalog_default_amount_non_negative check (
    default_amount is null or default_amount >= 0
  ),
  constraint main_item_catalog_default_multiplier_non_negative check (
    default_multiplier is null or default_multiplier >= 0
  ),
  constraint main_item_catalog_pricing_config_required check (
    (pricing_strategy = 'fixed' and default_amount is not null)
    or (
      pricing_strategy in ('listing_price_multiplier', 'stay_months_multiplier')
      and default_multiplier is not null
    )
  ),
  constraint main_item_catalog_code_normalized check (
    code = lower(btrim(code))
    and code <> ''
    and char_length(code) <= 64
    and code ~ '^[a-z0-9][a-z0-9_-]*$'
  )
);

create table if not exists public.listing_main_item_options (
  id uuid primary key default extensions.gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  main_item_id uuid not null references public.main_item_catalog(id) on delete cascade,
  override_label text,
  override_amount numeric(12, 2),
  override_multiplier numeric(12, 4),
  is_enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listing_main_item_options_listing_item_key unique (listing_id, main_item_id),
  constraint listing_main_item_options_override_amount_non_negative check (
    override_amount is null or override_amount >= 0
  ),
  constraint listing_main_item_options_override_multiplier_non_negative check (
    override_multiplier is null or override_multiplier >= 0
  )
);

create index if not exists main_item_catalog_public_lookup_idx
  on public.main_item_catalog (is_active, sort_order, code);

create index if not exists listing_main_item_options_listing_lookup_idx
  on public.listing_main_item_options (listing_id, is_enabled, sort_order);

create index if not exists listing_main_item_options_main_item_lookup_idx
  on public.listing_main_item_options (main_item_id);

drop trigger if exists trg_main_item_catalog_set_updated_at on public.main_item_catalog;
create trigger trg_main_item_catalog_set_updated_at
before update on public.main_item_catalog
for each row
execute function public.set_row_updated_at();

drop trigger if exists trg_listing_main_item_options_set_updated_at on public.listing_main_item_options;
create trigger trg_listing_main_item_options_set_updated_at
before update on public.listing_main_item_options
for each row
execute function public.set_row_updated_at();

grant select on public.main_item_catalog to anon, authenticated;
grant select on public.listing_main_item_options to anon, authenticated;

grant insert, update, delete on public.main_item_catalog to authenticated;
grant insert, update, delete on public.listing_main_item_options to authenticated;

alter table public.main_item_catalog enable row level security;
alter table public.listing_main_item_options enable row level security;

drop policy if exists main_item_catalog_public_read_active on public.main_item_catalog;
create policy main_item_catalog_public_read_active
on public.main_item_catalog
for select
to anon, authenticated
using (is_active = true);

drop policy if exists main_item_catalog_admin_manage on public.main_item_catalog;
create policy main_item_catalog_admin_manage
on public.main_item_catalog
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists listing_main_item_options_public_read_active on public.listing_main_item_options;
create policy listing_main_item_options_public_read_active
on public.listing_main_item_options
for select
to anon, authenticated
using (
  is_enabled = true
  and exists (
    select 1
    from public.listings l
    where l.id = listing_main_item_options.listing_id
      and l.status = 'active'
  )
  and exists (
    select 1
    from public.main_item_catalog mic
    where mic.id = listing_main_item_options.main_item_id
      and mic.is_active = true
  )
);

drop policy if exists listing_main_item_options_admin_manage on public.listing_main_item_options;
create policy listing_main_item_options_admin_manage
on public.listing_main_item_options
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
