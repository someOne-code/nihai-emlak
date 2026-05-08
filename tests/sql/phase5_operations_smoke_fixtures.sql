\set ON_ERROR_STOP on

-- Extra admin operations smoke fixtures.
-- These rows make every operations queue visible in the local admin UI.

delete from public.payment_finance_ops
where reservation_id in (
  'eeeeeeee-ffff-4fff-8fff-fffffffff201'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff202'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff203'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff204'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff205'::uuid
);

delete from public.reservation_document_tracking
where reservation_id in (
  'eeeeeeee-ffff-4fff-8fff-fffffffff201'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff202'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff203'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff204'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff205'::uuid
);

delete from public.admin_workflow_events
where reservation_id in (
  'eeeeeeee-ffff-4fff-8fff-fffffffff201'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff202'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff203'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff204'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff205'::uuid
)
or order_id in (
  '11111111-2222-4222-8222-222222222201'::uuid,
  '11111111-2222-4222-8222-222222222202'::uuid,
  '11111111-2222-4222-8222-222222222203'::uuid,
  '11111111-2222-4222-8222-222222222204'::uuid,
  '11111111-2222-4222-8222-222222222205'::uuid
)
or payment_id in (
  '33333333-4444-4444-8444-444444444201'::uuid,
  '33333333-4444-4444-8444-444444444202'::uuid,
  '33333333-4444-4444-8444-444444444203'::uuid,
  '33333333-4444-4444-8444-444444444204'::uuid,
  '33333333-4444-4444-8444-444444444205'::uuid
)
or listing_id in (
  'cccccccc-dddd-4ddd-8ddd-ddddddddd201'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd202'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd203'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd204'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd205'::uuid
);

delete from public.payments
where id in (
  '33333333-4444-4444-8444-444444444201'::uuid,
  '33333333-4444-4444-8444-444444444202'::uuid,
  '33333333-4444-4444-8444-444444444203'::uuid,
  '33333333-4444-4444-8444-444444444204'::uuid,
  '33333333-4444-4444-8444-444444444205'::uuid
);

delete from public.order_items
where order_id in (
  '11111111-2222-4222-8222-222222222201'::uuid,
  '11111111-2222-4222-8222-222222222202'::uuid,
  '11111111-2222-4222-8222-222222222203'::uuid,
  '11111111-2222-4222-8222-222222222204'::uuid,
  '11111111-2222-4222-8222-222222222205'::uuid
);

delete from public.orders
where id in (
  '11111111-2222-4222-8222-222222222201'::uuid,
  '11111111-2222-4222-8222-222222222202'::uuid,
  '11111111-2222-4222-8222-222222222203'::uuid,
  '11111111-2222-4222-8222-222222222204'::uuid,
  '11111111-2222-4222-8222-222222222205'::uuid
);

delete from public.reservation_intake
where reservation_id in (
  'eeeeeeee-ffff-4fff-8fff-fffffffff201'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff202'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff203'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff204'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff205'::uuid
);

delete from public.reservations
where id in (
  'eeeeeeee-ffff-4fff-8fff-fffffffff201'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff202'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff203'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff204'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff205'::uuid
);

delete from public.listings
where id in (
  'cccccccc-dddd-4ddd-8ddd-ddddddddd201'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd202'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd203'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd204'::uuid,
  'cccccccc-dddd-4ddd-8ddd-ddddddddd205'::uuid
);

insert into public.listings (
  id, type, status, title, slug, summary, description, city, district, price, currency
)
values
  ('cccccccc-dddd-4ddd-8ddd-ddddddddd201'::uuid, 'rent', 'passive', 'Smoke Belge Bekleyen', 'smoke-belge-bekleyen', 'Smoke document waiting listing', 'Smoke document waiting listing', 'Istanbul', 'Kadikoy', 50000, 'TRY'),
  ('cccccccc-dddd-4ddd-8ddd-ddddddddd202'::uuid, 'rent', 'passive', 'Smoke Iptal Iade Talebi', 'smoke-iptal-iade-talebi', 'Smoke refund request listing', 'Smoke refund request listing', 'Istanbul', 'Besiktas', 52000, 'TRY'),
  ('cccccccc-dddd-4ddd-8ddd-ddddddddd203'::uuid, 'rent', 'active', 'Smoke Manuel Iade Bekleyen', 'smoke-manuel-iade-bekleyen', 'Smoke manual refund listing', 'Smoke manual refund listing', 'Istanbul', 'Sisli', 48000, 'TRY'),
  ('cccccccc-dddd-4ddd-8ddd-ddddddddd204'::uuid, 'rent', 'active', 'Smoke Odeme Sorunu', 'smoke-odeme-sorunu', 'Smoke payment issue listing', 'Smoke payment issue listing', 'Istanbul', 'Atasehir', 47000, 'TRY'),
  ('cccccccc-dddd-4ddd-8ddd-ddddddddd205'::uuid, 'rent', 'passive', 'Smoke Tamamlanan', 'smoke-tamamlanan', 'Smoke completed listing', 'Smoke completed listing', 'Istanbul', 'Uskudar', 53000, 'TRY');

