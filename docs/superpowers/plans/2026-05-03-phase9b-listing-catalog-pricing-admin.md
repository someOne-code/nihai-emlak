# Phase 9B: Listing Catalog & Per-Listing Pricing Admin

## Summary

Admin, ilan bazinda ana odeme kalemleri ve ek hizmet fiyatlarini net sekilde ayarlayabilmelidir. Mevcut sistemde ilan bazli fiyat override alanlari vardir, ancak admin-dostu fiyatlandirma dili ve global katalog yonetim ekrani eksiktir.

Bu is Payload/content admin kapsami degildir. Supabase operational backend, RLS/RPC, Next route/controller ve custom admin shell uzerinden ilerler.

## Goals

- Global ana odeme kalemi kataloglarini admin UI'dan yonetmek.
- Global ek hizmet kataloglarini admin UI'dan yonetmek.
- Ilan detayinda her ilan icin ana kalem ve ek hizmet fiyatini o ilana ozel ayarlatmak.
- Teknik `override` dilini admin UI'dan kaldirmak.
- Checkout fiyat hesaplamasinda mevcut source-of-truth kuralini korumak: DB/RPC authoritative kalir.

## Current State

- `/admin/listings` icinde ilan bazli fiyat konfigurasyonu teknik olarak mevcut:
  - ana odeme kalemi: `override_amount`, `override_multiplier`
  - ek hizmet: `override_price`
- UI bunu teknik dille gosteriyor:
  - `Tutar override`
  - `Carpan override`
  - `Override fiyat`
- Mevcut paneller katalog kalemi olusturmaz; sadece var olan katalog kalemini secili ilana baglar.
- Adminin yeni ana kalem veya yeni ek hizmet katalog kaydi olusturacagi ayri bir custom admin yuzeyi yoktur.

## Required Product Behavior

### Global Catalog

Yeni admin yuzeyi:

- `/admin/listing-catalog`

Iki sekmeli veya iki bolumlu olmalidir:

1. Ana odeme kalemleri
   - ad
   - kod
   - aciklama
   - aktif/pasif
   - sira
   - varsayilan tutar
   - varsayilan carpan
   - fiyat stratejisi

2. Ek hizmetler
   - ad
   - kod
   - aciklama
   - aktif/pasif
   - sira
   - varsayilan fiyat

V1'de hard delete yerine aktif/pasif tercih edilir. Kullanimda olan katalog kalemleri silinmez.

### Per-Listing Pricing

`/admin/listings` ilan detayinda fiyatlandirma admin-dostu hale getirilir:

- Ana odeme kalemleri:
  - `Varsayilan tutar`
  - `Bu ilana ozel tutar`
  - `Varsayilan carpan`
  - `Bu ilana ozel carpan`
  - Bos birakilirsa katalog varsayilani kullanilir.

- Ek hizmetler:
  - `Varsayilan fiyat`
  - `Bu ilana ozel fiyat`
  - Bos birakilirsa katalog varsayilani kullanilir.

UI'da `override` kelimesi gorunmez.

## Architecture

- Supabase = operational source of truth.
- Payload bu kapsamda kullanilmaz.
- Custom admin UI dogrudan tablo yazmaz.
- State-changing isler Next route/controller + DB RPC/RLS sinirindan gecer.
- `service_role` client tarafina cikmaz.
- Checkout fiyat hesaplamasi frontend veya UI tarafinda authoritative olmaz.

Mevcut route'lar korunur:

- `PATCH /api/admin/listings/:listingId/main-items/:code`
- `PATCH /api/admin/listings/:listingId/services/:code`

Yeni katalog route/controller yuzeyleri eklenir:

- `GET /api/admin/catalog/main-items`
- `POST /api/admin/catalog/main-items`
- `PATCH /api/admin/catalog/main-items/:code`
- `GET /api/admin/catalog/services`
- `POST /api/admin/catalog/services`
- `PATCH /api/admin/catalog/services/:code`

## Data Rules

- Katalog fiyati varsayilandir.
- Ilan bazli ozel fiyat varsa checkout onu kullanir.
- Ilan bazli ozel fiyat bos/null ise checkout katalog varsayilanina duser.
- Pasif katalog kalemi yeni ilanlara eklenemez.
- Ilana daha once baglanmis ama katalogu sonradan pasif olmus kalem UI'da gorunur, durum etiketiyle admin uyarilir.
- Negatif fiyat, negatif tutar ve negatif carpan reddedilir.

## TDD Plan

1. DB/RPC veya route tests
   - admin olmayan kullanici katalog create/update yapamaz
   - ana odeme kalemi varsayilan tutar/carpan validasyonu
   - ek hizmet varsayilan fiyat validasyonu
   - ilan bazli ozel fiyat katalog varsayilanini ezer
   - null/empty ozel fiyat katalog varsayilanina fallback eder

2. Client/view-model/UI helper tests
   - UI copy `override` kelimesini tasimaz
   - varsayilan katalog fiyati ve ilana ozel fiyat ayri gosterilir
   - katalog aktif/pasif ve ilana bagli aktif/pasif durumlari ayri map edilir
   - available catalog candidates sadece uygun aktif kalemleri sunar

3. Browser smoke
   - global ana kalem olustur
   - global ek hizmet olustur
   - bir ilana bagla
   - ilana ozel fiyat gir
   - kaydet, tekrar ac, degerlerin persisted oldugunu dogrula
   - checkout readiness durumunun bozulmadigini dogrula

## Validation

- Narrow catalog route/controller tests
- Admin listings pricing route regressions
- Admin listings client/view-model tests
- Relevant SQL/RLS tests
- `npm run test:phase8-admin-listings`
- `npm run typecheck`
- `npm test` when the task touches shared contracts

## Follow-Up Notes

- Consultants photo upload Phase 9A follow-up olarak ayri takip edilir.
- Bu Phase 9B isi content admin kapanisindan bagimsizdir.
- Public frontend fiyat gosterimi bu repo kapsaminda degildir; ancak public frontend checkout/read model contract'i bozulmamalidir.
