-- Phase 8.4: admin listing main item and service pricing config RPCs.
--
-- Contract: docs/ADMIN_LISTING_CONFIG_CONTRACT.md
-- - admin_configure_listing_main_item(p_listing_id, p_code, p_payload)
-- - admin_configure_listing_service(p_listing_id, p_code, p_payload)
--
-- Both RPCs:
--   1. Look up the catalog item by normalized code
--   2. Upsert the listing-level option row (create if missing, update if exists)
--   3. Return the updated option with catalog context
--
-- All RPCs run as security invoker, gated by auth.uid() + public.is_admin().
-- DB error codes:
--   28000 -> 401 (unauthenticated)
--   42501 -> 403 (admin role required)
--   22023 -> 400 (invalid request: payload shape, code, negative override)
--   P0002 -> 404 (listing or catalog item not found)
--   23505 -> 409 (duplicate option key, though upsert prevents this)

-- ----------------------------------------------------------------------------
-- 8.4 admin_configure_listing_main_item: enable/disable, override label,
-- override amount/multiplier, and sort order for a listing's main item.
-- ----------------------------------------------------------------------------
create or replace function public.admin_configure_listing_main_item(
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
  v_catalog public.main_item_catalog%rowtype;
  v_listing_exists boolean;
  v_option_id uuid;
  v_is_enabled boolean;
  v_override_label text;
  v_override_amount numeric(12, 2);
  v_override_multiplier numeric(12, 2);
  v_sort_order integer;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'authenticated admin is required'
      using errcode = '28000';
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
    raise exception 'invalid main item code'
      using errcode = '22023';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid main item config payload'
      using errcode = '22023';
  end if;

  -- Look up catalog item by normalized code.
  select * into v_catalog
  from public.main_item_catalog
  where code = lower(btrim(p_code));

  if not found then
    raise exception 'main item catalog entry not found'
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

  -- Extract fields from payload with partial-update semantics.
  -- is_enabled: optional boolean. Missing inserts use the DB default behavior
  -- (true) and existing rows preserve their current state.
  if p_payload ? 'is_enabled' then
    begin
      v_is_enabled := (p_payload ->> 'is_enabled')::boolean;
    exception when others then
      raise exception 'invalid is_enabled'
        using errcode = '22023';
    end;
  end if;

  -- override_label: optional text, null means "use catalog default".
  if p_payload ? 'override_label' then
    v_override_label := nullif(btrim(p_payload ->> 'override_label'), '');
  end if;

  -- override_amount: optional numeric, must be non-negative.
  if p_payload ? 'override_amount' then
    if p_payload ->> 'override_amount' is null then
      v_override_amount := null;
    else
      begin
        v_override_amount := (p_payload ->> 'override_amount')::numeric(12, 2);
      exception when others then
        raise exception 'invalid override amount'
          using errcode = '22023';
      end;
      if v_override_amount < 0 then
        raise exception 'override amount must be non-negative'
          using errcode = '22023';
      end if;
    end if;
  end if;

  -- override_multiplier: optional numeric, must be non-negative.
  if p_payload ? 'override_multiplier' then
    if p_payload ->> 'override_multiplier' is null then
      v_override_multiplier := null;
    else
      begin
        v_override_multiplier := (p_payload ->> 'override_multiplier')::numeric(12, 2);
      exception when others then
        raise exception 'invalid override multiplier'
          using errcode = '22023';
      end;
      if v_override_multiplier < 0 then
        raise exception 'override multiplier must be non-negative'
          using errcode = '22023';
      end if;
    end if;
  end if;

  -- sort_order: optional integer, must be non-negative.
  if p_payload ? 'sort_order' then
    begin
      v_sort_order := (p_payload ->> 'sort_order')::integer;
    exception when others then
      raise exception 'invalid sort order'
        using errcode = '22023';
    end;
    if v_sort_order < 0 then
      raise exception 'sort order must be non-negative'
        using errcode = '22023';
    end if;
  end if;

  -- Upsert: insert or update the listing_main_item_options row.
  insert into public.listing_main_item_options (
    listing_id, main_item_id, is_enabled, override_label,
    override_amount, override_multiplier, sort_order
  )
  values (
    p_listing_id, v_catalog.id, coalesce(v_is_enabled, true), v_override_label,
    v_override_amount, v_override_multiplier,
    coalesce(v_sort_order, 0)
  )
  on conflict (listing_id, main_item_id) do update
  set
    is_enabled = case
      when p_payload ? 'is_enabled' then excluded.is_enabled
      else listing_main_item_options.is_enabled
    end,
    override_label = case
      when p_payload ? 'override_label' then excluded.override_label
      else listing_main_item_options.override_label
    end,
    override_amount = case
      when p_payload ? 'override_amount' then excluded.override_amount
      else listing_main_item_options.override_amount
    end,
    override_multiplier = case
      when p_payload ? 'override_multiplier' then excluded.override_multiplier
      else listing_main_item_options.override_multiplier
    end,
    sort_order = case
      when p_payload ? 'sort_order' then excluded.sort_order
      else listing_main_item_options.sort_order
    end
  returning id into v_option_id;

  -- Return the updated option with catalog context.
  select jsonb_build_object(
    'id', lmo.id,
    'listing_id', lmo.listing_id,
    'main_item_id', lmo.main_item_id,
    'code', v_catalog.code,
    'label', v_catalog.label,
    'pricing_strategy', v_catalog.pricing_strategy,
    'default_amount', v_catalog.default_amount,
    'default_multiplier', v_catalog.default_multiplier,
    'override_label', lmo.override_label,
    'override_amount', lmo.override_amount,
    'override_multiplier', lmo.override_multiplier,
    'is_enabled', lmo.is_enabled,
    'sort_order', lmo.sort_order,
    'catalog_is_active', v_catalog.is_active,
    'created_at', lmo.created_at,
    'updated_at', lmo.updated_at
  )
  into v_result
  from public.listing_main_item_options lmo
  where lmo.id = v_option_id;

  return v_result;
end;
$$;

-- ----------------------------------------------------------------------------
-- 8.4 admin_configure_listing_service: enable/disable, override price
-- for a listing's service option.
-- ----------------------------------------------------------------------------
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
    raise exception 'authenticated admin is required'
      using errcode = '28000';
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

  -- Return the updated option with catalog context.
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

-- Grant execution to authenticated; the RPC bodies enforce admin via
-- auth.uid() + public.is_admin().
grant execute on function public.admin_configure_listing_main_item(uuid, text, jsonb) to authenticated;
grant execute on function public.admin_configure_listing_service(uuid, text, jsonb) to authenticated;
