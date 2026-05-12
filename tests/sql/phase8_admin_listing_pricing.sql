\set ON_ERROR_STOP on

-- Phase 8.4: admin listing main item and service pricing config RPC tests.
-- Contract: docs/ADMIN_LISTING_CONFIG_CONTRACT.md

-- deterministic ids
-- admin user:    aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb800
-- regular user:  aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb801
-- listing:       cccccccc-dddd-4ddd-8ddd-ddddddddd801 (sale passive)
-- main item cat: bbbbbbbb-cccc-4ccc-8ccc-ccccccccc801 (phase8_main)
-- service cat:   dddddddd-eeee-4eee-8eee-eeeeeeeee801 (phase8_service)

-- ----------------------------------------------------------------------------
-- cleanup (idempotent)
-- ----------------------------------------------------------------------------
delete from public.listing_main_item_options
where listing_id = 'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid;

delete from public.listing_service_options
where listing_id = 'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid;

delete from public.service_catalog
where id = 'dddddddd-eeee-4eee-8eee-eeeeeeeee801'::uuid
   or code = 'phase8_service';

-- ----------------------------------------------------------------------------
-- seed service catalog entry
-- ----------------------------------------------------------------------------
insert into public.service_catalog (
  id, code, name, base_price, is_active
)
values (
  'dddddddd-eeee-4eee-8eee-eeeeeeeee801'::uuid,
  'phase8_service',
  'Phase 8 Service',
  500,
  true
);

-- ----------------------------------------------------------------------------
-- set admin context
-- ----------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb800', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

-- ----------------------------------------------------------------------------
-- 1) admin_configure_listing_main_item: enable a main item (upsert create)
-- ----------------------------------------------------------------------------
do $$
declare
  v_result jsonb;
begin
  v_result := public.admin_configure_listing_main_item(
    'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
    'phase8_main',
    jsonb_build_object(
      'is_enabled', true,
      'sort_order', 1
    )
  );

  if (v_result ->> 'is_enabled')::boolean is not true then
    raise exception 'Main item should be enabled: %', v_result;
  end if;
  if (v_result ->> 'code') <> 'phase8_main' then
    raise exception 'Code mismatch: %', v_result;
  end if;
  if (v_result ->> 'sort_order')::integer <> 1 then
    raise exception 'Sort order mismatch: %', v_result;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2) admin_configure_listing_main_item: disable a main item (upsert update)
-- ----------------------------------------------------------------------------
do $$
declare
  v_result jsonb;
begin
  v_result := public.admin_configure_listing_main_item(
    'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
    'phase8_main',
    jsonb_build_object('is_enabled', false)
  );

  if (v_result ->> 'is_enabled')::boolean is not false then
    raise exception 'Main item should be disabled: %', v_result;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3) admin_configure_listing_main_item: override label and amount
-- ----------------------------------------------------------------------------
do $$
declare
  v_result jsonb;
begin
  v_result := public.admin_configure_listing_main_item(
    'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
    'phase8_main',
    jsonb_build_object(
      'is_enabled', true,
      'override_label', 'Custom Label',
      'override_amount', 1500
    )
  );

  if (v_result ->> 'override_label') <> 'Custom Label' then
    raise exception 'Override label mismatch: %', v_result;
  end if;
  if (v_result ->> 'override_amount')::numeric <> 1500 then
    raise exception 'Override amount mismatch: %', v_result;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3b) admin_configure_listing_main_item: clear override_label back to null
-- ----------------------------------------------------------------------------
do $$
declare
  v_result jsonb;
begin
  v_result := public.admin_configure_listing_main_item(
    'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
    'phase8_main',
    jsonb_build_object(
      'is_enabled', true,
      'override_label', ''
    )
  );

  if v_result ? 'override_label' and v_result ->> 'override_label' is not null then
    raise exception 'Override label should clear to null, got %', v_result ->> 'override_label';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4) admin_configure_listing_main_item: rejects negative override_amount
-- ----------------------------------------------------------------------------
do $$
begin
  begin
    perform public.admin_configure_listing_main_item(
      'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
      'phase8_main',
      jsonb_build_object(
        'is_enabled', true,
        'override_amount', -1
      )
    );
    raise exception 'Negative override amount unexpectedly succeeded';
  exception
    when others then
      if sqlstate <> '22023' then
        raise;
      end if;
  end;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5) admin_configure_listing_main_item: rejects negative override_multiplier
-- ----------------------------------------------------------------------------
do $$
begin
  begin
    perform public.admin_configure_listing_main_item(
      'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
      'phase8_main',
      jsonb_build_object(
        'is_enabled', true,
        'override_multiplier', -0.5
      )
    );
    raise exception 'Negative override multiplier unexpectedly succeeded';
  exception
    when others then
      if sqlstate <> '22023' then
        raise;
      end if;
  end;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6) admin_configure_listing_main_item: override-only payload preserves is_enabled
