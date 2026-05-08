-- Harden admin main item catalog writes against duplicate active visible labels.
--
-- The table is historically unique by internal code. Admin users choose by label,
-- so the admin RPC boundary must reject duplicate active labels as the visible
-- payment item identity.

with ranked_main_item_labels as (
  select
    id,
    row_number() over (
      partition by lower(regexp_replace(trim(label), '\s+', ' ', 'g'))
      order by is_active desc, sort_order asc, created_at asc, id asc
    ) as rn
  from public.main_item_catalog
)
delete from public.main_item_catalog m
using ranked_main_item_labels r
where m.id = r.id
  and r.rn > 1;

create or replace function public.admin_create_main_item_catalog(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id        uuid;
  v_code      text;
  v_label     text;
  v_label_key text;
  v_strategy  text;
  v_amount    numeric(12,2);
  v_mult      numeric(12,4);
  v_is_active boolean;
begin
  if not public.is_admin() then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  v_code      := trim(p_payload->>'code');
  v_label     := trim(p_payload->>'label');
  v_label_key := lower(regexp_replace(v_label, '\s+', ' ', 'g'));
  v_strategy  := coalesce(trim(p_payload->>'pricing_strategy'), 'fixed');
  v_is_active := coalesce((p_payload->>'is_active')::boolean, true);

  if v_code is null or v_code = '' then
    raise exception 'code is required' using errcode = '22023';
  end if;

  if v_label is null or v_label = '' then
    raise exception 'label is required' using errcode = '22023';
  end if;

  if v_is_active and exists (
    select 1
    from public.main_item_catalog existing
    where existing.is_active = true
      and lower(regexp_replace(trim(existing.label), '\s+', ' ', 'g')) = v_label_key
  ) then
    raise exception 'active main item label already exists'
      using errcode = '23505',
            constraint = 'main_item_catalog_active_label_unique';
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
    v_is_active,
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

create or replace function public.admin_update_main_item_catalog(p_code text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id             uuid;
  v_current_label  text;
  v_current_active boolean;
  v_next_label     text;
  v_next_label_key text;
  v_next_active    boolean;
  v_amount         numeric(12,2);
  v_mult           numeric(12,4);
begin
  if not public.is_admin() then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  select id, label, is_active
  into v_id, v_current_label, v_current_active
  from public.main_item_catalog
  where code = trim(p_code);

  if v_id is null then
    raise exception 'Catalog item not found' using errcode = 'P0002';
  end if;

  v_next_label := coalesce(nullif(trim(p_payload->>'label'), ''), v_current_label);
  v_next_label_key := lower(regexp_replace(trim(v_next_label), '\s+', ' ', 'g'));
  v_next_active := coalesce((p_payload->>'is_active')::boolean, v_current_active);

  if v_next_active and exists (
    select 1
    from public.main_item_catalog existing
    where existing.id <> v_id
      and existing.is_active = true
      and lower(regexp_replace(trim(existing.label), '\s+', ' ', 'g')) = v_next_label_key
  ) then
    raise exception 'active main item label already exists'
      using errcode = '23505',
            constraint = 'main_item_catalog_active_label_unique';
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
    label              = v_next_label,
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
    is_active          = v_next_active,
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
