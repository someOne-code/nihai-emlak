-- Resolve public listing detail pages by canonical database slug while keeping
-- the existing UUID detail RPC as the authoritative JSON shape.

create or replace function public.get_public_listing_detail_by_slug(
  p_listing_slug text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_slug text;
  v_listing_id uuid;
begin
  v_slug := lower(nullif(btrim(p_listing_slug), ''));

  if v_slug is null or v_slug !~ '^[a-z0-9][a-z0-9-]*$' or char_length(v_slug) > 120 then
    raise exception 'invalid listing slug'
      using errcode = '22023';
  end if;

  select l.id
  into v_listing_id
  from public.listings as l
  where l.slug = v_slug
    and l.status = 'active';

  if not found then
    raise exception 'listing not found: %', v_slug
      using errcode = 'P0002';
  end if;

  return public.get_public_listing_detail(v_listing_id);
end;
$$;

revoke all on function public.get_public_listing_detail_by_slug(text)
  from public;

grant execute on function public.get_public_listing_detail_by_slug(text)
  to anon, authenticated;