-- ----------------------------------------------------------------------------
do $$
declare
  v_result jsonb;
begin
  v_result := public.admin_configure_listing_main_item(
    'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
    'phase8_main',
    jsonb_build_object('override_label', 'test')
  );

  if (v_result ->> 'is_enabled')::boolean is not true then
    raise exception 'Override-only main item payload should preserve is_enabled: %', v_result;
  end if;

  if (v_result ->> 'override_label') <> 'test' then
    raise exception 'Override-only main item payload should update override_label: %', v_result;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6b) admin_configure_listing_main_item: missing row without is_enabled defaults true
-- ----------------------------------------------------------------------------
do $$
declare
  v_result jsonb;
begin
  delete from public.listing_main_item_options
  where listing_id = 'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid
    and main_item_id = 'bbbbbbbb-cccc-4ccc-8ccc-ccccccccc801'::uuid;

  v_result := public.admin_configure_listing_main_item(
    'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
    'phase8_main',
    jsonb_build_object('override_amount', 1500)
  );

  if (v_result ->> 'is_enabled')::boolean is not true then
    raise exception 'New main item without is_enabled should default true: %', v_result;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6c) admin_configure_listing_main_item: rejects invalid is_enabled
-- ----------------------------------------------------------------------------
do $$
begin
  begin
    perform public.admin_configure_listing_main_item(
      'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
      'phase8_main',
      jsonb_build_object('is_enabled', 'not-a-boolean')
    );
    raise exception 'Invalid is_enabled unexpectedly succeeded';
  exception
    when others then
      if sqlstate <> '22023' then
        raise;
      end if;
  end;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7) admin_configure_listing_main_item: rejects non-existent catalog code (P0002)
-- ----------------------------------------------------------------------------
do $$
begin
  begin
    perform public.admin_configure_listing_main_item(
      'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
      'nonexistent_code',
      jsonb_build_object('is_enabled', true)
    );
    raise exception 'Non-existent code unexpectedly succeeded';
  exception
    when others then
      if sqlstate <> 'P0002' then
        raise;
      end if;
  end;
end;
$$;

-- ----------------------------------------------------------------------------
-- 8) admin_configure_listing_main_item: rejects non-existent listing (P0002)
-- ----------------------------------------------------------------------------
do $$
begin
  begin
    perform public.admin_configure_listing_main_item(
      'cccccccc-dddd-4ddd-8ddd-dddddddddd99'::uuid,
      'phase8_main',
      jsonb_build_object('is_enabled', true)
    );
    raise exception 'Non-existent listing unexpectedly succeeded';
  exception
    when others then
      if sqlstate <> 'P0002' then
        raise;
      end if;
  end;
end;
$$;

-- ----------------------------------------------------------------------------
-- 9) admin_configure_listing_service: enable a service (upsert create)
-- ----------------------------------------------------------------------------
do $$
declare
  v_result jsonb;
begin
  v_result := public.admin_configure_listing_service(
    'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
    'phase8_service',
    jsonb_build_object('is_enabled', true)
  );

  if (v_result ->> 'is_enabled')::boolean is not true then
    raise exception 'Service should be enabled: %', v_result;
  end if;
  if (v_result ->> 'code') <> 'phase8_service' then
    raise exception 'Code mismatch: %', v_result;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 10) admin_configure_listing_service: disable a service (upsert update)
-- ----------------------------------------------------------------------------
do $$
declare
  v_result jsonb;
begin
  v_result := public.admin_configure_listing_service(
    'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
    'phase8_service',
    jsonb_build_object('is_enabled', false)
  );

  if (v_result ->> 'is_enabled')::boolean is not false then
    raise exception 'Service should be disabled: %', v_result;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 11) admin_configure_listing_service: override price
-- ----------------------------------------------------------------------------
do $$
declare
  v_result jsonb;
begin
  v_result := public.admin_configure_listing_service(
    'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
    'phase8_service',
    jsonb_build_object(
      'is_enabled', true,
      'override_price', 750
    )
  );

  if (v_result ->> 'override_price')::numeric <> 750 then
    raise exception 'Override price mismatch: %', v_result;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 12) admin_configure_listing_service: override-only payload preserves is_enabled
-- ----------------------------------------------------------------------------
do $$
declare
  v_result jsonb;
begin
  v_result := public.admin_configure_listing_service(
    'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
    'phase8_service',
    jsonb_build_object('override_price', 250)
  );

  if (v_result ->> 'is_enabled')::boolean is not true then
    raise exception 'Override-only service payload should preserve is_enabled: %', v_result;
  end if;

  if (v_result ->> 'override_price')::numeric <> 250 then
    raise exception 'Override-only service payload should update override_price: %', v_result;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 12b) admin_configure_listing_service: missing row without is_enabled defaults true
-- ----------------------------------------------------------------------------
do $$
declare
  v_result jsonb;
