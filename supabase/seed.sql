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

-- Public demo listings for local development.
-- These rows keep active-listing invariants intact: every listing has a
-- description, district, image, and rent listings have an enabled main item.
delete from public.listing_main_item_options
where listing_id in (
  'dddddddd-1111-4111-8111-111111111111'::uuid,
  'dddddddd-2222-4222-8222-222222222222'::uuid,
  'dddddddd-3333-4333-8333-333333333333'::uuid,
  'dddddddd-4444-4444-8444-444444444444'::uuid,
  'dddddddd-5555-5555-8555-555555555555'::uuid,
  'dddddddd-6666-4666-8666-666666666666'::uuid,
  'dddddddd-7777-4777-8777-777777777777'::uuid,
  'dddddddd-8888-4888-8888-888888888888'::uuid,
  'dddddddd-9999-4999-8999-999999999999'::uuid,
  'dddddddd-aaaa-4bbb-cccc-dddddddddddd'::uuid
);

delete from public.listing_service_options
where listing_id in (
  'dddddddd-1111-4111-8111-111111111111'::uuid,
  'dddddddd-2222-4222-8222-222222222222'::uuid,
  'dddddddd-3333-4333-8333-333333333333'::uuid,
  'dddddddd-4444-4444-8444-444444444444'::uuid,
  'dddddddd-5555-5555-8555-555555555555'::uuid,
  'dddddddd-6666-4666-8666-666666666666'::uuid,
  'dddddddd-7777-4777-8777-777777777777'::uuid,
  'dddddddd-8888-4888-8888-888888888888'::uuid,
  'dddddddd-9999-4999-8999-999999999999'::uuid,
  'dddddddd-aaaa-4bbb-cccc-dddddddddddd'::uuid
);

delete from public.listing_images
where listing_id in (
  'dddddddd-1111-4111-8111-111111111111'::uuid,
  'dddddddd-2222-4222-8222-222222222222'::uuid,
  'dddddddd-3333-4333-8333-333333333333'::uuid,
  'dddddddd-4444-4444-8444-444444444444'::uuid,
  'dddddddd-5555-5555-8555-555555555555'::uuid,
  'dddddddd-6666-4666-8666-666666666666'::uuid,
  'dddddddd-7777-4777-8777-777777777777'::uuid,
  'dddddddd-8888-4888-8888-888888888888'::uuid,
  'dddddddd-9999-4999-8999-999999999999'::uuid,
  'dddddddd-aaaa-4bbb-cccc-dddddddddddd'::uuid
);

delete from public.listings
where id in (
  'dddddddd-1111-4111-8111-111111111111'::uuid,
  'dddddddd-2222-4222-8222-222222222222'::uuid,
  'dddddddd-3333-4333-8333-333333333333'::uuid,
  'dddddddd-4444-4444-8444-444444444444'::uuid,
  'dddddddd-5555-5555-8555-555555555555'::uuid,
  'dddddddd-6666-4666-8666-666666666666'::uuid,
  'dddddddd-7777-4777-8777-777777777777'::uuid,
  'dddddddd-8888-4888-8888-888888888888'::uuid,
  'dddddddd-9999-4999-8999-999999999999'::uuid,
  'dddddddd-aaaa-4bbb-cccc-dddddddddddd'::uuid
);

-- Catalog Items
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

