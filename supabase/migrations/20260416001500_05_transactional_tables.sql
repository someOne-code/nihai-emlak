-- Phase 1 / Task 4: Transactional tables (reservations, orders, order_items, payments, payment_events)
-- + own-data RLS + admin read + CHECK constraints

-- ============================================================
-- 1. order_item_type enum
-- ============================================================
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'order_item_type'
  ) then
    create type public.order_item_type as enum ('main_item', 'service_item');
  end if;
end $$;

-- ============================================================
-- 2. reservations
-- ============================================================
create table if not exists public.reservations (
  id uuid primary key default extensions.gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  move_in_date date not null,
  stay_months integer not null,
  guest_count integer not null default 1,
  note text,
  status public.reservation_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservations_stay_months_range check (stay_months between 1 and 12),
  constraint reservations_guest_count_positive check (guest_count >= 1)
);

create index if not exists reservations_user_lookup_idx
  on public.reservations (user_id, status, created_at desc);

create index if not exists reservations_listing_lookup_idx
  on public.reservations (listing_id, status);

drop trigger if exists trg_reservations_set_updated_at on public.reservations;
create trigger trg_reservations_set_updated_at
before update on public.reservations
for each row
execute function public.set_row_updated_at();

-- ============================================================
-- 3. orders
-- ============================================================
create table if not exists public.orders (
  id uuid primary key default extensions.gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  total_amount numeric(12, 2) not null default 0,
  currency text not null default 'TRY',
  status public.order_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_total_amount_non_negative check (total_amount >= 0),
  constraint orders_currency_code_check check (char_length(currency) = 3)
);

create index if not exists orders_user_lookup_idx
  on public.orders (user_id, status, created_at desc);

create index if not exists orders_reservation_lookup_idx
  on public.orders (reservation_id);

drop trigger if exists trg_orders_set_updated_at on public.orders;
create trigger trg_orders_set_updated_at
before update on public.orders
for each row
execute function public.set_row_updated_at();

-- ============================================================
-- 4. order_items
-- ============================================================
create table if not exists public.order_items (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  item_type public.order_item_type not null,
  label text not null,
  description text,
  amount numeric(12, 2) not null default 0,
  service_catalog_id uuid references public.service_catalog(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint order_items_amount_non_negative check (amount >= 0)
);

create index if not exists order_items_order_lookup_idx
  on public.order_items (order_id, item_type);

-- ============================================================
-- 5. payments
-- ============================================================
create table if not exists public.payments (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12, 2) not null,
  currency text not null default 'TRY',
  status public.payment_status not null default 'pending',
  provider text not null default 'isbank',
  provider_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_amount_non_negative check (amount >= 0),
  constraint payments_currency_code_check check (char_length(currency) = 3)
);

create index if not exists payments_order_lookup_idx
  on public.payments (order_id, status);

create index if not exists payments_user_lookup_idx
  on public.payments (user_id, status, created_at desc);

drop trigger if exists trg_payments_set_updated_at on public.payments;
create trigger trg_payments_set_updated_at
before update on public.payments
for each row
execute function public.set_row_updated_at();

-- ============================================================
-- 6. payment_events (audit trail — AGENTS.md Security rule)
-- ============================================================
create table if not exists public.payment_events (
  id uuid primary key default extensions.gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  event_type text not null,
  provider text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists payment_events_payment_lookup_idx
  on public.payment_events (payment_id, created_at desc);

-- ============================================================
-- 7. GRANTS
-- ============================================================
grant select on public.reservations to authenticated;
grant insert on public.reservations to authenticated;

grant select on public.orders to authenticated;
grant insert on public.orders to authenticated;

grant select on public.order_items to authenticated;
grant insert on public.order_items to authenticated;

grant select on public.payments to authenticated;
grant insert on public.payments to authenticated;

-- NOTE: payment_events is an audit storage table.
-- Client-facing reads must go through sanitized RPC surfaces, not direct table selects.

-- ============================================================
-- 8. ROW LEVEL SECURITY
-- ============================================================

-- reservations
alter table public.reservations enable row level security;

drop policy if exists reservations_select_own_or_admin on public.reservations;
create policy reservations_select_own_or_admin
on public.reservations
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or (select public.is_admin())
);

drop policy if exists reservations_insert_own on public.reservations;
create policy reservations_insert_own
on public.reservations
for insert
to authenticated
with check ((select auth.uid()) = user_id);

-- orders
alter table public.orders enable row level security;

drop policy if exists orders_select_own_or_admin on public.orders;
create policy orders_select_own_or_admin
on public.orders
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or (select public.is_admin())
);

drop policy if exists orders_insert_own on public.orders;
create policy orders_insert_own
on public.orders
for insert
to authenticated
with check ((select auth.uid()) = user_id);

-- order_items (visible if user owns the parent order)
alter table public.order_items enable row level security;

drop policy if exists order_items_select_own_or_admin on public.order_items;
create policy order_items_select_own_or_admin
on public.order_items
for select
to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and ((select auth.uid()) = o.user_id or (select public.is_admin()))
  )
);

drop policy if exists order_items_insert_own on public.order_items;
create policy order_items_insert_own
on public.order_items
for insert
to authenticated
with check (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and (select auth.uid()) = o.user_id
  )
);

-- payments
alter table public.payments enable row level security;

drop policy if exists payments_select_own_or_admin on public.payments;
create policy payments_select_own_or_admin
on public.payments
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or (select public.is_admin())
);

drop policy if exists payments_insert_own on public.payments;
create policy payments_insert_own
on public.payments
for insert
to authenticated
with check ((select auth.uid()) = user_id);

-- payment_events (admin/backoffice read only)
alter table public.payment_events enable row level security;

drop policy if exists payment_events_select_admin on public.payment_events;
