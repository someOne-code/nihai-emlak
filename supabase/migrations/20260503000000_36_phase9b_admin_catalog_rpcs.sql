-- Phase 9B: Admin catalog management RPCs for main_item_catalog and service_catalog.
--
-- Adds route-facing public wrappers:
--   admin_list_main_item_catalog()
--   admin_create_main_item_catalog(p_payload jsonb)
--   admin_update_main_item_catalog(p_code text, p_payload jsonb)
--   admin_list_service_catalog()
--   admin_create_service_catalog(p_payload jsonb)
--   admin_update_service_catalog(p_code text, p_payload jsonb)
--
-- Privileged implementations live in the unexposed internal schema. Public RPC
-- names remain thin wrappers so Next routes do not change.

create schema if not exists internal;

revoke all on schema internal from public;
revoke usage on schema internal from anon, authenticated;
grant usage on schema internal to service_role;

-- ---------------------------------------------------------------------------
-- Main item catalog internal implementations
-- ---------------------------------------------------------------------------

create or replace function internal.admin_list_main_item_catalog()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  return (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',                 m.id,
          'code',               m.code,
          'label',              m.label,
          'description',        m.description,
          'pricing_strategy',   m.pricing_strategy,
          'default_amount',     m.default_amount,
          'default_multiplier', m.default_multiplier,
          'is_active',          m.is_active,
          'sort_order',         m.sort_order,
          'created_at',         m.created_at,
          'updated_at',         m.updated_at
        )
        order by m.sort_order asc, m.created_at asc
      ),
      '[]'::jsonb
    )
    from public.main_item_catalog m
  );
end;
$$;

create or replace function internal.admin_create_main_item_catalog(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id       uuid;
  v_code     text;
  v_label    text;
  v_strategy text;
  v_amount   numeric(12,2);
  v_mult     numeric(12,4);
begin
  if not public.is_admin() then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  v_code     := trim(p_payload->>'code');
  v_label    := trim(p_payload->>'label');
  v_strategy := coalesce(trim(p_payload->>'pricing_strategy'), 'fixed');

  if v_code is null or v_code = '' then
    raise exception 'code is required' using errcode = '22023';
  end if;

  if v_label is null or v_label = '' then
    raise exception 'label is required' using errcode = '22023';
  end if;

  if p_payload ? 'default_amount' and p_payload->>'default_amount' is not null then
    v_amount := (p_payload->>'default_amount')::numeric;
    if v_amount < 0 then
      raise exception 'default_amount negatif olamaz' using errcode = '22023';
    end if;
  end if;

  if p_payload ? 'default_multiplier' and p_payload->>'default_multiplier' is not null then
    v_mult := (p_payload->>'default_multiplier')::numeric;
    if v_mult < 0 then
      raise exception 'default_multiplier negatif olamaz' using errcode = '22023';
    end if;
  end if;

  insert into public.main_item_catalog (
    code, label, description, pricing_strategy,
    default_amount, default_multiplier, is_active, sort_order
  )
  values (
    v_code,
    v_label,
    nullif(trim(p_payload->>'description'), ''),
    v_strategy,
    v_amount,
    v_mult,
    coalesce((p_payload->>'is_active')::boolean, true),
    coalesce((p_payload->>'sort_order')::integer, 0)
  )
  returning id into v_id;

  return (
    select row_to_json(m)::jsonb
    from (
      select id, code, label, description, pricing_strategy,
             default_amount, default_multiplier, is_active,
             sort_order, created_at, updated_at
      from public.main_item_catalog
      where id = v_id
    ) m
  );
end;
$$;

create or replace function internal.admin_update_main_item_catalog(p_code text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id     uuid;
  v_amount numeric(12,2);
  v_mult   numeric(12,4);
begin
  if not public.is_admin() then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  select id into v_id
  from public.main_item_catalog
  where code = trim(p_code);

  if v_id is null then
    raise exception 'Catalog item not found' using errcode = 'P0002';
  end if;

  if p_payload ? 'default_amount' and p_payload->>'default_amount' is not null then
    v_amount := (p_payload->>'default_amount')::numeric;
    if v_amount < 0 then
      raise exception 'default_amount negatif olamaz' using errcode = '22023';
    end if;
  end if;

  if p_payload ? 'default_multiplier' and p_payload->>'default_multiplier' is not null then
    v_mult := (p_payload->>'default_multiplier')::numeric;
    if v_mult < 0 then
      raise exception 'default_multiplier negatif olamaz' using errcode = '22023';
    end if;
  end if;

  update public.main_item_catalog set
    label              = coalesce(nullif(trim(p_payload->>'label'), ''), label),
    description        = case when p_payload ? 'description'
                               then nullif(trim(p_payload->>'description'), '')
                               else description end,
    pricing_strategy   = coalesce(nullif(trim(p_payload->>'pricing_strategy'), ''), pricing_strategy),
    default_amount     = case when p_payload ? 'default_amount'
                               then v_amount
                               else default_amount end,
    default_multiplier = case when p_payload ? 'default_multiplier'
                               then v_mult
                               else default_multiplier end,
    is_active          = coalesce((p_payload->>'is_active')::boolean, is_active),
    sort_order         = coalesce((p_payload->>'sort_order')::integer, sort_order)
  where id = v_id;

  return (
    select row_to_json(m)::jsonb
    from (
      select id, code, label, description, pricing_strategy,
             default_amount, default_multiplier, is_active,
             sort_order, created_at, updated_at
      from public.main_item_catalog
      where id = v_id
    ) m
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Service catalog internal implementations
-- ---------------------------------------------------------------------------

create or replace function internal.admin_list_service_catalog()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  return (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',          s.id,
          'code',        s.code,
          'name',        s.name,
          'description', s.description,
          'base_price',  s.base_price,
          'is_active',   s.is_active,
          'created_at',  s.created_at,
          'updated_at',  s.updated_at
        )
        order by s.code asc
      ),
      '[]'::jsonb
    )
    from public.service_catalog s
  );
