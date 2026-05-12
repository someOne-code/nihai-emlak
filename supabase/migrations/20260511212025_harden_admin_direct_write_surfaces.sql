-- Enforce publish readiness at the table boundary so direct PostgREST/table
-- writes cannot bypass admin_set_listing_status.

create or replace function public.enforce_listing_publish_ready()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_missing text[];
begin
  if new.status = 'active'
     and old.status is distinct from new.status then
    v_missing := public.admin_listing_publish_missing(new.id);
    if array_length(v_missing, 1) is not null then
      raise exception 'publish-guard: %', array_to_string(v_missing, ', ')
        using errcode = 'P0004';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_listings_enforce_publish_ready on public.listings;
create trigger trg_listings_enforce_publish_ready
before update of status on public.listings
for each row
execute function public.enforce_listing_publish_ready();

revoke all on function public.admin_listing_publish_missing(uuid) from public;
revoke execute on function public.admin_listing_publish_missing(uuid) from anon;
grant execute on function public.admin_listing_publish_missing(uuid) to authenticated;

revoke all on function public.admin_listing_is_publish_ready(uuid) from public;
revoke execute on function public.admin_listing_is_publish_ready(uuid) from anon;
grant execute on function public.admin_listing_is_publish_ready(uuid) to authenticated;
