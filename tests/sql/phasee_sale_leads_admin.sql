\set ON_ERROR_STOP on

-- Phase E: sale leads admin contract.
-- Verifies guest/authenticated RPC creation, closed direct table writes,
-- RLS ownership, admin read access, audited status transitions, and listing
-- eligibility checks.

-- deterministic ids
-- owner:         eeee0001-0001-4001-8001-000000000001
-- admin:         eeee0001-0001-4001-8001-000000000002
-- other:         eeee0001-0001-4001-8001-000000000003
-- active sale:   eeee0001-0001-4001-8001-100000000001
-- active rent:   eeee0001-0001-4001-8001-100000000002
-- inactive sale: eeee0001-0001-4001-8001-100000000003
-- missing:       eeee0001-0001-4001-8001-100000000004

reset role;

delete from public.sale_lead_events
where lead_id in (
  select id
  from public.sale_leads
  where listing_id in (
    'eeee0001-0001-4001-8001-100000000001'::uuid,
    'eeee0001-0001-4001-8001-100000000002'::uuid,
    'eeee0001-0001-4001-8001-100000000003'::uuid
  )
  or user_id in (
    'eeee0001-0001-4001-8001-000000000001'::uuid,
    'eeee0001-0001-4001-8001-000000000003'::uuid
  )
);
delete from public.sale_leads
where listing_id in (
  'eeee0001-0001-4001-8001-100000000001'::uuid,
  'eeee0001-0001-4001-8001-100000000002'::uuid,
  'eeee0001-0001-4001-8001-100000000003'::uuid
)
or user_id in (
  'eeee0001-0001-4001-8001-000000000001'::uuid,
  'eeee0001-0001-4001-8001-000000000003'::uuid
);
delete from public.listing_images
where listing_id in (
  'eeee0001-0001-4001-8001-100000000001'::uuid,
  'eeee0001-0001-4001-8001-100000000002'::uuid,
  'eeee0001-0001-4001-8001-100000000003'::uuid
);
delete from public.listings
where id in (
  'eeee0001-0001-4001-8001-100000000001'::uuid,
  'eeee0001-0001-4001-8001-100000000002'::uuid,
  'eeee0001-0001-4001-8001-100000000003'::uuid
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

insert into public.listings (
  id,
  type,
  status,
  title,
  slug,
  summary,
  description,
  city,
  district,
  price,
  currency,
  room_count,
  bathroom_count,
  gross_area_m2
)
values
(
  'eeee0001-0001-4001-8001-100000000001'::uuid,
  'sale',
  'active',
  'Phase E Sale Listing',
  'phase-e-sale-listing',
  'Satilik daire',
  'Phase E sale listing description',
  'Istanbul',
  'Kadikoy',
  500000,
  'TRY',
  3,
  1,
  120
),
(
  'eeee0001-0001-4001-8001-100000000002'::uuid,
  'rent',
  'active',
  'Phase E Rent Listing',
  'phase-e-rent-listing',
  'Kiralik daire',
  'Phase E rent listing description',
  'Istanbul',
  'Besiktas',
  5000,
  'TRY',
  2,
  1,
  90
),
(
  'eeee0001-0001-4001-8001-100000000003'::uuid,
  'sale',
  'passive',
  'Phase E Passive Sale Listing',
  'phase-e-passive-sale-listing',
  'Pasif satilik daire',
  'Phase E passive sale listing description',
  'Istanbul',
  'Uskudar',
  450000,
  'TRY',
  2,
  1,
  100
);

insert into public.listing_images (listing_id, image_url, alt_text, is_primary)
values
(
  'eeee0001-0001-4001-8001-100000000001'::uuid,
  'https://example.com/phase-e-sale.jpg',
  'Phase E sale listing',
  true
),
(
  'eeee0001-0001-4001-8001-100000000002'::uuid,
  'https://example.com/phase-e-rent.jpg',
  'Phase E rent listing',
  true
);

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.role', 'anon', false);

do $$
declare
  v_lead record;
begin
  select * into v_lead
  from public.create_sale_lead(
    'eeee0001-0001-4001-8001-100000000001'::uuid,
    'Guest User',
    'guest-sale-lead@example.com',
    null,
    'Bu ilan hakkinda bilgi almak istiyorum'
  );

  if v_lead.result <> 'created'
    or v_lead.listing_id <> 'eeee0001-0001-4001-8001-100000000001'::uuid
    or v_lead.status <> 'new'
  then
    raise exception 'anonymous create_sale_lead RPC did not create expected lead';
  end if;
end;
$$;

do $$
begin
  begin
    insert into public.sale_leads (
      listing_id,
      user_id,
      contact_name,
      contact_email,
      message
    )
    values (
      'eeee0001-0001-4001-8001-100000000001'::uuid,
      null,
      'Direct Guest',
      'direct-guest@example.com',
      'Direct guest insert must stay closed'
    );

    raise exception 'direct anonymous sale lead insert unexpectedly succeeded';
  exception
    when insufficient_privilege then
      raise notice 'direct anonymous sale lead insert rejected as expected';
    when others then
      if sqlstate <> '42501' then
        raise;
      end if;
  end;
end;
$$;

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
      'ada-direct@example.com',
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
    null,
    '+905551112233',
    'Bu ilanla cok ilgileniyorum'
  );

  if v_lead.result <> 'created'
    or v_lead.listing_id <> 'eeee0001-0001-4001-8001-100000000001'::uuid
    or v_lead.status <> 'new'
  then
    raise exception 'authenticated create_sale_lead RPC did not create expected lead';
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
    perform public.create_sale_lead(
      'eeee0001-0001-4001-8001-100000000001'::uuid,
      'Ada User',
      null,
      null,
      'Iletisim kanali olmayan satis leadi olmamali'
    );

    raise exception 'sale lead without email or phone unexpectedly succeeded';
  exception
    when check_violation then
      raise notice 'sale lead without email or phone rejected as expected';
  end;
