-- Active listing invariants also depend on child configuration rows.
--
-- Parent status guards are not enough: deleting the last image or disabling
-- the only active main item can make an already-published listing invalid
-- without touching public.listings.status. These triggers fail closed at the
-- table boundary so RPC and direct admin writes share the same invariant.

create or replace function public.enforce_active_listing_image_count()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_listing_id uuid;
  v_listing public.listings%rowtype;
  v_remaining_count integer;
begin
  if tg_op = 'DELETE' then
    v_listing_id := old.listing_id;
  elsif tg_op = 'UPDATE' and old.listing_id is distinct from new.listing_id then
    v_listing_id := old.listing_id;
  else
    return null;
  end if;

  select * into v_listing
  from public.listings
  where id = v_listing_id;

  if not found or v_listing.status <> 'active'::public.listing_status then
    return null;
  end if;

  select count(*) into v_remaining_count
  from public.listing_images
  where listing_id = v_listing_id;

  if v_remaining_count = 0 then
    raise exception 'active listing must keep at least one image'
      using errcode = 'P0004';
  end if;

  return null;
end;
$$;

drop trigger if exists trg_listing_images_enforce_active_image_count on public.listing_images;
create trigger trg_listing_images_enforce_active_image_count
after update of listing_id or delete on public.listing_images
for each row
execute function public.enforce_active_listing_image_count();

create or replace function public.enforce_active_rent_listing_main_item()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_listing_id uuid;
  v_listing public.listings%rowtype;
begin
  if tg_op = 'DELETE' then
    v_listing_id := old.listing_id;
  else
    v_listing_id := new.listing_id;
  end if;

  select * into v_listing
  from public.listings
  where id = v_listing_id;

  if found
     and v_listing.type = 'rent'::public.listing_type
     and v_listing.status = 'active'::public.listing_status
     and not public.admin_listing_is_checkout_ready(v_listing_id) then
    raise exception 'active rent listing must keep an enabled main item'
      using errcode = 'P0004';
  end if;

  if tg_op = 'UPDATE' and old.listing_id is distinct from new.listing_id then
    select * into v_listing
    from public.listings
    where id = old.listing_id;

    if found
       and v_listing.type = 'rent'::public.listing_type
       and v_listing.status = 'active'::public.listing_status
       and not public.admin_listing_is_checkout_ready(old.listing_id) then
      raise exception 'active rent listing must keep an enabled main item'
        using errcode = 'P0004';
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_listing_main_item_options_enforce_active_ready
  on public.listing_main_item_options;
create trigger trg_listing_main_item_options_enforce_active_ready
after insert or update or delete on public.listing_main_item_options
for each row
execute function public.enforce_active_rent_listing_main_item();

create or replace function public.enforce_active_rent_listing_main_item_catalog()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.is_active is not distinct from new.is_active then
    return null;
  end if;

  if exists (
    select 1
    from public.listing_main_item_options lmo
    join public.listings l on l.id = lmo.listing_id
    where lmo.main_item_id = old.id
      and l.type = 'rent'::public.listing_type
      and l.status = 'active'::public.listing_status
      and not public.admin_listing_is_checkout_ready(l.id)
  ) then
    raise exception 'active rent listing must keep an enabled main item'
      using errcode = 'P0004';
  end if;

  return null;
end;
$$;

drop trigger if exists trg_main_item_catalog_enforce_active_ready
  on public.main_item_catalog;
create trigger trg_main_item_catalog_enforce_active_ready
after update of is_active or delete on public.main_item_catalog
for each row
execute function public.enforce_active_rent_listing_main_item_catalog();
