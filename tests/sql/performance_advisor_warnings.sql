\set ON_ERROR_STOP on

-- Supabase performance advisor warnings covered by this contract:
-- auth_rls_init_plan_public_profiles_profiles_select_own_or_admin
-- auth_rls_init_plan_public_profiles_profiles_update_own
-- auth_rls_init_plan_public_reservation_intake_reservation_intake_select_own_or_admin
-- auth_rls_init_plan_public_chatwoot_conversations_chatwoot_conversations_select_own_or_admin
-- auth_rls_init_plan_public_sale_lead_events_sale_lead_events_select_own_or_admin
-- auth_rls_init_plan_public_sale_leads_sale_leads_insert_own_sale_listing
-- auth_rls_init_plan_public_sale_leads_sale_leads_select_own_or_admin
-- multiple_permissive_policies_public_consultants_authenticated_SELECT
-- multiple_permissive_policies_public_listing_images_authenticated_SELECT
-- multiple_permissive_policies_public_listing_main_item_options_authenticated_SELECT
-- multiple_permissive_policies_public_listing_service_options_authenticated_SELECT
-- multiple_permissive_policies_public_listings_authenticated_SELECT

do $$
declare
  v_policy record;
  v_expression text;
begin
  for v_policy in
    select *
    from pg_policies
    where schemaname = 'public'
      and (
        (tablename = 'profiles' and policyname in (
          'profiles_select_own_or_admin',
          'profiles_update_own'
        ))
        or (tablename = 'reservation_intake' and policyname = 'reservation_intake_select_own_or_admin')
        or (tablename = 'chatwoot_conversations' and policyname = 'chatwoot_conversations_select_own_or_admin')
        or (tablename = 'sale_leads' and policyname in (
          'sale_leads_select_own_or_admin',
          'sale_leads_insert_own_sale_listing'
        ))
        or (tablename = 'sale_lead_events' and policyname = 'sale_lead_events_select_own_or_admin')
      )
  loop
    foreach v_expression in array array[
      coalesce(v_policy.qual, ''),
      coalesce(v_policy.with_check, '')
    ]
    loop
      v_expression := lower(v_expression);
      v_expression := regexp_replace(
        v_expression,
        '\(\s*select\s+auth\.uid\s*\(\s*\)(\s+as\s+\w+)?\s*\)',
        '',
        'g'
      );
      v_expression := regexp_replace(
        v_expression,
        '\(\s*select\s+public\.is_admin\s*\(\s*\)(\s+as\s+\w+)?\s*\)',
        '',
        'g'
      );

      if v_expression ~ 'auth\.uid\s*\(' then
        raise exception 'Policy %.% still calls auth.uid() without select wrapper',
          v_policy.tablename,
          v_policy.policyname;
      end if;

      if v_expression ~ 'public\.is_admin\s*\(' or v_expression ~ '\bis_admin\s*\(' then
        raise exception 'Policy %.% still calls public.is_admin() without select wrapper',
          v_policy.tablename,
          v_policy.policyname;
      end if;
    end loop;
  end loop;
end;
$$;

do $$
declare
  v_table_name text;
  v_policy_count integer;
begin
  foreach v_table_name in array array[
    'consultants',
    'listing_images',
    'listing_main_item_options',
    'listing_service_options',
    'listings'
  ]
  loop
    select count(*)
    into v_policy_count
    from pg_policies
    where schemaname = 'public'
      and tablename = v_table_name
      and cmd in ('SELECT', 'ALL')
      and 'authenticated' = any(roles)
      and permissive = 'PERMISSIVE';

    if v_policy_count <> 1 then
      raise exception 'Table public.% must have exactly one permissive authenticated SELECT policy, got %',
        v_table_name,
        v_policy_count;
    end if;
  end loop;
end;
$$;

do $$
declare
  v_table_name text;
  v_policy_prefix text;
  v_insert_count integer;
  v_update_count integer;
  v_delete_count integer;
begin
  for v_table_name, v_policy_prefix in
    values
      ('consultants', 'consultants_admin'),
      ('listing_images', 'listing_images_admin'),
      ('listing_main_item_options', 'listing_main_item_options_admin'),
      ('listing_service_options', 'listing_service_options_admin'),
      ('listings', 'listings_admin')
  loop
    select count(*)
    into v_insert_count
    from pg_policies
    where schemaname = 'public'
      and tablename = v_table_name
      and policyname = v_policy_prefix || '_insert'
      and cmd = 'INSERT'
      and 'authenticated' = any(roles)
      and coalesce(with_check, '') like '%is_admin()%';

    select count(*)
    into v_update_count
    from pg_policies
    where schemaname = 'public'
      and tablename = v_table_name
      and policyname = v_policy_prefix || '_update'
      and cmd = 'UPDATE'
      and 'authenticated' = any(roles)
      and coalesce(qual, '') like '%is_admin()%'
      and coalesce(with_check, '') like '%is_admin()%';

    select count(*)
    into v_delete_count
    from pg_policies
    where schemaname = 'public'
      and tablename = v_table_name
      and policyname = v_policy_prefix || '_delete'
      and cmd = 'DELETE'
      and 'authenticated' = any(roles)
      and coalesce(qual, '') like '%is_admin()%';

    if v_insert_count <> 1 or v_update_count <> 1 or v_delete_count <> 1 then
      raise exception 'Table public.% must keep one admin insert/update/delete policy, got insert %, update %, delete %',
        v_table_name,
        v_insert_count,
        v_update_count,
        v_delete_count;
    end if;
  end loop;
end;
$$;

do $$
declare
  v_missing text;
begin
  with expected_policies(table_name, policy_name) as (
    values
      ('consultants', 'consultants_public_read_active'),
      ('listing_images', 'listing_images_public_read_active_listings'),
      ('listing_main_item_options', 'listing_main_item_options_public_read_active'),
      ('listing_service_options', 'listing_service_options_public_read_active'),
      ('listings', 'listings_public_read_active')
  )
  select string_agg(table_name || '.' || policy_name, ', ' order by table_name, policy_name)
  into v_missing
  from expected_policies e
  where not exists (
    select 1
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = e.table_name
      and p.policyname = e.policy_name
      and p.cmd = 'SELECT'
      and p.roles = array['anon']::name[]
  );

  if v_missing is not null then
    raise exception 'Missing anon-only public read policies: %', v_missing;
  end if;
end;
$$;

select 'performance_advisor_warnings_ok' as result;
