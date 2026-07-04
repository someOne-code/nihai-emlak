\set ON_ERROR_STOP on

-- Advisor contract: keep known RLS policies aligned with Supabase performance
-- recommendations. These checks mirror the dashboard lints that report
-- auth_rls_initplan and multiple_permissive_policies warnings.

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

      if v_expression ~ 'public\.is_admin\s*\(' then
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

select 'rls_advisor_warnings_ok' as result;
