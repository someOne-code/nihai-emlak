-- Fix: admin_listing_is_checkout_ready should only require an active main item.
-- Service options are optional for checkout readiness.
-- The previous DB state incorrectly required both main item AND service option.

create or replace function public.admin_listing_is_checkout_ready(
  p_listing_id uuid
)
returns boolean
language sql
security invoker
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.listing_main_item_options m
    join public.main_item_catalog mc on mc.id = m.main_item_id
    where m.listing_id = p_listing_id
      and m.is_enabled = true
      and mc.is_active = true
  );
$$;