begin
  delete from public.listing_service_options
  where listing_id = 'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid
    and service_id = 'dddddddd-eeee-4eee-8eee-eeeeeeeee801'::uuid;

  v_result := public.admin_configure_listing_service(
    'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
    'phase8_service',
    jsonb_build_object('override_price', 300)
  );

  if (v_result ->> 'is_enabled')::boolean is not true then
    raise exception 'New service without is_enabled should default true: %', v_result;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 12c) admin_configure_listing_service: rejects invalid is_enabled
-- ----------------------------------------------------------------------------
do $$
begin
  begin
    perform public.admin_configure_listing_service(
      'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
      'phase8_service',
      jsonb_build_object('is_enabled', 'not-a-boolean')
    );
    raise exception 'Invalid service is_enabled unexpectedly succeeded';
  exception
    when others then
      if sqlstate <> '22023' then
        raise;
      end if;
  end;
end;
$$;

-- ----------------------------------------------------------------------------
-- 13) admin_configure_listing_service: rejects negative override_price
-- ----------------------------------------------------------------------------
do $$
begin
  begin
    perform public.admin_configure_listing_service(
      'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
      'phase8_service',
      jsonb_build_object(
        'is_enabled', true,
        'override_price', -1
      )
    );
    raise exception 'Negative override price unexpectedly succeeded';
  exception
    when others then
      if sqlstate <> '22023' then
        raise;
      end if;
  end;
end;
$$;

-- ----------------------------------------------------------------------------
-- 14) admin_configure_listing_service: rejects non-existent catalog code (P0002)
-- ----------------------------------------------------------------------------
do $$
begin
  begin
    perform public.admin_configure_listing_service(
      'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
      'nonexistent_service',
      jsonb_build_object('is_enabled', true)
    );
    raise exception 'Non-existent service code unexpectedly succeeded';
  exception
    when others then
      if sqlstate <> 'P0002' then
        raise;
      end if;
  end;
end;
$$;

-- ----------------------------------------------------------------------------
-- 14b) admin_configure_listing_service: rejects when no enabled main item (P0004)
-- ----------------------------------------------------------------------------
do $$
begin
  -- Temporarily remove the main item to verify the service guard.
  delete from public.listing_service_options
  where listing_id = 'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid;
  delete from public.listing_main_item_options
  where listing_id = 'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid;

  begin
    perform public.admin_configure_listing_service(
      'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
      'phase8_service',
      jsonb_build_object('is_enabled', true)
    );
    raise exception 'Service config without main item unexpectedly succeeded';
  exception
    when sqlstate 'P0004' then
      null; -- expected: WHEN OTHERS does not catch assert_failure (P0004)
  end;

  -- Restore the main item for subsequent tests.
  perform public.admin_configure_listing_main_item(
    'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
    'phase8_main',
    jsonb_build_object('is_enabled', true)
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 14c) admin_listing_is_checkout_ready: true with main item only (no service needed)
-- ----------------------------------------------------------------------------
do $$
declare
  v_ready boolean;
begin
  -- Ensure main item exists but no service options.
  delete from public.listing_service_options
  where listing_id = 'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid;

  v_ready := public.admin_listing_is_checkout_ready(
    'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid
  );

  if not v_ready then
    raise exception 'Listing with main item but no services should be checkout-ready';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 14d) admin_listing_is_checkout_ready: false without main item
-- ----------------------------------------------------------------------------
do $$
declare
  v_ready boolean;
begin
  delete from public.listing_main_item_options
  where listing_id = 'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid;

  v_ready := public.admin_listing_is_checkout_ready(
    'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid
  );

  if v_ready then
    raise exception 'Listing without main item should NOT be checkout-ready';
  end if;

  -- Restore the main item for subsequent tests.
  perform public.admin_configure_listing_main_item(
    'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
    'phase8_main',
    jsonb_build_object('is_enabled', true)
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 15) regular user is rejected by admin_configure_listing_main_item (42501)
-- ----------------------------------------------------------------------------
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb801', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
begin
  begin
    perform public.admin_configure_listing_main_item(
      'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
      'phase8_main',
      jsonb_build_object('is_enabled', true)
    );
    raise exception 'Regular user unexpectedly allowed to configure main item';
  exception
    when insufficient_privilege then
      null;
    when others then
      if sqlstate <> '42501' then
        raise;
      end if;
  end;
end;
$$;

-- ----------------------------------------------------------------------------
-- 16) regular user is rejected by admin_configure_listing_service (42501)
-- ----------------------------------------------------------------------------
do $$
begin
  begin
    perform public.admin_configure_listing_service(
      'cccccccc-dddd-4ddd-8ddd-ddddddddd801'::uuid,
      'phase8_service',
      jsonb_build_object('is_enabled', true)
    );
    raise exception 'Regular user unexpectedly allowed to configure service';
  exception
    when insufficient_privilege then
      null;
    when others then
      if sqlstate <> '42501' then
        raise;
      end if;
  end;
end;
$$;

reset role;
