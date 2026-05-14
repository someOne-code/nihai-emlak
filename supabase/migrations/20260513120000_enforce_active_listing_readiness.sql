-- Harden the listings table boundary so active listings cannot bypass the
-- admin status workflow invariants.
--
-- Admin RPCs remain the intended path for publishing. Direct fixture/migration
-- inserts run as postgres, but authenticated application clients may not insert
-- already-active rows.

alter table public.listings
  alter column status set default 'passive';

-- Fail closed for any pre-existing rent rows that were active without the
-- checkout configuration required by the public checkout contract.
update public.listings as l
set status = 'passive'::public.listing_status
where l.type = 'rent'::public.listing_type
  and l.status = 'active'::public.listing_status
  and not public.admin_listing_is_checkout_ready(l.id);

create or replace function public.enforce_listing_publish_ready()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_missing text[];
begin
  if new.status <> 'active'::public.listing_status then
    return new;
  end if;

  if tg_op = 'INSERT' and current_user <> 'postgres' then
    raise exception 'active listing insert must use admin_set_listing_status'
      using errcode = 'P0004';
  end if;

  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    v_missing := public.admin_listing_publish_missing(new.id);
    if array_length(v_missing, 1) is not null then
      raise exception 'publish-guard: %', array_to_string(v_missing, ', ')
        using errcode = 'P0004';
    end if;

    if new.type = 'rent'::public.listing_type
       and not public.admin_listing_is_checkout_ready(new.id) then
      raise exception 'checkout-not-ready'
        using errcode = 'P0004';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_listings_enforce_publish_ready on public.listings;
create trigger trg_listings_enforce_publish_ready
before insert or update of status on public.listings
for each row
execute function public.enforce_listing_publish_ready();