insert into public.main_item_catalog (
  id,
  code,
  label,
  description,
  pricing_strategy,
  default_multiplier,
  default_amount,
  is_active,
  sort_order
)
values
  ('dddddddd-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid, 'demo_first_month_rent', 'İlk Ay Kirası', 'Kiralama başlangıcında ödenmesi gereken ilk ay kira bedeli.', 'listing_price_multiplier', 1.0000, null, true, 20),
  ('dddddddd-aaaa-4aaa-8aaa-aaaaaaaaaaa3'::uuid, 'demo_kapora', 'Kapora', 'Kiralama öncesi güvence kaporası bedeli.', 'fixed', null, 10000.00, true, 30)
on conflict (code) do update
set label = excluded.label,
    description = excluded.description,
    pricing_strategy = excluded.pricing_strategy,
    default_multiplier = excluded.default_multiplier,
    default_amount = excluded.default_amount,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order;

insert into public.service_catalog (id, code, name, description, base_price, is_active)
values
  ('dddddddd-bbbb-4bbb-8bbb-bbbbbbbbbbb1'::uuid, 'demo_renovation_fee', 'Tadilat Bedeli', 'Kiralama öncesi talep edilen tadilat hizmet bedeli.', 5000.00, true),
  ('dddddddd-bbbb-4bbb-8bbb-bbbbbbbbbbb2'::uuid, 'demo_early_checkin', 'Erken Giriş Hizmeti', 'Giriş gününde saat 12:00 öncesi giriş imkanı.', 1000.00, true),
  ('dddddddd-bbbb-4bbb-8bbb-bbbbbbbbbbb3'::uuid, 'demo_airport_transfer', 'Havalimanı Transferi', 'Havalimanından adrese lüks araçla transfer hizmeti.', 3000.00, true)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    base_price = excluded.base_price,
    is_active = excluded.is_active;

-- Insert Listings (passive first to bypass child row validation triggers)
insert into public.listings (
  id, type, status, title, slug, summary, description, city, district, price, currency,
  room_count, bathroom_count, gross_area_m2, is_furnished, heating_type, fuel_type,
  balcony_count, has_elevator, parking_type, in_site, building_age, floor_count,
  floor_number, usage_status, facade
)
values
  (
    'dddddddd-1111-4111-8111-111111111111'::uuid, 'rent', 'passive',
    'Talas Bahçelievler Eşyalı Kiralık Daire', 'talas-bahcelievler-esyali-kiralik-daire',
    'Üniversiteye yakın, full eşyalı ve ulaşıma çok elverişli kiralık daire.',
    'Talas Bahçelievler mahallesinde, Erciyes Üniversitesi kampüsüne yürüme mesafesinde, kombili ve full eşyalı kiralık daire.',
    'Kayseri', 'Talas', 15000, 'TRY',
    2, 1, 85, true, 'combi', 'natural_gas', 1, true, 'open', false, 3, 5, '3. Kat', 'empty', 'Güney Doğu'
  ),
  (
    'dddddddd-2222-4222-8222-222222222222'::uuid, 'sale', 'passive',
    'Melikgazi Alpaslan Satılık Lüks 4+1', 'melikgazi-alpaslan-satilik-luks-4-1',
    'Alpaslan mahallesinde, prestijli sitede, geniş ve manzaralı satılık daire.',
    'Kayseri Melikgazi Alpaslan mahallesinde, alışveriş merkezlerine ve ana yollara yakın, ultra lüks yapılı, geniş 4+1 daire.',
    'Kayseri', 'Melikgazi', 6750000, 'TRY',
    4, 2, 220, false, 'central', 'natural_gas', 2, true, 'closed', true, 5, 15, '12. Kat', 'empty', 'Güney Batı'
  ),
  (
    'dddddddd-3333-4333-8333-333333333333'::uuid, 'rent', 'passive',
    'Kocasinan Yenişehir Aileye Uygun Kiralık Daire', 'kocasinan-yenisehir-aileye-uygun-kiralik-daire',
    'Park ve okul yakınında, asansörlü ve kombili kiralık aile evi.',
    'Yenişehir mahallesinde, toplu taşımaya yakın, otoparklı ve child_invariants triggers yardımıyla site içerisinde temiz kiralık daire.',
    'Kayseri', 'Kocasinan', 12500, 'TRY',
    3, 1, 130, false, 'combi', 'natural_gas', 1, true, 'open', true, 8, 10, '4. Kat', 'empty', 'Kuzey Doğu'
  ),
  (
    'dddddddd-4444-4444-8444-444444444444'::uuid, 'rent', 'passive',
    'Hacılar Erciyes Yolu Kiralık Müstakil Villa', 'hacilar-erciyes-yolu-kiralik-mustakil-villa',
    'Doğa ile iç içe, şömineli ve bahçeli kiralık lüks villa.',
    'Kayseri Hacılar ilçesinde, Erciyes kayak merkezi yolu üzerinde, geniş bahçeli ve doğa manzaralı kiralık müstakil ev.',
    'Kayseri', 'Hacılar', 45000, 'TRY',
    5, 3, 350, true, 'floor_heating', 'natural_gas', 0, false, 'closed', false, 2, 2, 'Müstakil', 'empty', 'Güney'
  ),
  (
    'dddddddd-5555-5555-8555-555555555555'::uuid, 'sale', 'passive',
    'Talas Bahçelievler Satılık Sıfır 2+1', 'talas-bahcelievler-satilik-sifir-2-1',
    'Yeni yapılan binada, yatırımlık yüksek kira getirili satılık daire.',
    'Talas Bahçelievler''de, yeni teslim edilmiş projede, asansörlü ve kapalı otoparklı lüks satılık daire.',
    'Kayseri', 'Talas', 2850000, 'TRY',
    2, 1, 95, false, 'combi', 'natural_gas', 1, true, 'closed', false, 1, 8, '2. Kat', 'empty', 'Batı'
  ),
  (
    'dddddddd-6666-4666-8666-666666666666'::uuid, 'rent', 'passive',
    'Melikgazi Yıldırım Beyazıt Kiralık Rezidans', 'melikgazi-yildirim-beyazit-kiralik-rezidans',
    'Sosyal donatıları olan lüks sitede kiralık 1+1 daire.',
    'Yıldırım Beyazıt mahallesinde, spor salonu, güvenlik ve kapalı havuzu bulunan sitede lüks kiralık rezidans dairesi.',
    'Kayseri', 'Melikgazi', 18000, 'TRY',
    1, 1, 65, true, 'central', 'natural_gas', 1, true, 'closed', true, 1, 12, '8. Kat', 'empty', 'Güney'
  ),
  (
    'dddddddd-7777-4777-8777-777777777777'::uuid, 'sale', 'passive',
    'Kocasinan Mimarsinan Satılık 3+1 Daire', 'kocasinan-mimarsinan-satilik-3-1-daire',
    'Geniş balkonlu, güney cephe, masrafsız satılık daire.',
    'Mimarsinan mahallesinde, geniş ailelere uygun, tadilatı yeni yapılmış, masrafsız satılık kombili daire.',
    'Kayseri', 'Kocasinan', 3200000, 'TRY',
    3, 1, 145, false, 'combi', 'natural_gas', 2, true, 'open', false, 12, 10, '5. Kat', 'empty', 'Güney Doğu'
  ),
  (
    'dddddddd-8888-4888-8888-888888888888'::uuid, 'rent', 'passive',
    'Melikgazi Köşk Mahallesi Kiralık Daire', 'melikgazi-kosk-mahallesi-kiralik-daire',
    'Merkezi konumda, geniş oda ve mutfağa sahip kiralık daire.',
    'Köşk mahallesinde, okullara ve marketlere yürüme mesafesinde, geniş 3+1 kiralık daire.',
    'Kayseri', 'Melikgazi', 14000, 'TRY',
    3, 2, 160, false, 'combi', 'natural_gas', 1, true, 'open', false, 8, 8, '3. Kat', 'empty', 'Kuzey'
  ),
  (
    'dddddddd-9999-4999-8999-999999999999'::uuid, 'sale', 'passive',
    'Talas Anayurt Satılık Manzaralı Dubleks', 'talas-anayurt-satilik-manzarali-dubleks',
    'Talas Anayurt''ta şehir manzaralı teraslı satılık dubleks daire.',
    'Anayurt mahallesinde, geniş teraslı, ebeveyn banyolu ve çift mutfaklı satılık lüks dubleks daire.',
    'Kayseri', 'Talas', 5200000, 'TRY',
    5, 2, 280, false, 'combi', 'natural_gas', 2, true, 'open', false, 4, 6, '5. Kat', 'empty', 'Güney Batı'
  ),
  (
    'dddddddd-aaaa-4bbb-cccc-dddddddddddd'::uuid, 'sale', 'passive',
    'Hacılar Satılık Havuzlu Lüks Villa', 'hacilar-satilik-havuzlu-luks-villa',
    'Hacılar''da geniş arazili, özel havuzlu ve şömineli satılık villa.',
    'Kayseri Hacılar''ın en gözde bölgesinde, akıllı ev sistemine sahip, kapalı otoparklı ve havuzlu satılık ultra lüks villa.',
    'Kayseri', 'Hacılar', 18500000, 'TRY',
    6, 4, 450, false, 'floor_heating', 'natural_gas', 0, false, 'closed', false, 2, 2, 'Müstakil', 'empty', 'Kuzey Güney'
  );

-- Insert Images
insert into public.listing_images (listing_id, image_url, alt_text, sort_order, is_primary)
values
  ('dddddddd-1111-4111-8111-111111111111'::uuid, 'http://localhost:3000/property-nextjs-pro/images/properties/prop-1.jpg', 'Talas Bahçelievler Eşyalı Kiralık Daire', 0, true),
  ('dddddddd-2222-4222-8222-222222222222'::uuid, 'http://localhost:3000/property-nextjs-pro/images/properties/prop-2.jpg', 'Melikgazi Alpaslan Satılık Lüks 4+1', 0, true),
  ('dddddddd-3333-4333-8333-333333333333'::uuid, 'http://localhost:3000/property-nextjs-pro/images/properties/prop-3.jpg', 'Kocasinan Yenişehir Aileye Uygun Kiralık Daire', 0, true),
  ('dddddddd-4444-4444-8444-444444444444'::uuid, 'http://localhost:3000/property-nextjs-pro/images/properties/prop-4.jpg', 'Hacılar Erciyes Yolu Kiralık Müstakil Villa', 0, true),
  ('dddddddd-5555-5555-8555-555555555555'::uuid, 'http://localhost:3000/property-nextjs-pro/images/properties/prop-5.jpg', 'Talas Bahçelievler Satılık Sıfır 2+1', 0, true),
  ('dddddddd-6666-4666-8666-666666666666'::uuid, 'http://localhost:3000/property-nextjs-pro/images/properties/prop-6.jpg', 'Melikgazi Yıldırım Beyazıt Kiralık Rezidans', 0, true),
  ('dddddddd-7777-4777-8777-777777777777'::uuid, 'http://localhost:3000/property-nextjs-pro/images/properties/prop-7.jpg', 'Kocasinan Mimarsinan Satılık 3+1 Daire', 0, true),
  ('dddddddd-8888-4888-8888-888888888888'::uuid, 'http://localhost:3000/property-nextjs-pro/images/properties/prop-8.jpg', 'Melikgazi Köşk Mahallesi Kiralık Daire', 0, true),
  ('dddddddd-9999-4999-8999-999999999999'::uuid, 'http://localhost:3000/property-nextjs-pro/images/properties/prop-9.jpg', 'Talas Anayurt Satılık Manzaralı Dubleks', 0, true),
  ('dddddddd-aaaa-4bbb-cccc-dddddddddddd'::uuid, 'http://localhost:3000/property-nextjs-pro/images/properties/prop-10.jpg', 'Hacılar Satılık Havuzlu Lüks Villa', 0, true);

insert into public.listing_images (listing_id, image_url, alt_text, sort_order, is_primary)
values
  ('dddddddd-1111-4111-8111-111111111111'::uuid, 'http://localhost:3000/property-nextjs-pro/images/properties/prop-11.jpg', 'Talas Bahçelievler Kiralık Daire İçi', 1, false),
  ('dddddddd-1111-4111-8111-111111111111'::uuid, 'http://localhost:3000/property-nextjs-pro/images/properties/prop-12.jpg', 'Talas Bahçelievler Kiralık Mutfak', 2, false),
  ('dddddddd-2222-4222-8222-222222222222'::uuid, 'http://localhost:3000/property-nextjs-pro/images/properties/prop-13.jpg', 'Melikgazi Alpaslan Satılık Daire İçi', 1, false),
  ('dddddddd-2222-4222-8222-222222222222'::uuid, 'http://localhost:3000/property-nextjs-pro/images/properties/prop-14.jpg', 'Melikgazi Alpaslan Satılık Mutfak', 2, false),
  ('dddddddd-3333-4333-8333-333333333333'::uuid, 'http://localhost:3000/property-nextjs-pro/images/properties/prop-15.jpg', 'Kocasinan Kiralık Daire İçi', 1, false),
  ('dddddddd-3333-4333-8333-333333333333'::uuid, 'http://localhost:3000/property-nextjs-pro/images/properties/prop-16.jpg', 'Kocasinan Kiralık Mutfak', 2, false);

-- Map Rent Main Checkout Items
insert into public.listing_main_item_options (listing_id, main_item_id, is_enabled, sort_order)
select rent_listings.listing_id, main_item.id, true, main_item.sort_order
from (
  values
    ('dddddddd-1111-4111-8111-111111111111'::uuid),
    ('dddddddd-3333-4333-8333-333333333333'::uuid),
    ('dddddddd-4444-4444-8444-444444444444'::uuid),
    ('dddddddd-6666-4666-8666-666666666666'::uuid),
    ('dddddddd-8888-4888-8888-888888888888'::uuid)
) as rent_listings(listing_id)
cross join (
  select id, sort_order
  from public.main_item_catalog
  where code in ('demo_rent_deposit', 'demo_first_month_rent', 'demo_kapora')
) as main_item
on conflict (listing_id, main_item_id) do nothing;

-- Map Rent Service Options
insert into public.listing_service_options (listing_id, service_id, is_enabled, override_price)
select rent_listings.listing_id, service_item.id, true, null
from (
  values
    ('dddddddd-1111-4111-8111-111111111111'::uuid),
    ('dddddddd-3333-4333-8333-333333333333'::uuid),
    ('dddddddd-4444-4444-8444-444444444444'::uuid),
    ('dddddddd-6666-4666-8666-666666666666'::uuid),
    ('dddddddd-8888-4888-8888-888888888888'::uuid)
) as rent_listings(listing_id)
cross join (
  select id
  from public.service_catalog
  where code in ('demo_renovation_fee', 'demo_early_checkin', 'demo_airport_transfer')
) as service_item
on conflict (listing_id, service_id) do nothing;

-- Finally update all to active
update public.listings
set status = 'active'
where id in (
  'dddddddd-1111-4111-8111-111111111111'::uuid,
  'dddddddd-2222-4222-8222-222222222222'::uuid,
  'dddddddd-3333-4333-8333-333333333333'::uuid,
  'dddddddd-4444-4444-8444-444444444444'::uuid,
  'dddddddd-5555-5555-8555-555555555555'::uuid,
  'dddddddd-6666-4666-8666-666666666666'::uuid,
  'dddddddd-7777-4777-8777-777777777777'::uuid,
  'dddddddd-8888-4888-8888-888888888888'::uuid,
  'dddddddd-9999-4999-8999-999999999999'::uuid,
  'dddddddd-aaaa-4bbb-cccc-dddddddddddd'::uuid
);
