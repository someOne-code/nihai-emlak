\set ON_ERROR_STOP on

-- Phase 3 / Task 3: authoritative checkout pricing must live in PostgreSQL/RPC

-- deterministic users
-- admin:  66666666-6666-4666-8666-666666666661
-- user:   66666666-6666-4666-8666-666666666662

-- deterministic listing
-- active listing: 77777777-6666-4666-8666-666666666661
-- sale listing:   77777777-6666-4666-8666-666666666662

-- deterministic main item ids
-- deposit:        88888888-6666-4666-8666-666666666661
-- first rent:     88888888-6666-4666-8666-666666666662
-- monthly fee:    88888888-6666-4666-8666-666666666663
-- inactive item:  88888888-6666-4666-8666-666666666664

-- deterministic service ids
-- cleaning:       99999999-6666-4666-8666-666666666661
-- transfer:       99999999-6666-4666-8666-666666666662

delete from auth.users
where id in (
  '66666666-6666-4666-8666-666666666661'::uuid,
  '66666666-6666-4666-8666-666666666662'::uuid
);

delete from public.listing_service_options
where id in (
  'aaaaaaaa-6666-4666-8666-666666666661'::uuid,
  'aaaaaaaa-6666-4666-8666-666666666662'::uuid
);

delete from public.service_catalog
where id in (
  '99999999-6666-4666-8666-666666666661'::uuid,
  '99999999-6666-4666-8666-666666666662'::uuid
);

delete from public.listing_main_item_options
where id in (
  'bbbbbbbb-6666-4666-8666-666666666661'::uuid,
  'bbbbbbbb-6666-4666-8666-666666666662'::uuid,
  'bbbbbbbb-6666-4666-8666-666666666663'::uuid,
  'bbbbbbbb-6666-4666-8666-666666666664'::uuid
);

delete from public.main_item_catalog
where id in (
  '88888888-6666-4666-8666-666666666661'::uuid,
  '88888888-6666-4666-8666-666666666662'::uuid,
  '88888888-6666-4666-8666-666666666663'::uuid,
  '88888888-6666-4666-8666-666666666664'::uuid
);

