\set ON_ERROR_STOP on

-- Phase 7.1: Chatwoot conversation mapping contract.

-- deterministic users
-- admin:  aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb701
-- user 1: aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb702
-- user 2: aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb703

-- deterministic listings
-- active 1:  cccccccc-dddd-4ddd-8ddd-ddddddddd701
-- active 2:  cccccccc-dddd-4ddd-8ddd-ddddddddd702
-- passive:   cccccccc-dddd-4ddd-8ddd-ddddddddd703

delete from public.chatwoot_conversations
where user_id in (
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb701'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb702'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb703'::uuid
)
or listing_id in (
  'cccccccc-dddd-4ddd-8ddd-ddddddddd701'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd702'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd703'::uuid
);

delete from public.listings
where id in (
  'cccccccc-dddd-4ddd-8ddd-ddddddddd701'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd702'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd703'::uuid
);

delete from auth.users
where id in (
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb701'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb702'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb703'::uuid
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
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb701'::uuid,
  'authenticated',
  'authenticated',
  'phase7-admin@example.com',
  crypt('test-password', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Phase7 Admin'),
  now(),
  now(),
  '',
  '',
  '',
  ''
),
(
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb702'::uuid,
  'authenticated',
  'authenticated',
  'phase7-user1@example.com',
  crypt('test-password', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Phase7 User 1'),
  now(),
  now(),
  '',
  '',
  '',
  ''
),
(
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb703'::uuid,
  'authenticated',
  'authenticated',
  'phase7-user2@example.com',
  crypt('test-password', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Phase7 User 2'),
  now(),
  now(),
  '',
  '',
  '',
  ''
);

update public.profiles
set role = 'admin'
where id = 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb701'::uuid;

insert into public.listings (
  id,
  type,
  status,
  title,
  slug,
  city,
  district,
  price,
  currency
)
values
(
  'cccccccc-dddd-4ddd-8ddd-ddddddddd701'::uuid,
  'rent',
  'active',
  'Phase 7 Active Listing 1',
  'phase-7-active-listing-1',
  'Istanbul',
  'Kadikoy',
  42000,
  'TRY'
),
(
  'cccccccc-dddd-4ddd-8ddd-ddddddddd702'::uuid,
  'rent',
  'active',
  'Phase 7 Active Listing 2',
  'phase-7-active-listing-2',
  'Istanbul',
  'Sisli',
  39000,
  'TRY'
),
(
  'cccccccc-dddd-4ddd-8ddd-ddddddddd703'::uuid,
  'rent',
  'passive',
  'Phase 7 Passive Listing',
  'phase-7-passive-listing',
  'Istanbul',
  'Besiktas',
  30000,
  'TRY'
);

set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb702', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
declare
  v_first record;
  v_second record;
  v_other_listing record;
begin
  select * into v_first
  from public.claim_chatwoot_conversation('cccccccc-dddd-4ddd-8ddd-ddddddddd701'::uuid);

  if v_first.result <> 'claimed' or v_first.status <> 'provisioning' then
    raise exception 'Expected first claim to provision, got result %, status %', v_first.result, v_first.status;
  end if;

  select * into v_second
  from public.claim_chatwoot_conversation('cccccccc-dddd-4ddd-8ddd-ddddddddd701'::uuid);

  if v_second.conversation_id <> v_first.conversation_id then
    raise exception 'Same user + listing should return the same mapping';
  end if;

  if v_second.result <> 'in_progress' then
    raise exception 'Fresh provisioning should block duplicate creation, got %', v_second.result;
  end if;

  select * into v_other_listing
  from public.claim_chatwoot_conversation('cccccccc-dddd-4ddd-8ddd-ddddddddd702'::uuid);

  if v_other_listing.conversation_id = v_first.conversation_id then
    raise exception 'Different listing should create a different mapping';
  end if;
end;
$$;

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.chatwoot_conversations;
  if v_count <> 2 then
    raise exception 'User should see exactly own 2 mappings, got %', v_count;
  end if;
end;
$$;

do $$
begin
  begin
    insert into public.chatwoot_conversations (user_id, listing_id)
    values (
      'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb702'::uuid,
      'cccccccc-dddd-4ddd-8ddd-ddddddddd701'::uuid
    );

    raise exception 'Direct authenticated insert unexpectedly succeeded';
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

do $$
begin
  begin
    perform public.claim_chatwoot_conversation('cccccccc-dddd-4ddd-8ddd-ddddddddd703'::uuid);
    raise exception 'Passive listing claim unexpectedly succeeded';
  exception
    when invalid_parameter_value then
      null;
    when others then
      if sqlstate <> '22023' then
        raise;
      end if;
  end;
end;
$$;

reset role;

alter table public.chatwoot_conversations disable trigger trg_chatwoot_conversations_set_updated_at;
update public.chatwoot_conversations
set updated_at = now() - interval '10 minutes'
where user_id = 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb702'::uuid
  and listing_id = 'cccccccc-dddd-4ddd-8ddd-ddddddddd701'::uuid;
alter table public.chatwoot_conversations enable trigger trg_chatwoot_conversations_set_updated_at;

set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb702', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
declare
  v_claim record;
  v_complete record;
  v_ready record;
begin
  select * into v_claim
  from public.claim_chatwoot_conversation('cccccccc-dddd-4ddd-8ddd-ddddddddd701'::uuid);

  if v_claim.result <> 'claimed' then
    raise exception 'Stale provisioning should be reclaimable, got %', v_claim.result;
  end if;

  select * into v_complete
  from public.complete_chatwoot_conversation_claim(
    v_claim.conversation_id,
    'contact-source-701',
    '98701'
  );

  if v_complete.status <> 'ready' or v_complete.chatwoot_source_id <> 'contact-source-701' then
    raise exception 'Complete claim failed';
  end if;

  select * into v_ready
  from public.claim_chatwoot_conversation('cccccccc-dddd-4ddd-8ddd-ddddddddd701'::uuid);

  if v_ready.result <> 'ready' or v_ready.chatwoot_conversation_id <> '98701' then
    raise exception 'Ready mapping should return without new provisioning';
  end if;
end;
$$;

do $$
declare
  v_claim record;
  v_failed record;
  v_reclaimed record;
begin
  select * into v_claim
  from public.claim_chatwoot_conversation('cccccccc-dddd-4ddd-8ddd-ddddddddd702'::uuid);

  select * into v_failed
  from public.mark_chatwoot_conversation_claim_failed(
    v_claim.conversation_id,
    repeat('provider detail ', 40)
  );

  if v_failed.status <> 'failed' or length(v_failed.failure_reason) > 200 then
    raise exception 'Failed claim should store sanitized bounded failure reason';
  end if;

  select * into v_reclaimed
  from public.claim_chatwoot_conversation('cccccccc-dddd-4ddd-8ddd-ddddddddd702'::uuid);

  if v_reclaimed.result <> 'claimed' or v_reclaimed.status <> 'provisioning' or v_reclaimed.failure_reason is not null then
    raise exception 'Failed mapping should be reclaimable and clear failure state';
  end if;
end;
$$;

reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb703', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
declare
  v_user2_claim record;
  v_visible integer;
begin
  select * into v_user2_claim
  from public.claim_chatwoot_conversation('cccccccc-dddd-4ddd-8ddd-ddddddddd701'::uuid);

  if v_user2_claim.result <> 'claimed' then
    raise exception 'Different user should get separate claim, got %', v_user2_claim.result;
  end if;

  select count(*) into v_visible from public.chatwoot_conversations;
  if v_visible <> 1 then
    raise exception 'User 2 should see only own mapping, got %', v_visible;
  end if;
end;
$$;

reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb701', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
declare
  v_admin_visible integer;
begin
  select count(*) into v_admin_visible from public.chatwoot_conversations;
  if v_admin_visible <> 3 then
    raise exception 'Admin should see all 3 mappings, got %', v_admin_visible;
  end if;
end;
$$;

reset role;

delete from auth.users
where id in (
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb701'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb702'::uuid,
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb703'::uuid
);

delete from public.listings
where id in (
  'cccccccc-dddd-4ddd-8ddd-ddddddddd701'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd702'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd703'::uuid
);

select 'phase7_chatwoot_conversations_ok' as result;