insert into public.reservations (
  id, listing_id, user_id, move_in_date, stay_months, guest_count, note, status, created_at, updated_at
)
values
  ('eeeeeeee-ffff-4fff-8fff-fffffffff201'::uuid, 'cccccccc-dddd-4ddd-8ddd-ddddddddd201'::uuid, 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb102'::uuid, current_date + 20, 6, 1, 'Smoke belge bekleyen', 'pending', now() + interval '1 minute', now() + interval '1 minute'),
  ('eeeeeeee-ffff-4fff-8fff-fffffffff202'::uuid, 'cccccccc-dddd-4ddd-8ddd-ddddddddd202'::uuid, 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb102'::uuid, current_date + 21, 6, 1, 'Smoke iptal iade talebi', 'pending', now() + interval '2 minutes', now() + interval '2 minutes'),
  ('eeeeeeee-ffff-4fff-8fff-fffffffff203'::uuid, 'cccccccc-dddd-4ddd-8ddd-ddddddddd203'::uuid, 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb102'::uuid, current_date + 22, 6, 1, 'Smoke manuel iade bekleyen', 'cancelled', now() + interval '3 minutes', now() + interval '3 minutes'),
  ('eeeeeeee-ffff-4fff-8fff-fffffffff204'::uuid, 'cccccccc-dddd-4ddd-8ddd-ddddddddd204'::uuid, 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb102'::uuid, current_date + 23, 6, 1, 'Smoke odeme sorunu', 'pending', now() + interval '4 minutes', now() + interval '4 minutes'),
  ('eeeeeeee-ffff-4fff-8fff-fffffffff205'::uuid, 'cccccccc-dddd-4ddd-8ddd-ddddddddd205'::uuid, 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb102'::uuid, current_date + 24, 6, 1, 'Smoke tamamlanan', 'confirmed', now() + interval '5 minutes', now() + interval '5 minutes');

insert into public.reservation_intake (
  reservation_id, user_id, contact_full_name, contact_phone, contact_email,
  preferred_contact_method, preferred_contact_time, occupant_full_name, document_readiness, note
)
select
  id,
  user_id,
  'Smoke Contact User',
  '+905551112233',
  'smoke-contact@example.com',
  'whatsapp',
  '18:00 sonrasi',
  null,
  'ready',
  note
from public.reservations
where id in (
  'eeeeeeee-ffff-4fff-8fff-fffffffff201'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff202'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff203'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff204'::uuid,
  'eeeeeeee-ffff-4fff-8fff-fffffffff205'::uuid
);

insert into public.orders (id, reservation_id, user_id, total_amount, currency, status, created_at, updated_at)
values
  ('11111111-2222-4222-8222-222222222201'::uuid, 'eeeeeeee-ffff-4fff-8fff-fffffffff201'::uuid, 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb102'::uuid, 50000, 'TRY', 'completed', now() + interval '1 minute', now() + interval '1 minute'),
  ('11111111-2222-4222-8222-222222222202'::uuid, 'eeeeeeee-ffff-4fff-8fff-fffffffff202'::uuid, 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb102'::uuid, 52000, 'TRY', 'completed', now() + interval '2 minutes', now() + interval '2 minutes'),
  ('11111111-2222-4222-8222-222222222203'::uuid, 'eeeeeeee-ffff-4fff-8fff-fffffffff203'::uuid, 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb102'::uuid, 48000, 'TRY', 'cancelled', now() + interval '3 minutes', now() + interval '3 minutes'),
  ('11111111-2222-4222-8222-222222222204'::uuid, 'eeeeeeee-ffff-4fff-8fff-fffffffff204'::uuid, 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb102'::uuid, 47000, 'TRY', 'conflict', now() + interval '4 minutes', now() + interval '4 minutes'),
  ('11111111-2222-4222-8222-222222222205'::uuid, 'eeeeeeee-ffff-4fff-8fff-fffffffff205'::uuid, 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb102'::uuid, 53000, 'TRY', 'completed', now() + interval '5 minutes', now() + interval '5 minutes');

insert into public.order_items (order_id, item_type, code, label, amount, listing_id)
values
  ('11111111-2222-4222-8222-222222222201'::uuid, 'main_item', 'first_rent', 'Bir Aylik Kira', 50000, 'cccccccc-dddd-4ddd-8ddd-ddddddddd201'::uuid),
  ('11111111-2222-4222-8222-222222222202'::uuid, 'main_item', 'deposit', 'Kapora', 52000, 'cccccccc-dddd-4ddd-8ddd-ddddddddd202'::uuid),
  ('11111111-2222-4222-8222-222222222203'::uuid, 'main_item', 'deposit', 'Kapora', 48000, 'cccccccc-dddd-4ddd-8ddd-ddddddddd203'::uuid),
  ('11111111-2222-4222-8222-222222222204'::uuid, 'main_item', 'first_rent', 'Bir Aylik Kira', 47000, 'cccccccc-dddd-4ddd-8ddd-ddddddddd204'::uuid),
  ('11111111-2222-4222-8222-222222222205'::uuid, 'main_item', 'first_rent', 'Bir Aylik Kira', 53000, 'cccccccc-dddd-4ddd-8ddd-ddddddddd205'::uuid);

insert into public.payments (id, order_id, user_id, amount, currency, status, provider, provider_ref, created_at, updated_at)
values
  -- In this schema payment date is represented by payments.created_at / updated_at.
  -- Successful and completed smoke rows must therefore carry explicit timestamps.
  ('33333333-4444-4444-8444-444444444201'::uuid, '11111111-2222-4222-8222-222222222201'::uuid, 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb102'::uuid, 50000, 'TRY', 'succeeded', 'isbank', '33333333-4444-4444-8444-444444444201', current_date::timestamp - interval '3 days' + interval '10 hours', current_date::timestamp - interval '3 days' + interval '10 hours'),
  ('33333333-4444-4444-8444-444444444202'::uuid, '11111111-2222-4222-8222-222222222202'::uuid, 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb102'::uuid, 52000, 'TRY', 'succeeded', 'isbank', '33333333-4444-4444-8444-444444444202', current_date::timestamp - interval '17 days' + interval '10 hours', current_date::timestamp - interval '17 days' + interval '10 hours'),
  ('33333333-4444-4444-8444-444444444203'::uuid, '11111111-2222-4222-8222-222222222203'::uuid, 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb102'::uuid, 48000, 'TRY', 'succeeded', 'isbank', '33333333-4444-4444-8444-444444444203', current_date::timestamp - interval '9 days' + interval '10 hours', current_date::timestamp - interval '9 days' + interval '10 hours'),
  ('33333333-4444-4444-8444-444444444204'::uuid, '11111111-2222-4222-8222-222222222204'::uuid, 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb102'::uuid, 47000, 'TRY', 'conflict', 'isbank', '33333333-4444-4444-8444-444444444204', current_date::timestamp - interval '1 day' + interval '10 hours', current_date::timestamp - interval '1 day' + interval '10 hours'),
  ('33333333-4444-4444-8444-444444444205'::uuid, '11111111-2222-4222-8222-222222222205'::uuid, 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb102'::uuid, 53000, 'TRY', 'succeeded', 'isbank', '33333333-4444-4444-8444-444444444205', current_date::timestamp - interval '5 days' + interval '10 hours', current_date::timestamp - interval '5 days' + interval '10 hours');

insert into public.payment_events (payment_id, event_type, provider, payload, created_at)
values
  ('33333333-4444-4444-8444-444444444201'::uuid, 'payment_checkout_succeeded', 'isbank', '{"source":"operations_smoke_fixture"}'::jsonb, current_date::timestamp - interval '3 days' + interval '10 hours'),
  ('33333333-4444-4444-8444-444444444202'::uuid, 'payment_checkout_succeeded', 'isbank', '{"source":"operations_smoke_fixture"}'::jsonb, current_date::timestamp - interval '17 days' + interval '10 hours'),
  ('33333333-4444-4444-8444-444444444203'::uuid, 'payment_checkout_succeeded', 'isbank', '{"source":"operations_smoke_fixture"}'::jsonb, current_date::timestamp - interval '9 days' + interval '10 hours'),
  ('33333333-4444-4444-8444-444444444204'::uuid, 'payment_checkout_conflict', 'isbank', '{"source":"operations_smoke_fixture"}'::jsonb, current_date::timestamp - interval '1 day' + interval '10 hours'),
  ('33333333-4444-4444-8444-444444444205'::uuid, 'payment_checkout_succeeded', 'isbank', '{"source":"operations_smoke_fixture"}'::jsonb, current_date::timestamp - interval '5 days' + interval '10 hours');

insert into public.reservation_document_tracking (reservation_id, order_id, status, admin_note, last_admin_user_id, created_at, updated_at)
values
  ('eeeeeeee-ffff-4fff-8fff-fffffffff201'::uuid, '11111111-2222-4222-8222-222222222201'::uuid, 'waiting', 'Smoke belge bekleniyor', 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb101'::uuid, now() + interval '1 minute', now() + interval '1 minute'),
  ('eeeeeeee-ffff-4fff-8fff-fffffffff205'::uuid, '11111111-2222-4222-8222-222222222205'::uuid, 'completed', 'Smoke belgeler tamamlandi', 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb101'::uuid, now() + interval '5 minutes', now() + interval '5 minutes');

insert into public.payment_finance_ops (payment_id, order_id, reservation_id, status, admin_note, last_admin_user_id, created_at, updated_at)
values
  ('33333333-4444-4444-8444-444444444202'::uuid, '11111111-2222-4222-8222-222222222202'::uuid, 'eeeeeeee-ffff-4fff-8fff-fffffffff202'::uuid, 'refund_required', 'Smoke iptal iade talebi alindi', 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb101'::uuid, now() + interval '2 minutes', now() + interval '2 minutes'),
  ('33333333-4444-4444-8444-444444444203'::uuid, '11111111-2222-4222-8222-222222222203'::uuid, 'eeeeeeee-ffff-4fff-8fff-fffffffff203'::uuid, 'refund_requested', 'Smoke manuel iade bekliyor', 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb101'::uuid, now() + interval '3 minutes', now() + interval '3 minutes'),
  ('33333333-4444-4444-8444-444444444204'::uuid, '11111111-2222-4222-8222-222222222204'::uuid, 'eeeeeeee-ffff-4fff-8fff-fffffffff204'::uuid, 'manual_resolution_required', 'Smoke odeme sorunu kontrol gerekiyor', 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb101'::uuid, now() + interval '4 minutes', now() + interval '4 minutes');

do $$
begin
  if not exists (
    select 1
    from public.payments p
    join public.orders o on o.id = p.order_id
    where o.reservation_id = 'eeeeeeee-ffff-4fff-8fff-fffffffff205'::uuid
      and p.status = 'succeeded'
      and p.created_at is not null
      and p.updated_at is not null
      and exists (
        select 1
        from public.payment_events pe
        where pe.payment_id = p.id
          and pe.event_type = 'payment_checkout_succeeded'
      )
  ) then
    raise exception 'TEST FAILED: completed smoke fixture must have a successful payment date and payment event';
  end if;
end;
$$;

set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbb101', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
declare
  v_rows jsonb;
  v_refund_snapshot jsonb;
begin
  v_rows := public.list_admin_reservations(null, 20, 0)->'items';
  v_refund_snapshot := public.get_admin_reservation_workflow_snapshot(
    'eeeeeeee-ffff-4fff-8fff-fffffffff202'::uuid
  );

  if not exists (
    select 1
    from jsonb_array_elements(v_rows) item
    where item->>'id' = 'eeeeeeee-ffff-4fff-8fff-fffffffff202'
      and item #>> '{finance_ops,status}' = 'refund_required'
      and item #>> '{listing,status}' = 'passive'
  ) then
    raise exception 'TEST FAILED: smoke refund request fixture must expose finance ops status and keep paid listing off public listing';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(v_rows) item
    where item->>'id' = 'eeeeeeee-ffff-4fff-8fff-fffffffff201'
      and item #>> '{document_tracking,status}' = 'waiting'
      and item #>> '{listing,status}' = 'passive'
  ) then
    raise exception 'TEST FAILED: smoke document waiting fixture must expose document status and keep listing off public listing';
  end if;

  if v_refund_snapshot #>> '{payment,status}' <> 'succeeded'
     or v_refund_snapshot #>> '{payment,created_at}' is null
     or v_refund_snapshot #>> '{payment,updated_at}' is null then
    raise exception 'TEST FAILED: smoke refund request snapshot must expose successful payment dates for deposit refund decisions';
  end if;

end;
$$;

select 'phase5_operations_smoke_fixtures_ok' as result;
