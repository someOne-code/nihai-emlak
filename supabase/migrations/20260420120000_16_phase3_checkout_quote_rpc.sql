-- Phase 3 / Task 3: authoritative checkout pricing quote in PostgreSQL

create or replace function public.calculate_checkout_quote(
  p_listing_id uuid,
  p_main_item_codes text[],
  p_service_item_codes text[] default array[]::text[],
  p_stay_months integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing public.listings%rowtype;
  v_main_item_codes text[];
  v_service_item_codes text[];
  v_main_item_input_count integer;
  v_main_item_count integer;
  v_main_item_distinct_count integer;
  v_main_item_invalid_count integer;
  v_service_item_input_count integer;
  v_service_item_count integer;
  v_service_item_distinct_count integer;
  v_service_item_invalid_count integer;
  v_total_amount numeric(12, 2) := 0;
  v_items jsonb := '[]'::jsonb;
  v_currency text;
  v_requested_main_item record;
  v_main_item record;
  v_requested_service_item record;
  v_service_item record;
  v_amount numeric(12, 2);
begin
  if p_listing_id is null then
    raise exception 'p_listing_id is required' using errcode = '22023';
  end if;

  if p_stay_months is null or p_stay_months < 1 or p_stay_months > 12 then
    raise exception 'p_stay_months must be between 1 and 12' using errcode = '22023';
  end if;

  select
    coalesce(array_agg(normalized_code order by ordinality) filter (where normalized_code is not null), array[]::text[]),
    count(*),
    count(normalized_code),
    count(distinct normalized_code),
    count(*) filter (
      where normalized_code is not null
        and (
          char_length(normalized_code) > 64
          or normalized_code !~ '^[a-z0-9][a-z0-9_-]*$'
        )
    )
  into
    v_main_item_codes,
    v_main_item_input_count,
    v_main_item_count,
    v_main_item_distinct_count,
    v_main_item_invalid_count
  from (
    select
      nullif(lower(btrim(raw.code)), '') as normalized_code,
      raw.ordinality
    from unnest(coalesce(p_main_item_codes, array[]::text[])) with ordinality as raw(code, ordinality)
  ) prepared_main_items;

  if v_main_item_input_count <> v_main_item_count then
    raise exception 'main item codes must not contain null or blank values' using errcode = '22023';
  end if;

  if v_main_item_input_count > 20 then
    raise exception 'main_items has too many items' using errcode = '22023';
  end if;

  if v_main_item_invalid_count > 0 then
    raise exception 'main_items must contain valid item codes' using errcode = '22023';
  end if;

  if v_main_item_count = 0 then
    raise exception 'main item selection is required' using errcode = '22023';
  end if;

  if v_main_item_count <> v_main_item_distinct_count then
    raise exception 'duplicate main item codes are not allowed' using errcode = '22023';
  end if;

  select
    coalesce(array_agg(normalized_code order by ordinality) filter (where normalized_code is not null), array[]::text[]),
    count(*),
    count(normalized_code),
    count(distinct normalized_code),
    count(*) filter (
      where normalized_code is not null
        and (
          char_length(normalized_code) > 64
          or normalized_code !~ '^[a-z0-9][a-z0-9_-]*$'
        )
    )
  into
    v_service_item_codes,
    v_service_item_input_count,
    v_service_item_count,
    v_service_item_distinct_count,
    v_service_item_invalid_count
  from (
    select
      nullif(lower(btrim(raw.code)), '') as normalized_code,
      raw.ordinality
    from unnest(coalesce(p_service_item_codes, array[]::text[])) with ordinality as raw(code, ordinality)
  ) prepared_service_items;

  if v_service_item_input_count <> v_service_item_count then
    raise exception 'service item codes must not contain null or blank values' using errcode = '22023';
  end if;

  if v_service_item_input_count > 20 then
    raise exception 'service_items has too many items' using errcode = '22023';
  end if;

  if v_service_item_invalid_count > 0 then
    raise exception 'service_items must contain valid item codes' using errcode = '22023';
  end if;

  if v_service_item_count <> v_service_item_distinct_count then
    raise exception 'duplicate service item codes are not allowed' using errcode = '22023';
  end if;

  select *
  into v_listing
  from public.listings
  where id = p_listing_id
    and status = 'active'
    and type = 'rent';

  if not found then
    raise exception 'listing is not available for checkout: %', p_listing_id using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.listing_main_item_options lmo
    join public.main_item_catalog mic
      on mic.id = lmo.main_item_id
    where lmo.listing_id = p_listing_id
      and lmo.is_enabled = true
      and mic.is_active = true
  ) then
    raise exception 'listing does not have any enabled main checkout items: %', p_listing_id
      using errcode = 'P0001';
  end if;

  v_currency := upper(coalesce(nullif(v_listing.currency, ''), 'TRY'));

  for v_requested_main_item in
    select requested.code, requested.ordinality
    from unnest(v_main_item_codes) with ordinality as requested(code, ordinality)
    order by requested.ordinality
  loop
    select
      mic.code,
      coalesce(nullif(btrim(lmo.override_label), ''), mic.label) as label,
      mic.pricing_strategy,
      mic.default_amount,
      mic.default_multiplier,
      lmo.override_amount,
      lmo.override_multiplier
    into v_main_item
    from public.listing_main_item_options lmo
    join public.main_item_catalog mic
      on mic.id = lmo.main_item_id
    where lmo.listing_id = p_listing_id
      and lower(btrim(mic.code)) = v_requested_main_item.code
      and lmo.is_enabled = true
      and mic.is_active = true;

    if not found then
      raise exception 'main item is not enabled for listing: %', v_requested_main_item.code
        using errcode = 'P0001';
    end if;

    if v_main_item.pricing_strategy = 'fixed' then
      v_amount := round(coalesce(v_main_item.override_amount, v_main_item.default_amount), 2);
    elsif v_main_item.pricing_strategy = 'listing_price_multiplier' then
      v_amount := round(v_listing.price * coalesce(v_main_item.override_multiplier, v_main_item.default_multiplier), 2);
    elsif v_main_item.pricing_strategy = 'stay_months_multiplier' then
      v_amount := round((p_stay_months::numeric) * coalesce(v_main_item.override_multiplier, v_main_item.default_multiplier), 2);
    else
      raise exception 'unsupported main item pricing strategy: %', v_main_item.pricing_strategy
        using errcode = '22023';
    end if;

    if v_amount is null or v_amount < 0 then
      raise exception 'invalid main item pricing configuration: %', v_main_item.code using errcode = '22023';
    end if;

    v_total_amount := round(v_total_amount + v_amount, 2);
    v_items := v_items || jsonb_build_array(
      jsonb_build_object(
        'code', v_main_item.code,
        'label', v_main_item.label,
        'item_type', 'main_item',
        'amount', v_amount,
        'listing_id', p_listing_id,
        'service_catalog_id', null
      )
    );
  end loop;

  for v_requested_service_item in
    select requested.code, requested.ordinality
    from unnest(v_service_item_codes) with ordinality as requested(code, ordinality)
    order by requested.ordinality
  loop
    select
      sc.id as service_catalog_id,
      lower(btrim(sc.code)) as code,
      sc.name as label,
      coalesce(lso.override_price, sc.base_price) as amount
    into v_service_item
    from public.listing_service_options lso
    join public.service_catalog sc
      on sc.id = lso.service_id
    where lso.listing_id = p_listing_id
      and lower(btrim(sc.code)) = v_requested_service_item.code
      and lso.is_enabled = true
      and sc.is_active = true;

    if not found then
      raise exception 'service item is not enabled for listing: %', v_requested_service_item.code
        using errcode = 'P0001';
    end if;

    v_amount := round(v_service_item.amount, 2);
    if v_amount is null or v_amount < 0 then
      raise exception 'invalid service item pricing configuration: %', v_service_item.code using errcode = '22023';
    end if;

    v_total_amount := round(v_total_amount + v_amount, 2);
    v_items := v_items || jsonb_build_array(
      jsonb_build_object(
        'code', v_service_item.code,
        'label', v_service_item.label,
        'item_type', 'service_item',
        'amount', v_amount,
        'listing_id', p_listing_id,
        'service_catalog_id', v_service_item.service_catalog_id
      )
    );
  end loop;

  return jsonb_build_object(
    'listing_id', p_listing_id,
    'currency', v_currency,
    'total_amount', v_total_amount,
    'items', v_items
  );
end;
$$;

revoke all on function public.calculate_checkout_quote(uuid, text[], text[], integer) from public;
revoke execute on function public.calculate_checkout_quote(uuid, text[], text[], integer)
from anon;

grant execute on function public.calculate_checkout_quote(uuid, text[], text[], integer)
to authenticated, service_role;