end;
$$;

create or replace function internal.admin_create_service_catalog(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id    uuid;
  v_code  text;
  v_name  text;
  v_price numeric(12,2);
begin
  if not public.is_admin() then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  v_code := trim(p_payload->>'code');
  v_name := trim(p_payload->>'name');

  if v_code is null or v_code = '' then
    raise exception 'code is required' using errcode = '22023';
  end if;

  if v_name is null or v_name = '' then
    raise exception 'name is required' using errcode = '22023';
  end if;

  if p_payload ? 'base_price' and p_payload->>'base_price' is not null then
    v_price := (p_payload->>'base_price')::numeric;
    if v_price < 0 then
      raise exception 'base_price negatif olamaz' using errcode = '22023';
    end if;
  else
    v_price := 0;
  end if;

  insert into public.service_catalog (code, name, description, base_price, is_active)
  values (
    v_code,
    v_name,
    nullif(trim(p_payload->>'description'), ''),
    v_price,
    coalesce((p_payload->>'is_active')::boolean, true)
  )
  returning id into v_id;

  return (
    select row_to_json(s)::jsonb
    from (
      select id, code, name, description, base_price, is_active, created_at, updated_at
      from public.service_catalog
      where id = v_id
    ) s
  );
end;
$$;

create or replace function internal.admin_update_service_catalog(p_code text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id    uuid;
  v_price numeric(12,2);
begin
  if not public.is_admin() then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  select id into v_id
  from public.service_catalog
  where code = trim(p_code);

  if v_id is null then
    raise exception 'Service catalog entry not found' using errcode = 'P0002';
  end if;

  if p_payload ? 'base_price' and p_payload->>'base_price' is not null then
    v_price := (p_payload->>'base_price')::numeric;
    if v_price < 0 then
      raise exception 'base_price negatif olamaz' using errcode = '22023';
    end if;
  end if;

  update public.service_catalog set
    name        = coalesce(nullif(trim(p_payload->>'name'), ''), name),
    description = case when p_payload ? 'description'
                        then nullif(trim(p_payload->>'description'), '')
                        else description end,
    base_price  = case when p_payload ? 'base_price' then v_price else base_price end,
    is_active   = coalesce((p_payload->>'is_active')::boolean, is_active)
  where id = v_id;

  return (
    select row_to_json(s)::jsonb
    from (
      select id, code, name, description, base_price, is_active, created_at, updated_at
      from public.service_catalog
      where id = v_id
    ) s
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Public RPC wrappers
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_main_item_catalog()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal.admin_list_main_item_catalog();
$$;

create or replace function public.admin_create_main_item_catalog(p_payload jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal.admin_create_main_item_catalog(p_payload);
$$;

create or replace function public.admin_update_main_item_catalog(p_code text, p_payload jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal.admin_update_main_item_catalog(p_code, p_payload);
$$;

create or replace function public.admin_list_service_catalog()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal.admin_list_service_catalog();
$$;

create or replace function public.admin_create_service_catalog(p_payload jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal.admin_create_service_catalog(p_payload);
$$;

create or replace function public.admin_update_service_catalog(p_code text, p_payload jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal.admin_update_service_catalog(p_code, p_payload);
$$;

revoke all on function internal.admin_list_main_item_catalog() from public;
revoke all on function internal.admin_create_main_item_catalog(jsonb) from public;
revoke all on function internal.admin_update_main_item_catalog(text, jsonb) from public;
revoke all on function internal.admin_list_service_catalog() from public;
revoke all on function internal.admin_create_service_catalog(jsonb) from public;
revoke all on function internal.admin_update_service_catalog(text, jsonb) from public;

revoke execute on function internal.admin_list_main_item_catalog() from anon;
revoke execute on function internal.admin_create_main_item_catalog(jsonb) from anon;
revoke execute on function internal.admin_update_main_item_catalog(text, jsonb) from anon;
revoke execute on function internal.admin_list_service_catalog() from anon;
revoke execute on function internal.admin_create_service_catalog(jsonb) from anon;
revoke execute on function internal.admin_update_service_catalog(text, jsonb) from anon;

grant execute on function internal.admin_list_main_item_catalog() to service_role;
grant execute on function internal.admin_create_main_item_catalog(jsonb) to service_role;
grant execute on function internal.admin_update_main_item_catalog(text, jsonb) to service_role;
grant execute on function internal.admin_list_service_catalog() to service_role;
grant execute on function internal.admin_create_service_catalog(jsonb) to service_role;
grant execute on function internal.admin_update_service_catalog(text, jsonb) to service_role;

revoke all on function public.admin_list_main_item_catalog() from public;
revoke all on function public.admin_create_main_item_catalog(jsonb) from public;
revoke all on function public.admin_update_main_item_catalog(text, jsonb) from public;
revoke all on function public.admin_list_service_catalog() from public;
revoke all on function public.admin_create_service_catalog(jsonb) from public;
revoke all on function public.admin_update_service_catalog(text, jsonb) from public;

revoke execute on function public.admin_list_main_item_catalog() from anon;
revoke execute on function public.admin_create_main_item_catalog(jsonb) from anon;
revoke execute on function public.admin_update_main_item_catalog(text, jsonb) from anon;
revoke execute on function public.admin_list_service_catalog() from anon;
revoke execute on function public.admin_create_service_catalog(jsonb) from anon;
revoke execute on function public.admin_update_service_catalog(text, jsonb) from anon;

grant execute on function public.admin_list_main_item_catalog() to authenticated;
grant execute on function public.admin_create_main_item_catalog(jsonb) to authenticated;
grant execute on function public.admin_update_main_item_catalog(text, jsonb) to authenticated;
grant execute on function public.admin_list_service_catalog() to authenticated;
grant execute on function public.admin_create_service_catalog(jsonb) to authenticated;
grant execute on function public.admin_update_service_catalog(text, jsonb) to authenticated;
