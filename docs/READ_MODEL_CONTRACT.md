# Faz 5 Read Model Contract

Bu dokuman Faz 5 read route boundary ve Supabase RPC contract'ini tanimlar.
Source of truth:

- `lib/read-models/read-route.ts`
- `supabase/migrations/20260424100000_26_phase5_backend_read_models.sql`

## Kapsam

Public endpointler:

- `GET /api/public/listings` -> `list_public_listings`
- `GET /api/public/listings/:listingId` -> `get_public_listing_detail`
- `GET /api/public/listings/:listingId/services` -> `list_public_listing_services`

Admin endpointler:

- `GET /api/admin/read/reservations` -> `list_admin_reservations`
- `GET /api/admin/read/orders` -> `list_admin_orders`
- `GET /api/admin/read/payments` -> `list_admin_payments`
- `GET /api/admin/read/payment-events` -> `list_admin_payment_events`

Phase 5.6 checkout intake alanlari eklendikten sonra admin reservation read/snapshot yuzeyleri, ofis operasyonu icin gereken sanitize iletisim alanlarini dondurmelidir. Public read endpointleri intake bilgisini dondurmez.

## Ortak Response Envelope

Basarili:

```json
{
  "success": true,
  "data": {}
}
```

Hatali:

```json
{
  "success": false,
  "error": "Human-readable message"
}
```

Tum endpointler `cache-control: no-store` dondurur.

## Public Read Sozlesmesi

### `GET /api/public/listings`

Query:

- `type`: opsiyonel, `rent | sale`
- `city`: opsiyonel string
- `limit`: opsiyonel integer, `1..100`, default `20`
- `offset`: opsiyonel integer, `>= 0`, default `0`

RPC args:

- `p_type`
- `p_city`
- `p_limit`
- `p_offset`

### `GET /api/public/listings/:listingId`

Path:

- `listingId` UUID olmali

RPC args:

- `p_listing_id`

Detail response includes the public list shape plus:

- `description`
- `heating_type`
- `fuel_type`
- `balcony_count`
- `has_elevator`
- `parking_type`
- `in_site`
- `building_age`
- `floor_count`
- `floor_number`
- `usage_status`
- `facade`
- `images`
- `updated_at`

## Public Listing Image Performance Budget

This is a lightweight CI-cheap contract for the image-heavy customer UX on
`/listings` and `/listings/:listingId`; the meaningful content target is under 2 seconds on a normal production connection.

- Public listing cards and detail galleries use `next/image` with explicit
  `sizes` so Next.js can serve optimized variants instead of full originals.
- Listing image read models may expose optimized variants such as card/detail
  URLs; public consumers fall back to the original image URL when a variant is
  absent.
- Above-fold listing detail imagery may be prioritized, but below-fold cards, thumbnails, and secondary gallery images stay lazy.
- CI should keep this as static contract coverage in `npm run test:public-site`.
  Do not add Lighthouse or another heavy browser audit dependency unless a
  later performance task explicitly budgets for it.

### `GET /api/public/listings/:listingId/services`

Path:

- `listingId` UUID olmali

RPC args:

- `p_listing_id`

Public endpoint error semantigi:

- `400`: query veya UUID validation hatasi
- `404`: `P0002` map'i ile `Listing not found`/resource not found
- `500`: beklenmeyen RPC hatasi

## Admin Read Sozlesmesi

Admin route guard:

- Supabase session yoksa `401 Authentication required`
- `profiles` lookup hatasi varsa `500 Admin profile lookup failed`
- role `admin` degilse `403 Admin role required`

Admin pagination:

- `limit`: `1..100`, default `20`
- `offset`: `>= 0`, default `0`

### `GET /api/admin/read/reservations`

Query:

- `status`: opsiyonel, `pending | confirmed | cancelled | expired`
- `limit`
- `offset`

RPC args:

- `p_status`
- `p_limit`
- `p_offset`

Phase 5.6 sonrasi beklenen sanitize intake alanlari:

- `contact.fullName`
- `contact.phone`
- `contact.email`
- `contact.preferredContactMethod`
- `contact.preferredContactTime`
- `contact.occupantFullName`
- `contact.documentReadiness`
- `contact.note`

Bu alanlar yalnizca admin/backoffice read yuzeyinde bulunur.

### `GET /api/admin/read/orders`

Query:

- `status`: opsiyonel, `pending | completed | cancelled | failed | conflict`
- `limit`
- `offset`

RPC args:

- `p_status`
- `p_limit`
- `p_offset`

### `GET /api/admin/read/payments`

Query:

- `status`: opsiyonel, `pending | succeeded | failed | cancelled | refunded | conflict`
- `limit`
- `offset`

RPC args:

- `p_status`
- `p_limit`
- `p_offset`

### `GET /api/admin/read/payment-events`

Query:

- `paymentId`: opsiyonel UUID
- `limit`
- `offset`

RPC args:

- `p_payment_id`
- `p_limit`
- `p_offset`

Admin endpoint error semantigi:

- `400`: query validation veya RPC `22023`
- `401`: guard veya RPC `28000`
- `403`: guard veya RPC `42501`
- `500`: beklenmeyen RPC/infra hatasi

## Guvenlik Notlari

- Route katmani thin boundary olarak sadece auth, query validation ve error mapping yapar.
- Yetki ve veri scope kararlari DB/RPC tarafinda kalir.
- `service_role` client tarafina acilmaz.
- Public listing surface exact address bilgisini tasimaz; `public.listings` schema'sinda `address_line` kolonu bulunmaz.
- Audit/event tablolari (`payment_events`, `admin_workflow_events`) dogrudan client read surface'i degildir; liste/snapshot erisimi dar RPC fonksiyonlari uzerinden saglanir.
- Checkout intake bilgisi public read surface'e tasinmaz; event payload'larinda ham intake verisi kopyalanmaz.
