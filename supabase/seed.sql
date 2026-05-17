-- Seed admin user for local development
-- This file is referenced by supabase/config.toml [db.seed] and runs on `supabase db reset`.
-- The handle_new_user trigger auto-creates a profile row with role='user',
-- so we update it to 'admin' after the insert.

-- Clean up any previous seed data for idempotent re-runs
-- (order matters due to FK constraints)
delete from public.profiles where id = 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb800'::uuid;
delete from auth.users where id = 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb800'::uuid;

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
values (
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb800'::uuid,
  'authenticated',
  'authenticated',
  'smoke-admin@example.test',
  crypt('smoke-admin-2026', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', 'Smoke Admin'),
  now(),
  now(),
  '',
  '',
  '',
  ''
);

-- The handle_new_user trigger created the profile with role='user'.
-- Promote to admin.
update public.profiles
set role = 'admin'
where id = 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb800'::uuid;

-- Payload consultant examples for local development only.
-- Public helpers expose only is_published=true rows; the passive row verifies
-- that draft consultants stay out of the public showcase.
insert into payload.consultants (
  full_name,
  slug,
  title,
  photo_url,
  short_bio,
  phone,
  email,
  whatsapp_url,
  linkedin_url,
  is_published,
  sort_order
)
values
  (
    'Elif Yilmaz',
    'elif-yilmaz',
    'Satis ve Kiralama Danismani',
    '/property-nextjs-pro/images/hero/hero-profile-2.jpg',
    'Istanbul merkezi bolgelerinde satilik ve kiralik sureclerde musteri odakli destek sunar.',
    '+902120000001',
    'elif.yilmaz@example.test',
    'https://wa.me/902120000001',
    'https://www.linkedin.com/',
    true,
    0
  ),
  (
    'Murat Arslan',
    'murat-arslan',
    'Yatirim Danismani',
    '/property-nextjs-pro/images/hero/hero-profile-1.jpg',
    'Konut yatirimi, portfoy degerleme ve bolge karsilastirmalarinda seffaf danismanlik saglar.',
    null,
    'murat.arslan@example.test',
    null,
    'https://www.linkedin.com/',
    true,
    1
  ),
  (
    'Pasif Danisman',
    'pasif-danisman',
    'Taslak Profil',
    null,
    'Bu yerel taslak kayit public danismanlar vitrininde gorunmemelidir.',
    null,
    null,
    null,
    null,
    false,
    99
  )
ON CONFLICT (slug) DO UPDATE
set full_name = excluded.full_name,
    title = excluded.title,
    photo_url = excluded.photo_url,
    short_bio = excluded.short_bio,
    phone = excluded.phone,
    email = excluded.email,
    whatsapp_url = excluded.whatsapp_url,
    linkedin_url = excluded.linkedin_url,
    is_published = excluded.is_published,
    sort_order = excluded.sort_order,
    updated_at = now();

-- Public demo listings for local development.
-- These rows keep active-listing invariants intact: every listing has a
-- description, district, image, and rent listings have an enabled main item.
delete from public.listing_main_item_options
where listing_id in (
  'dddddddd-1111-4111-8111-111111111111'::uuid,
  'dddddddd-2222-4222-8222-222222222222'::uuid,
  'dddddddd-3333-4333-8333-333333333333'::uuid
);

delete from public.listing_images
where listing_id in (
  'dddddddd-1111-4111-8111-111111111111'::uuid,
  'dddddddd-2222-4222-8222-222222222222'::uuid,
  'dddddddd-3333-4333-8333-333333333333'::uuid
);

delete from public.listings
where id in (
  'dddddddd-1111-4111-8111-111111111111'::uuid,
  'dddddddd-2222-4222-8222-222222222222'::uuid,
  'dddddddd-3333-4333-8333-333333333333'::uuid
);

insert into public.main_item_catalog (
  id,
  code,
  label,
  description,
  pricing_strategy,
  default_multiplier,
  is_active,
  sort_order
)
values (
  'dddddddd-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid,
  'demo_rent_deposit',
  'Kira Depozitosu',
  'Local demo kiralik ilan checkout kalemi',
  'listing_price_multiplier',
  1.0000,
  true,
  10
)
on conflict (code) do update
set label = excluded.label,
    description = excluded.description,
    pricing_strategy = excluded.pricing_strategy,
    default_multiplier = excluded.default_multiplier,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order;

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
  gross_area_m2,
  is_furnished,
  heating_type,
  fuel_type,
  balcony_count,
  has_elevator,
  parking_type,
  in_site,
  building_age,
  floor_count,
  floor_number,
  usage_status,
  facade
)
values
  (
    'dddddddd-1111-4111-8111-111111111111'::uuid,
    'rent',
    'active',
    'Kadikoy Merkezi Kiralik Daire',
    'kadikoy-merkezi-kiralik-daire',
    'Metroya yakin, esyali ve kullanima hazir kiralik daire.',
    'Kadikoy merkezde, ulasim akslarina yakin, esyali ve bakimli kiralik daire.',
    'Istanbul',
    'Kadikoy',
    42000,
    'TRY',
    3,
    2,
    125,
    true,
    'central',
    'natural_gas',
    2,
    true,
    'open',
    true,
    6,
    12,
    '5. Kat',
    'empty',
    'Guney Bati'
  ),
  (
    'dddddddd-2222-4222-8222-222222222222'::uuid,
    'sale',
    'active',
    'Besiktas Manzarali Satilik Daire',
    'besiktas-manzarali-satilik-daire',
    'Genis cepheli, otoparkli satilik daire.',
    'Besiktas sahiline yakin, genis cepheli ve kapali otoparkli satilik daire.',
    'Istanbul',
    'Besiktas',
    8750000,
    'TRY',
    4,
    2,
    165,
    false,
    'combi',
    'natural_gas',
    1,
    true,
    'closed',
    false,
    12,
    8,
    '4. Kat',
    'owner_occupied',
    'Guney'
  ),
  (
    'dddddddd-3333-4333-8333-333333333333'::uuid,
    'rent',
    'active',
    'Sisli Site Icinde Kiralik Residence',
    'sisli-site-icinde-kiralik-residence',
    'Site icinde, kapali otoparkli modern residence.',
    'Sisli merkezde, site icinde, kapali otoparkli ve modern kiralik residence.',
    'Istanbul',
    'Sisli',
    58000,
    'TRY',
    2,
    1,
    92,
    false,
    'floor_heating',
    'electricity',
    1,
    true,
    'closed',
    true,
    3,
    24,
    '11. Kat',
    'tenant_occupied',
    'Kuzey Dogu'
  );

insert into public.listing_images (
  listing_id,
  image_url,
  alt_text,
  sort_order,
  is_primary
)
values
  (
    'dddddddd-1111-4111-8111-111111111111'::uuid,
    'https://example.com/property-nextjs-pro/placeholder-property.jpg',
    'Kadikoy merkezi kiralik daire',
    0,
    true
  ),
  (
    'dddddddd-2222-4222-8222-222222222222'::uuid,
    'https://example.com/property-nextjs-pro/placeholder-property.jpg',
    'Besiktas manzarali satilik daire',
    0,
    true
  ),
  (
    'dddddddd-3333-4333-8333-333333333333'::uuid,
    'https://example.com/property-nextjs-pro/placeholder-property.jpg',
    'Sisli site icinde kiralik residence',
    0,
    true
  );

insert into public.listing_main_item_options (
  listing_id,
  main_item_id,
  is_enabled,
  sort_order
)
select listing_id, main_item.id, true, 10
from (
  values
    ('dddddddd-1111-4111-8111-111111111111'::uuid),
    ('dddddddd-3333-4333-8333-333333333333'::uuid)
) as rent_listings(listing_id)
cross join (
  select id
  from public.main_item_catalog
  where code = 'demo_rent_deposit'
) as main_item;
