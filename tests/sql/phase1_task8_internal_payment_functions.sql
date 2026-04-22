\set ON_ERROR_STOP on

-- Phase 1 / Task 8 hardening:
-- Critical payment SECURITY DEFINER functions should live in internal schema.

do $$
declare
  v_internal_register_exists boolean;
  v_internal_process_exists boolean;
  v_public_register_exists boolean;
  v_public_process_exists boolean;
  v_internal_register_definer boolean;
  v_internal_process_definer boolean;
  v_public_register_definer boolean;
  v_public_process_definer boolean;
begin
  select exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'internal'
      and p.proname = 'register_payment_callback_receipt'
  ) into v_internal_register_exists;

  select exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'internal'
      and p.proname = 'process_payment_checkout'
  ) into v_internal_process_exists;

  select exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'register_payment_callback_receipt'
  ) into v_public_register_exists;

  select exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'process_payment_checkout'
  ) into v_public_process_exists;

  if not v_internal_register_exists or not v_internal_process_exists then
    raise exception
      'Expected internal schema payment functions. register=% process=%',
      v_internal_register_exists, v_internal_process_exists;
  end if;

  if not v_public_register_exists or not v_public_process_exists then
    raise exception
      'Expected public wrappers for payment functions. register=% process=%',
      v_public_register_exists, v_public_process_exists;
  end if;

  select p.prosecdef
  into v_internal_register_definer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'internal'
    and p.proname = 'register_payment_callback_receipt'
  limit 1;

  select p.prosecdef
  into v_internal_process_definer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'internal'
    and p.proname = 'process_payment_checkout'
  limit 1;

  select p.prosecdef
  into v_public_register_definer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'register_payment_callback_receipt'
  limit 1;

  select p.prosecdef
  into v_public_process_definer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'process_payment_checkout'
  limit 1;

  if v_internal_register_definer is not true or v_internal_process_definer is not true then
    raise exception
      'Expected internal payment functions to remain SECURITY DEFINER. register=% process=%',
      v_internal_register_definer, v_internal_process_definer;
  end if;

  if v_public_register_definer is not false or v_public_process_definer is not false then
    raise exception
      'Expected public wrappers to be SECURITY INVOKER. register=% process=%',
      v_public_register_definer, v_public_process_definer;
  end if;
end;
$$;

do $$
begin
  if has_schema_privilege('anon', 'internal', 'USAGE') then
    raise exception 'anon must not have USAGE on internal schema';
  end if;

  if has_schema_privilege('authenticated', 'internal', 'USAGE') then
    raise exception 'authenticated must not have USAGE on internal schema';
  end if;

  if not has_schema_privilege('service_role', 'internal', 'USAGE') then
    raise exception 'service_role must have USAGE on internal schema';
  end if;
end;
$$;

do $$
begin
  if has_function_privilege(
    'anon',
    'public.register_payment_callback_receipt(text, text, text, text)',
    'EXECUTE'
  ) then
    raise exception 'anon must not execute public.register_payment_callback_receipt';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.register_payment_callback_receipt(text, text, text, text)',
    'EXECUTE'
  ) then
    raise exception 'authenticated must not execute public.register_payment_callback_receipt';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.register_payment_callback_receipt(text, text, text, text)',
    'EXECUTE'
  ) then
    raise exception 'service_role must execute public.register_payment_callback_receipt';
  end if;

  if has_function_privilege(
    'anon',
    'public.process_payment_checkout(uuid, text, text, jsonb)',
    'EXECUTE'
  ) then
    raise exception 'anon must not execute public.process_payment_checkout';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.process_payment_checkout(uuid, text, text, jsonb)',
    'EXECUTE'
  ) then
    raise exception 'authenticated must not execute public.process_payment_checkout';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.process_payment_checkout(uuid, text, text, jsonb)',
    'EXECUTE'
  ) then
    raise exception 'service_role must execute public.process_payment_checkout';
  end if;

  if has_function_privilege(
    'anon',
    'internal.register_payment_callback_receipt(text, text, text, text)',
    'EXECUTE'
  ) then
    raise exception 'anon must not execute internal.register_payment_callback_receipt';
  end if;

  if has_function_privilege(
    'authenticated',
    'internal.register_payment_callback_receipt(text, text, text, text)',
    'EXECUTE'
  ) then
    raise exception 'authenticated must not execute internal.register_payment_callback_receipt';
  end if;

  if not has_function_privilege(
    'service_role',
    'internal.register_payment_callback_receipt(text, text, text, text)',
    'EXECUTE'
  ) then
    raise exception 'service_role must execute internal.register_payment_callback_receipt';
  end if;

  if has_function_privilege(
    'anon',
    'internal.process_payment_checkout(uuid, text, text, jsonb)',
    'EXECUTE'
  ) then
    raise exception 'anon must not execute internal.process_payment_checkout';
  end if;

  if has_function_privilege(
    'authenticated',
    'internal.process_payment_checkout(uuid, text, text, jsonb)',
    'EXECUTE'
  ) then
    raise exception 'authenticated must not execute internal.process_payment_checkout';
  end if;

  if not has_function_privilege(
    'service_role',
    'internal.process_payment_checkout(uuid, text, text, jsonb)',
    'EXECUTE'
  ) then
    raise exception 'service_role must execute internal.process_payment_checkout';
  end if;
end;
$$;

select 'phase1_task8_internal_payment_functions_ok' as result;
