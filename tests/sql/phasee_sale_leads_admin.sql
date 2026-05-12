\set ON_ERROR_STOP on

-- Phase E: sale leads admin contract.
-- Verifies sale-only creation, RLS ownership, admin read access, audited
-- status transitions, and direct status update denial.

-- deterministic ids
-- owner:     eeee0001-0001-4001-8001-000000000001
-- admin:     eeee0001-0001-4001-8001-000000000002
-- other:     eeee0001-0001-4001-8001-000000000003
-- sale:      eeee0001-0001-4001-8001-100000000001
-- rent:      eeee0001-0001-4001-8001-100000000002

reset role;

delete from public.sale_lead_events
where lead_id in (
  select id from public.sale_leads
  where user_id in (
    'eeee0001-0001-4001-8001-000000000001'::uuid,
    'eeee0001-0001-4001-8001-000000000003'::uuid
  )
);
delete from public.sale_leads
where user_id in (
  'eeee0001-0001-4001-8001-000000000001'::uuid,
  'eeee0001-0001-4001-8001-000000000003'::uuid
);
delete from public.listings
where id in (
  'eeee0001-0001-4001-8001-100000000001'::uuid,
  'eeee0001-0001-4001-8001-100000000002'::uuid
);
delete from auth.users
where id in (
  'eeee0001-0001-4001-8001-000000000001'::uuid,
  'eeee0001-0001-4001-8001-000000000002'::uuid,
  'eeee0001-0001-4001-8001-000000000003'::uuid
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
(
  '00000000-0000-0000-0000-000000000000',
  'eeee0001-0001-4001-8001-000000000001'::uuid,
  'authenticated', 'authenticated',
  'phasee-owner@example.com',
  crypt('test-password', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'PhaseE Owner'),
  now(), now(), '', '', '', ''
),
(
  '00000000-0000-0000-0000-000000000000',
  'eeee0001-0001-4001-8001-000000000002'::uuid,
  'authenticated', 'authenticated',
  'phasee-admin@example.com',
  crypt('test-password', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'PhaseE Admin'),
  now(), now(), '', '', '', ''
),
(
  '00000000-0000-0000-0000-000000000000',
  'eeee0001-0001-4001-8001-000000000003'::uuid,
  'authenticated', 'authenticated',
  'phasee-other@example.com',
  crypt('test-password', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'PhaseE Other'),
  now(), now(), '', '', '', ''
);

update public.profiles
set role = 'admin'
where id = 'eeee0001-0001-4001-8001-000000000002'::uuid;

insert into public.listings (id, type, status, title, slug, city, price, currency)
values
(
  'eeee0001-0001-4001-8001-100000000001'::uuid,
  'sale',
  'active',
  'Phase E Sale Listing',
  'phase-e-sale-listing',
  'Istanbul',
  500000,
  'TRY'
),
(
  'eeee0001-0001-4001-8001-100000000002'::uuid,
  'rent',
  'passive',
  'Phase E Rent Listing',
  'phase-e-rent-listing',
  'Istanbul',
  5000,
  'TRY'
);

set role authenticated;
select set_config('request.jwt.claim.sub', 'eeee0001-0001-4001-8001-000000000001', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
begin
  begin
    insert into public.sale_leads (
      listing_id,
      user_id,
      contact_name,
      contact_email,
      contact_phone,
      message
    )
    values (
      'eeee0001-0001-4001-8001-100000000001'::uuid,
      'eeee0001-0001-4001-8001-000000000001'::uuid,
      'Ada User',
      'ada@example.com',
      '+905551112233',
      'Bu ilanla cok ilgileniyorum'
    );

    raise exception 'direct authenticated sale lead insert unexpectedly succeeded';
  exception
    when insufficient_privilege then
      raise notice 'direct authenticated sale lead insert rejected as expected';
    when others then
      if sqlstate <> '42501' then
        raise;
      end if;
  end;
end;
$$;

do $$
declare
  v_lead record;
begin
  select * into v_lead
  from public.create_sale_lead(
    'eeee0001-0001-4001-8001-100000000001'::uuid,
    'Ada User',
    'ada@example.com',
    '+905551112233',
    'Bu ilanla cok ilgileniyorum'
  );

  if v_lead.result <> 'created'
    or v_lead.listing_id <> 'eeee0001-0001-4001-8001-100000000001'::uuid
    or v_lead.status <> 'new'
  then
    raise exception 'create_sale_lead RPC did not create expected lead';
  end if;
end;
$$;

do $$
begin
  begin
    perform public.create_sale_lead(
      'eeee0001-0001-4001-8001-100000000001'::uuid,
      'Ada User',
      'not-an-email',
      '+905551112233',
      'Bu ilanla cok ilgileniyorum'
    );

    raise exception 'invalid sale lead email unexpectedly succeeded';
  exception
    when check_violation then
      raise notice 'invalid sale lead email rejected as expected';
  end;
end;
$$;

do $$
begin
  begin
    insert into public.sale_leads (listing_id, user_id, contact_name, message)
    values (
      'eeee0001-0001-4001-8001-100000000002'::uuid,
      'eeee0001-0001-4001-8001-000000000001'::uuid,
      'Ada User',
      'Bu kiralik ilan icin satis leadi olmamali'
    );
    raise exception 'rent listing sale lead insert should fail';
  exception
    when insufficient_privilege or check_violation or raise_exception then
      raise notice 'rent listing sale lead insert rejected as expected';
  end;
end;
$$;

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.sale_leads
  where user_id = 'eeee0001-0001-4001-8001-000000000001'::uuid;

  if v_count <> 1 then
    raise exception 'owner should read exactly one own lead, found %', v_count;
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', 'eeee0001-0001-4001-8001-000000000003', false);

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.sale_leads
  where user_id = 'eeee0001-0001-4001-8001-000000000001'::uuid;

  if v_count <> 0 then
    raise exception 'non-owner should not read other user lead, found %', v_count;
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', 'eeee0001-0001-4001-8001-000000000002', false);

do $$
declare
  v_count integer;
  v_lead_id uuid;
begin
  select count(*) into v_count
  from public.sale_leads;

  select id into v_lead_id
  from public.sale_leads
  limit 1;

  if v_count <> 1 then
    raise exception 'admin should read one sale lead, found %', v_count;
  end if;

  perform public.admin_update_sale_lead_status(v_lead_id, 'called', 'Telefon ile ulasildi');

  select count(*) into v_count
  from public.sale_lead_events
  where lead_id = v_lead_id
    and event_type = 'status_change'
    and payload->>'status' = 'called'
    and payload->>'previous_status' = 'new';

  if v_count <> 1 then
    raise exception 'admin status transition should write one audit event, found %', v_count;
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', 'eeee0001-0001-4001-8001-000000000001', false);

do $$
declare
  v_lead_id uuid;
begin
  select id into v_lead_id from public.sale_leads limit 1;

  begin
    update public.sale_leads
    set status = 'closed'
    where id = v_lead_id;
    raise exception 'direct non-admin status update should fail';
  exception
    when insufficient_privilege then
      raise notice 'direct non-admin status update rejected as expected';
  end;

  begin
    perform public.admin_update_sale_lead_status(v_lead_id, 'closed', 'Should fail');
    raise exception 'non-admin RPC status update should fail';
  exception
    when insufficient_privilege then
      raise notice 'non-admin RPC status update rejected as expected';
  end;
end;
$$;

reset role;
