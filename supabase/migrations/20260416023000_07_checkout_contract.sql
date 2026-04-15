-- Phase 1 / Task 6: Checkout data contract — constraints and validation
-- References:
--   PHASE_1_2_TASKS.md  §170-185
--   BACKEND_PHASE_1.md  §150-156
--   IMPLEMENTATION_PLAN.md §124-149 (Faz 3)
--   PROJECT_PLAN.md §38-48, §408-454

-- ============================================================
-- 1. Add listing_id to order_items for direct service validation
-- ============================================================
-- order_items needs a direct listing_id reference so the trigger
-- can validate service eligibility without traversing
-- order -> reservation -> listing join chain at insert time.
alter table public.order_items
  add column if not exists listing_id uuid references public.listings(id) on delete restrict;

-- ============================================================
-- 2. UNIQUE partial index: no duplicate main_item label per order
-- Scenario: Ahmet can pick Kapora + Depozito + 1 Aylık Kira,
--           but cannot pick Kapora twice.
-- ============================================================
create unique index if not exists order_items_unique_main_per_order
  on public.order_items (order_id, label)
  where item_type = 'main_item';

-- ============================================================
-- 3. UNIQUE partial index: no duplicate service per order
-- Scenario: Ahmet can pick Temizlik, but not Temizlik twice.
-- ============================================================
create unique index if not exists order_items_unique_service_per_order
  on public.order_items (order_id, service_catalog_id)
  where item_type = 'service_item' and service_catalog_id is not null;

-- ============================================================
-- 4. CHECK: service_item MUST have a service_catalog_id
-- Scenario: Nobody can add a phantom service without a catalog ref.
-- ============================================================
alter table public.order_items
  add constraint order_items_service_requires_catalog
  check (
    item_type <> 'service_item'
    or service_catalog_id is not null
  );

-- ============================================================
-- 5. TRIGGER: validate service_item against listing_service_options
-- Scenario: Ahmet picks "Boya" for Istanbul flat, but Boya is
--           not configured for that listing → trigger rejects.
-- ============================================================
create or replace function public.validate_order_item_service()
returns trigger
language plpgsql
as $$
begin
  -- Only validate service_items
  if new.item_type <> 'service_item' then
    return new;
  end if;

  -- service_catalog_id is already guaranteed non-null by CHECK above

  -- The listing_id must be set for service validation
  if new.listing_id is null then
    raise exception 'service_item requires listing_id for validation';
  end if;

  -- Check that the service is enabled for this listing
  if not exists (
    select 1
    from public.listing_service_options lso
    where lso.listing_id = new.listing_id
      and lso.service_id = new.service_catalog_id
      and lso.is_enabled = true
  ) then
    raise exception 'Service % is not available for listing %',
      new.service_catalog_id, new.listing_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_order_item_service on public.order_items;
create trigger trg_validate_order_item_service
before insert on public.order_items
for each row
execute function public.validate_order_item_service();