end;
$$;

do $$
begin
  begin
    perform public.create_sale_lead(
      'eeee0001-0001-4001-8001-100000000002'::uuid,
      'Ada User',
      'ada-rent@example.com',
      null,
      'Bu kiralik ilan icin satis leadi olmamali'
    );
    raise exception 'rent listing sale lead RPC should fail';
  exception
    when raise_exception then
      raise notice 'rent listing sale lead RPC rejected as expected';
  end;
end;
$$;

do $$
begin
  begin
    perform public.create_sale_lead(
      'eeee0001-0001-4001-8001-100000000003'::uuid,
      'Ada User',
      'ada-inactive@example.com',
      null,
      'Pasif satis ilanina lead acilmamali'
    );
    raise exception 'inactive sale listing sale lead RPC should fail';
  exception
    when invalid_parameter_value then
      raise notice 'inactive sale listing sale lead RPC rejected as expected';
  end;
end;
$$;

do $$
begin
  begin
    perform public.create_sale_lead(
      'eeee0001-0001-4001-8001-100000000004'::uuid,
      'Ada User',
      'ada-missing@example.com',
      null,
      'Olmayan ilana lead acilmamali'
    );
    raise exception 'missing sale listing sale lead RPC should fail';
  exception
    when no_data_found then
      raise notice 'missing sale listing sale lead RPC rejected as expected';
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
    raise exception 'owner should read exactly one own authenticated lead, found %', v_count;
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
  where user_id = 'eeee0001-0001-4001-8001-000000000001'::uuid
     or user_id is null;

  if v_count <> 0 then
    raise exception 'non-owner should not read owner or guest leads, found %', v_count;
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', 'eeee0001-0001-4001-8001-000000000002', false);

do $$
declare
  v_count integer;
  v_guest_count integer;
  v_auth_count integer;
  v_lead_id uuid;
begin
  select count(*) into v_count
  from public.sale_leads
  where listing_id = 'eeee0001-0001-4001-8001-100000000001'::uuid;

  select count(*) into v_guest_count
  from public.sale_leads
  where listing_id = 'eeee0001-0001-4001-8001-100000000001'::uuid
    and user_id is null;

  select count(*) into v_auth_count
  from public.sale_leads
  where listing_id = 'eeee0001-0001-4001-8001-100000000001'::uuid
    and user_id = 'eeee0001-0001-4001-8001-000000000001'::uuid;

  select id into v_lead_id
  from public.sale_leads
  where user_id = 'eeee0001-0001-4001-8001-000000000001'::uuid
  limit 1;

  if v_count <> 2 or v_guest_count <> 1 or v_auth_count <> 1 then
    raise exception 'admin should read one guest and one authenticated lead, found total %, guest %, auth %',
      v_count,
      v_guest_count,
      v_auth_count;
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
  select id into v_lead_id
  from public.sale_leads
  where user_id = 'eeee0001-0001-4001-8001-000000000001'::uuid
  limit 1;

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
