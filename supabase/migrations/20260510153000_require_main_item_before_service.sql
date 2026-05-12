-- Business rule: a listing must have at least one enabled+active main item
-- before any service option can be added/enabled.
-- This prevents checkout-incomplete configurations where services exist
-- but the primary payment item is missing.

create or replace function public.admin_configure_listing_service(
  p_listing_id uuid,
  p_code text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
volatile
as $$
declare
  v_catalog public.service_catalog%rowtype;
  v_listing_exists boolean;
  v_option_id uuid;
  v_is_enabled boolean;
  v_override_price numeric(12, 2);
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication required'
      using errcode = '42501';
  end if;

  if not (select public.is_admin()) then
    raise exception 'admin role is required'
      using errcode = '42501';
  end if;

  if p_listing_id is null then
    raise exception 'invalid listing id'
      using errcode = '22023';
  end if;

  if p_code is null or btrim(p_code) = '' then
    raise exception 'invalid service code'
      using errcode = '22023';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid service config payload'
      using errcode = '22023';
  end if;

  -- Look up catalog item by normalized code.
  select * into v_catalog
  from public.service_catalog
  where code = lower(btrim(p_code));

  if not found then
    raise exception 'service catalog entry not found'
      using errcode = 'P0002';
  end if;

  -- Verify listing exists.
  select exists (
    select 1 from public.listings where id = p_listing_id
  ) into v_listing_exists;

  if not v_listing_exists then
    raise exception 'listing not found'
      using errcode = 'P0002';
  end if;

  -- Business rule: require an enabled+active main item before allowing
  -- service option configuration.
  if not exists (
    select 1
    from public.listing_main_item_options m
    join public.main_item_catalog mc on mc.id = m.main_item_id
    where m.listing_id = p_listing_id
      and m.is_enabled = true
      and mc.is_active = true
  ) then
    raise exception 'listing must have an enabled main item before adding services'
      using errcode = 'P0004';
  end if;

  -- is_enabled: optional boolean. Missing inserts default enabled and
  -- existing rows preserve their current state.
  if p_payload ? 'is_enabled' then
    begin
      v_is_enabled := (p_payload ->> 'is_enabled')::boolean;
    exception when others then
      raise exception 'invalid is_enabled'
        using errcode = '22023';
    end;
  end if;

  -- override_price: optional numeric, must be non-negative.
  if p_payload ? 'override_price' then
    if p_payload ->> 'override_price' is null then
      v_override_price := null;
    else
      begin
        v_override_price := (p_payload ->> 'override_price')::numeric(12, 2);
      exception when others then
        raise exception 'invalid override price'
          using errcode = '22023';
      end;
      if v_override_price < 0 then
        raise exception 'override price must be non-negative'
          using errcode = '22023';
      end if;
    end if;
  end if;

  -- Upsert: insert or update the listing_service_options row.
  insert into public.listing_service_options (
    listing_id, service_id, is_enabled, override_price
  )
  values (
    p_listing_id, v_catalog.id, coalesce(v_is_enabled, true), v_override_price
  )
  on conflict (listing_id, service_id) do update
  set
    is_enabled = case
      when p_payload ? 'is_enabled' then excluded.is_enabled
      else listing_service_options.is_enabled
    end,
    override_price = case
      when p_payload ? 'override_price' then excluded.override_price
      else listing_service_options.override_price
    end
  returning id into v_option_id;

  -- Return the upserted row.
  select jsonb_build_object(
    'id', lso.id,
    'listing_id', lso.listing_id,
    'service_id', lso.service_id,
    'code', v_catalog.code,
    'name', v_catalog.name,
    'base_price', v_catalog.base_price,
    'override_price', lso.override_price,
    'is_enabled', lso.is_enabled,
    'catalog_is_active', v_catalog.is_active,
    'created_at', lso.created_at
  )
  into v_result
  from public.listing_service_options lso
  where lso.id = v_option_id;

  return v_result;
end;
$$;