delete from public.listings
where id in (
  '77777777-6666-4666-8666-666666666661'::uuid,
  '77777777-6666-4666-8666-666666666662'::uuid
);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values
(
  '00000000-0000-0000-0000-000000000000',
  '66666666-6666-4666-8666-666666666661'::uuid,
  'authenticated',
  'authenticated',
  'phase3-quote-admin@example.com',
  crypt('test-password', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Phase3 Quote Admin'),
  now(),
  now(),
  '',
  '',
  '',
  ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '66666666-6666-4666-8666-666666666662'::uuid,
  'authenticated',
  'authenticated',
  'phase3-quote-user@example.com',
  crypt('test-password', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Phase3 Quote User'),
  now(),
  now(),
  '',
  '',
  '',
  ''
);

update public.profiles
set role = 'admin'
where id = '66666666-6666-4666-8666-666666666661'::uuid;

set role authenticated;
select set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666661', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

insert into public.listings (
  id,
  type,
  status,
  title,
  slug,
  city,
  price,
  currency
)
values (
  '77777777-6666-4666-8666-666666666661'::uuid,
  'rent',
  'active',
  'Phase3 Quote Listing',
  'phase3-quote-listing',
  'Istanbul',
  42000,
  'TRY'
),
(
  '77777777-6666-4666-8666-666666666662'::uuid,
  'sale',
  'active',
  'Phase3 Sale Listing',
  'phase3-sale-listing',
  'Izmir',
  42000,
  'TRY'
);

reset role;

insert into public.main_item_catalog (
  id,
  code,
  label,
  pricing_strategy,
  default_amount,
  default_multiplier,
  is_active,
  sort_order
)
values
(
  '88888888-6666-4666-8666-666666666661'::uuid,
  'deposit_q3',
  'Kapora Q3',
  'fixed',
  15000,
  null,
  true,
  1
),
(
  '88888888-6666-4666-8666-666666666662'::uuid,
  'first_rent_q3',
  'Bir Aylik Kira Q3',
  'listing_price_multiplier',
  null,
  1.0,
  true,
  2
),
(
  '88888888-6666-4666-8666-666666666663'::uuid,
  'monthly_fee_q3',
  'Aylik Hizmet Bedeli Q3',
  'stay_months_multiplier',
  null,
  1000,
  true,
  3
),
(
  '88888888-6666-4666-8666-666666666664'::uuid,
  'inactive_q3',
  'Pasif Kalem Q3',
  'fixed',
  999,
  null,
	  false,
	  4
	);

set role authenticated;
select set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666661', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

insert into public.listing_main_item_options (
  id,
  listing_id,
  main_item_id,
  override_label,
  override_amount,
  override_multiplier,
  is_enabled,
  sort_order
)
values
(
  'bbbbbbbb-6666-4666-8666-666666666661'::uuid,
  '77777777-6666-4666-8666-666666666661'::uuid,
  '88888888-6666-4666-8666-666666666661'::uuid,
  'Ilan Ozel Kapora',
  17000,
  null,
  true,
  1
),
(
  'bbbbbbbb-6666-4666-8666-666666666662'::uuid,
  '77777777-6666-4666-8666-666666666661'::uuid,
  '88888888-6666-4666-8666-666666666662'::uuid,
  null,
  null,
  null,
  true,
  2
),
(
  'bbbbbbbb-6666-4666-8666-666666666663'::uuid,
  '77777777-6666-4666-8666-666666666661'::uuid,
  '88888888-6666-4666-8666-666666666663'::uuid,
  null,
  null,
  null,
  true,
  3
),
(
  'bbbbbbbb-6666-4666-8666-666666666664'::uuid,
  '77777777-6666-4666-8666-666666666661'::uuid,
  '88888888-6666-4666-8666-666666666664'::uuid,
  null,
  null,
  null,
  true,
  4
);

reset role;

insert into public.service_catalog (
  id,
  code,
  name,
  base_price,
  is_active
)
values
(
  '99999999-6666-4666-8666-666666666661'::uuid,
  'cleaning_q3',
  'Temizlik',
  2500,
  true
),
(
  '99999999-6666-4666-8666-666666666662'::uuid,
  'transfer_q3',
  'Transfer',
  3000,
	  true
	);

set role authenticated;
select set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666661', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

insert into public.listing_service_options (
  id,
  listing_id,
  service_id,
  override_price,
  is_enabled
)
values
(
  'aaaaaaaa-6666-4666-8666-666666666661'::uuid,
  '77777777-6666-4666-8666-666666666661'::uuid,
  '99999999-6666-4666-8666-666666666661'::uuid,
  2200,
  true
),
(
  'aaaaaaaa-6666-4666-8666-666666666662'::uuid,
  '77777777-6666-4666-8666-666666666661'::uuid,
  '99999999-6666-4666-8666-666666666662'::uuid,
  null,
  true
);

select set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666662', false);

-- TEST 1: fixed + listing multiplier + stay multiplier + service override produce authoritative quote
-- Service request codes are normalized at the RPC boundary; catalog codes stay canonical.
do $$
declare
  v_quote jsonb;
  v_total numeric(12, 2);
  v_sum numeric(12, 2);
  v_item_count integer;
  v_deposit numeric(12, 2);
  v_first_rent numeric(12, 2);
  v_monthly_fee numeric(12, 2);
  v_cleaning numeric(12, 2);
begin
  v_quote := public.calculate_checkout_quote(
    '77777777-6666-4666-8666-666666666661'::uuid,
    array['deposit_q3', 'first_rent_q3', 'monthly_fee_q3'],
    array[' Cleaning_Q3 '],
    6
  );

  if v_quote->>'currency' <> 'TRY' then
    raise exception 'TEST 1 FAILED: expected TRY, got %', v_quote->>'currency';
  end if;

  v_total := (v_quote->>'total_amount')::numeric(12, 2);

  select count(*), coalesce(sum((item->>'amount')::numeric(12, 2)), 0)
  into v_item_count, v_sum
  from jsonb_array_elements(v_quote->'items') item;

  select (item->>'amount')::numeric(12, 2)
  into v_deposit
  from jsonb_array_elements(v_quote->'items') item
  where item->>'code' = 'deposit_q3';

  select (item->>'amount')::numeric(12, 2)
  into v_first_rent
  from jsonb_array_elements(v_quote->'items') item
  where item->>'code' = 'first_rent_q3';

  select (item->>'amount')::numeric(12, 2)
  into v_monthly_fee
  from jsonb_array_elements(v_quote->'items') item
  where item->>'code' = 'monthly_fee_q3';

  select (item->>'amount')::numeric(12, 2)
  into v_cleaning
  from jsonb_array_elements(v_quote->'items') item
  where item->>'code' = 'cleaning_q3';

  if v_item_count <> 4 then
    raise exception 'TEST 1 FAILED: expected 4 quote items, got %', v_item_count;
  end if;

  if v_deposit <> 17000 or v_first_rent <> 42000 or v_monthly_fee <> 6000 or v_cleaning <> 2200 then
    raise exception
      'TEST 1 FAILED: amount mismatch deposit=% first_rent=% monthly_fee=% cleaning=%',
      v_deposit, v_first_rent, v_monthly_fee, v_cleaning;
  end if;

  if v_total <> 67200 or v_total <> v_sum then
    raise exception 'TEST 1 FAILED: total mismatch total=% sum=%', v_total, v_sum;
  end if;
end;
$$;

-- TEST 2: service fallback uses base_price when override is null
do $$
declare
  v_quote jsonb;
  v_transfer numeric(12, 2);
begin
  v_quote := public.calculate_checkout_quote(
    '77777777-6666-4666-8666-666666666661'::uuid,
    array['deposit_q3'],
    array['transfer_q3'],
    6
  );

  select (item->>'amount')::numeric(12, 2)
  into v_transfer
  from jsonb_array_elements(v_quote->'items') item
  where item->>'code' = 'transfer_q3';

  if v_transfer <> 3000 then
    raise exception 'TEST 2 FAILED: expected transfer base_price fallback of 3000, got %', v_transfer;
  end if;
end;
$$;

-- TEST 3: duplicate service codes are rejected fail-closed
do $$
begin
  begin
    perform public.calculate_checkout_quote(
      '77777777-6666-4666-8666-666666666661'::uuid,
      array['deposit_q3'],
      array['cleaning_q3', 'cleaning_q3'],
      6
    );
    raise exception 'TEST 3 FAILED: duplicate service codes should have been rejected';
  exception
    when others then
      if position('duplicate service item codes' in SQLERRM) = 0 then
        raise;
      end if;
  end;
end;
$$;

reset role;

-- TEST 11: anonymous clients cannot execute checkout quote pricing directly.
-- Check the grant catalog instead of invoking the denied function as anon; local
-- Postgres can abort the backend process before PL/pgSQL catches that path.
do $$
begin
  if has_function_privilege(
    'anon',
    'public.calculate_checkout_quote(uuid, text[], text[], integer)',
    'EXECUTE'
  ) then
    raise exception 'TEST 11 FAILED: anon should not be allowed to execute checkout quote';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.calculate_checkout_quote(uuid, text[], text[], integer)',
    'EXECUTE'
  ) then
    raise exception 'TEST 11 FAILED: authenticated should be allowed to execute checkout quote';
  end if;
end;
$$;

select 'phase3_task3_checkout_quote_ok' as result;

-- TEST 4: inactive or invalid main items do not enter pricing
do $$
begin
  begin
    perform public.calculate_checkout_quote(
      '77777777-6666-4666-8666-666666666661'::uuid,
      array['inactive_q3'],
      array[]::text[],
      6
    );
    raise exception 'TEST 4 FAILED: inactive main item should have been rejected';
  exception
    when raise_exception then
      if position('main item is not enabled for listing' in SQLERRM) = 0 then
        raise;
      end if;
  end;
end;
$$;

-- TEST 5: quote requires at least one main item
do $$
begin
  begin
    perform public.calculate_checkout_quote(
      '77777777-6666-4666-8666-666666666661'::uuid,
      array[]::text[],
      array['cleaning_q3'],
      6
    );
    raise exception 'TEST 5 FAILED: service-only quote should have been rejected';
  exception
    when others then
      if position('main item selection is required' in SQLERRM) = 0 then
        raise;
      end if;
  end;
end;
$$;

-- TEST 6: blank or null main item codes are rejected fail-closed
do $$
begin
  begin
    perform public.calculate_checkout_quote(
      '77777777-6666-4666-8666-666666666661'::uuid,
      array['deposit_q3', ' ', null],
      array[]::text[],
      6
    );
    raise exception 'TEST 6 FAILED: blank or null main item codes should have been rejected';
  exception
    when others then
      if position('main item codes must not contain null or blank values' in SQLERRM) = 0 then
        raise;
      end if;
  end;
end;
$$;

-- TEST 7: blank or null service item codes are rejected fail-closed
do $$
begin
  begin
    perform public.calculate_checkout_quote(
      '77777777-6666-4666-8666-666666666661'::uuid,
      array['deposit_q3'],
      array['cleaning_q3', ' ', null],
      6
    );
    raise exception 'TEST 7 FAILED: blank or null service item codes should have been rejected';
  exception
    when others then
      if position('service item codes must not contain null or blank values' in SQLERRM) = 0 then
        raise;
      end if;
  end;
end;
$$;

-- TEST 8: sale listings cannot produce payable checkout quotes
do $$
begin
  begin
    perform public.calculate_checkout_quote(
      '77777777-6666-4666-8666-666666666662'::uuid,
      array['deposit_q3'],
      array[]::text[],
      6
    );
    raise exception 'TEST 8 FAILED: sale listing should have been rejected';
  exception
    when others then
      if position('listing is not available for checkout' in SQLERRM) = 0 then
        raise;
      end if;
  end;
end;
$$;

-- TEST 9: direct RPC calls enforce the same item count limit as the route parser
do $$
begin
  begin
    perform public.calculate_checkout_quote(
      '77777777-6666-4666-8666-666666666661'::uuid,
      array[
        'item_01', 'item_02', 'item_03', 'item_04', 'item_05',
        'item_06', 'item_07', 'item_08', 'item_09', 'item_10',
        'item_11', 'item_12', 'item_13', 'item_14', 'item_15',
        'item_16', 'item_17', 'item_18', 'item_19', 'item_20',
        'item_21'
      ],
      array[]::text[],
      6
    );
    raise exception 'TEST 9 FAILED: too many main item codes should have been rejected';
  exception
    when others then
      if position('main_items has too many items' in SQLERRM) = 0 then
        raise;
      end if;
  end;

  begin
    perform public.calculate_checkout_quote(
      '77777777-6666-4666-8666-666666666661'::uuid,
      array['deposit_q3'],
      array[
        'service_01', 'service_02', 'service_03', 'service_04', 'service_05',
        'service_06', 'service_07', 'service_08', 'service_09', 'service_10',
        'service_11', 'service_12', 'service_13', 'service_14', 'service_15',
        'service_16', 'service_17', 'service_18', 'service_19', 'service_20',
        'service_21'
      ],
      6
    );
    raise exception 'TEST 9 FAILED: too many service item codes should have been rejected';
  exception
    when others then
      if position('service_items has too many items' in SQLERRM) = 0 then
        raise;
      end if;
  end;
end;
$$;

-- TEST 10: direct RPC calls enforce item code length and format limits
do $$
begin
  begin
    perform public.calculate_checkout_quote(
      '77777777-6666-4666-8666-666666666661'::uuid,
      array[repeat('a', 65)],
      array[]::text[],
      6
    );
    raise exception 'TEST 10 FAILED: overlong main item code should have been rejected';
  exception
    when others then
      if position('main_items must contain valid item codes' in SQLERRM) = 0 then
        raise;
      end if;
  end;

  begin
    perform public.calculate_checkout_quote(
      '77777777-6666-4666-8666-666666666661'::uuid,
      array['deposit_q3'],
      array['cleaning.v2'],
      6
    );
    raise exception 'TEST 10 FAILED: parser-incompatible service item code should have been rejected';
  exception
    when others then
      if position('service_items must contain valid item codes' in SQLERRM) = 0 then
        raise;
      end if;
  end;
end;
$$;
