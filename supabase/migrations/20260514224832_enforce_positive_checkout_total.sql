-- Enforce that checkout creation can only produce payable, positive totals.

create or replace function internal.create_checkout(
  p_listing_id uuid,
  p_move_in_date date,
  p_stay_months integer,
  p_guest_count integer,
  p_main_item_codes text[],
  p_service_item_codes text[] default array[]::text[],
  p_note text default null,
  p_contact_full_name text default null,
  p_contact_phone text default null,
  p_contact_email text default null,
  p_contact_preferred_method text default null,
  p_contact_preferred_time text default null,
  p_contact_occupant_full_name text default null,
  p_contact_document_readiness text default null,
  p_contact_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_listing public.listings%rowtype;
  v_note text;
  v_quote jsonb;
  v_reservation_id uuid;
  v_order_id uuid;
  v_payment_id uuid;
  v_payment_provider_ref text;
  v_total_amount numeric(12, 2);
  v_currency text;
  v_constraint_name text;
  v_contact_full_name text;
  v_contact_phone text;
  v_contact_email text;
  v_contact_preferred_method text;
  v_contact_preferred_time text;
  v_contact_occupant_full_name text;
  v_contact_document_readiness text;
  v_contact_note text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'authenticated user is required' using errcode = '28000';
  end if;

  if p_listing_id is null then
    raise exception 'p_listing_id is required' using errcode = '22023';
  end if;

  if p_move_in_date is null then
    raise exception 'p_move_in_date is required' using errcode = '22023';
  end if;

  if p_move_in_date < current_date then
    raise exception 'p_move_in_date cannot be in the past' using errcode = '22023';
  end if;

  if p_stay_months is null or p_stay_months < 1 or p_stay_months > 12 then
    raise exception 'p_stay_months must be between 1 and 12' using errcode = '22023';
  end if;

  if p_guest_count is null or p_guest_count < 1 then
    raise exception 'p_guest_count must be a positive integer' using errcode = '22023';
  end if;

  v_contact_full_name := nullif(btrim(coalesce(p_contact_full_name, '')), '');
  if v_contact_full_name is null then
    raise exception 'p_contact_full_name is required' using errcode = '22023';
  end if;
  if char_length(v_contact_full_name) < 2 or char_length(v_contact_full_name) > 120 then
    raise exception 'p_contact_full_name must be between 2 and 120 characters' using errcode = '22023';
  end if;

  v_contact_phone := nullif(btrim(coalesce(p_contact_phone, '')), '');
  if v_contact_phone is null then
    raise exception 'p_contact_phone is required' using errcode = '22023';
  end if;
  if char_length(v_contact_phone) < 7 or char_length(v_contact_phone) > 32 then
    raise exception 'p_contact_phone must be between 7 and 32 characters' using errcode = '22023';
  end if;

  v_contact_email := nullif(lower(btrim(coalesce(p_contact_email, ''))), '');
  if v_contact_email is not null and (
    char_length(v_contact_email) > 254
    or v_contact_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ) then
    raise exception 'p_contact_email must be a valid email address' using errcode = '22023';
  end if;

  v_contact_preferred_method := lower(nullif(btrim(coalesce(p_contact_preferred_method, '')), ''));
  if v_contact_preferred_method is null
     or v_contact_preferred_method not in ('phone', 'whatsapp', 'email') then
    raise exception 'p_contact_preferred_method must be one of phone, whatsapp, email' using errcode = '22023';
  end if;

  v_contact_preferred_time := nullif(btrim(coalesce(p_contact_preferred_time, '')), '');
  if v_contact_preferred_time is not null and char_length(v_contact_preferred_time) > 120 then
    raise exception 'p_contact_preferred_time is too long' using errcode = '22023';
  end if;

  v_contact_occupant_full_name := nullif(btrim(coalesce(p_contact_occupant_full_name, '')), '');
  if v_contact_occupant_full_name is not null and char_length(v_contact_occupant_full_name) > 120 then
    raise exception 'p_contact_occupant_full_name is too long' using errcode = '22023';
  end if;

  v_contact_document_readiness := lower(nullif(btrim(coalesce(p_contact_document_readiness, '')), ''));
  if v_contact_document_readiness is null
     or v_contact_document_readiness not in ('ready', 'needs_help', 'later') then
    raise exception 'p_contact_document_readiness must be one of ready, needs_help, later' using errcode = '22023';
  end if;

  v_contact_note := nullif(btrim(coalesce(p_contact_note, '')), '');
  if v_contact_note is not null and char_length(v_contact_note) > 1000 then
    raise exception 'p_contact_note is too long' using errcode = '22023';
  end if;

  select *
  into v_listing
  from public.listings
  where id = p_listing_id
  for update;

  if not found then
    raise exception 'listing is not available for checkout: %', p_listing_id using errcode = 'P0002';
  end if;

  if v_listing.status <> 'active' or v_listing.type <> 'rent' then
    raise exception 'listing is not available for checkout: %', p_listing_id using errcode = 'P0002';
  end if;

  perform 1
  from public.reservations
  where listing_id = p_listing_id
    and status = 'pending';

  if found then
    raise exception 'listing is not available for checkout: %', p_listing_id using errcode = 'P0002';
  end if;

  v_note := nullif(btrim(coalesce(p_note, '')), '');

  if v_note is null then
    raise exception 'p_note is required' using errcode = '22023';
  end if;

  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'p_note is too long' using errcode = '22023';
  end if;

  perform 1
  from public.listing_main_item_options lmo
  join public.main_item_catalog mic
    on mic.id = lmo.main_item_id
  join unnest(coalesce(p_main_item_codes, array[]::text[])) as requested(code)
    on lower(btrim(mic.code)) = lower(btrim(requested.code))
  where lmo.listing_id = p_listing_id
  for share of lmo, mic;

  perform 1
  from public.listing_service_options lso
  join public.service_catalog sc
    on sc.id = lso.service_id
  join unnest(coalesce(p_service_item_codes, array[]::text[])) as requested(code)
    on lower(btrim(sc.code)) = lower(btrim(requested.code))
  where lso.listing_id = p_listing_id
  for share of lso, sc;

  v_quote := public.calculate_checkout_quote(
    p_listing_id,
    p_main_item_codes,
    coalesce(p_service_item_codes, array[]::text[]),
    p_stay_months
  );

  v_total_amount := (v_quote->>'total_amount')::numeric(12, 2);
  v_currency := upper(coalesce(nullif(v_quote->>'currency', ''), 'TRY'));

  if v_total_amount is null or v_total_amount <= 0 then
    raise exception 'checkout total must be positive' using errcode = '22023';
  end if;

  begin
    insert into public.reservations (
      listing_id,
      user_id,
      move_in_date,
      stay_months,
      guest_count,
      note,
      status
    )
    values (
      p_listing_id,
      v_user_id,
      p_move_in_date,
      p_stay_months,
      p_guest_count,
      v_note,
      'pending'
    )
    returning id into v_reservation_id;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint_name = CONSTRAINT_NAME;

      if v_constraint_name = 'reservations_single_pending_per_listing_idx' then
        raise exception 'listing is not available for checkout: %', p_listing_id
          using
            errcode = 'P0002',
            detail = format(
              'reservation insert conflicted on constraint %s',
              v_constraint_name
            );
      end if;

      raise;
  end;

  insert into public.reservation_intake (
    reservation_id,
    user_id,
    contact_full_name,
    contact_phone,
    contact_email,
    preferred_contact_method,
    preferred_contact_time,
    occupant_full_name,
    document_readiness,
    note
  )
  values (
    v_reservation_id,
    v_user_id,
    v_contact_full_name,
    v_contact_phone,
    v_contact_email,
    v_contact_preferred_method,
    v_contact_preferred_time,
    v_contact_occupant_full_name,
    v_contact_document_readiness,
    v_contact_note
  );

  insert into public.orders (
    reservation_id,
    user_id,
    total_amount,
    currency,
    status
  )
  values (
    v_reservation_id,
    v_user_id,
    v_total_amount,
    v_currency,
    'pending'
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id,
    item_type,
    code,
    label,
    amount,
    service_catalog_id,
    listing_id
  )
  select
    v_order_id,
    (item.value->>'item_type')::public.order_item_type,
    item.value->>'code',
    item.value->>'label',
    (item.value->>'amount')::numeric(12, 2),
    nullif(item.value->>'service_catalog_id', '')::uuid,
    p_listing_id
  from jsonb_array_elements(v_quote->'items') with ordinality as item(value, ordinality)
  order by item.ordinality;

  insert into public.payments (
    order_id,
    user_id,
    amount,
    currency,
    status,
    provider
  )
  values (
    v_order_id,
    v_user_id,
    v_total_amount,
    v_currency,
    'pending',
    'isbank'
  )
  returning id, provider_ref into v_payment_id, v_payment_provider_ref;

  if v_payment_provider_ref <> v_payment_id::text then
    raise exception 'isbank provider_ref invariant violated for payment: %', v_payment_id
      using errcode = '22023';
  end if;

  return jsonb_build_object(
    'result', 'created',
    'reservation_id', v_reservation_id,
    'order_id', v_order_id,
    'payment_id', v_payment_id,
    'listing_id', p_listing_id,
    'total_amount', v_total_amount,
    'currency', v_currency,
    'payment_status', 'pending'
  );
end;
$$;

revoke all on function internal.create_checkout(uuid, date, integer, integer, text[], text[], text, text, text, text, text, text, text, text, text)
from public;
grant execute on function internal.create_checkout(uuid, date, integer, integer, text[], text[], text, text, text, text, text, text, text, text, text)
to service_role;
