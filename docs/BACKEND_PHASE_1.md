# Backend Faz 1

Bu dokuman, proje planindaki Supabase-first yaklasima gore ilk backend implementasyon fazini tanimlar.

Amac:
- domain veri modelini kurmak
- minimum gerekli backend business logic'i yazmak
- frontend ve admin panel ekiplerinin baglanabilecegi backend zemini hazir etmek

## Faz 1 hedefi

Faz 1 sonunda su durum hedeflenir:
- cekirdek tablolar tanimli olur
- temel RLS kurallari yazar
- reservation + order + payment omurgasi kurulur
- Is Bankasi callback'i gercek kayitlarla baglanir
- listing pasife dusurme ve event log mantigi calisir
- frontend ekibi form/checkout entegrasyonuna baslayabilir
- admin panel ekibi listing, reservation, payment ve event verisini okuyabilir

## Faz 1 kapsami

### 1. Veri modeli

Ilk turda tanimlanacak tablolar:
- `profiles`
- `consultants`
- `listings`
- `listing_images`
- `service_catalog`
- `listing_service_options`
- `reservations`
- `orders`
- `order_items`
- `payments`
- `payment_events`

Bu fazda opsiyonel:
- `agencies`
- `blog_categories`
- `blog_posts`

## 2. Supabase tarafinda yapilacaklar

### 2.1 SQL schema

Hazirlanacaklar:
- enum tanimlari
- tablo DDL'leri
- foreign key iliskileri
- gerekli unique constraint'ler
- temel index'ler

Minimum enum ihtiyaci:
- `listing_type`
- `listing_status`
- `reservation_status`
- `order_status`
- `payment_status`

### 2.2 RLS

Minimum politika seti:
- `listings`: public read, admin/manage kisitli
- `listing_images`: public read
- `service_catalog`: public read
- `listing_service_options`: public read
- `reservations`: kullanici kendi kaydini gorebilsin
- `orders`: kullanici kendi order'ini gorebilsin
- `payments`: kullanici kendi payment'ini gorebilsin
- `payment_events`: admin/backoffice odakli okunabilirlik

### 2.3 SQL yardimci yapilar

Supabase-native tutulabilecek alanlar:
- fiyat okumayi kolaylastiran view
- admin okuma ekranlari icin join view
- gerekiyorsa `create_reservation_order` benzeri SQL function

Not:
- trigger kullanimi kontrollu olmali
- trigger'lar yalnizca DB'ye yakin ve deterministik islerde kullanilmali

## 3. Custom backend logic

Bu fazda yazilacak minimum custom logic:

### 3.1 Reservation + order olusturma

Girdi:
- listing id
- kullanici temel bilgileri / checkout intake contact bilgisi
- tasinma tarihi
- kalis suresi
- kisi sayisi
- secilen ana kalemler
- secilen ek hizmetler
- havale benzeri aciklama/not

Checkout intake contact bilgisi:
- ad soyad
- telefon / WhatsApp
- opsiyonel e-posta
- tercih edilen iletisim kanali ve zamani
- farkliysa kalacak kisi ad soyad
- belge hazirlik durumu
- kisa musteri notu

Checkout sirasinda TC kimlik, pasaport, belge upload, maas/banka/kefil evraki, imzali kontrat, kart/banka hesap bilgisi veya mevcut acik adres toplanmaz.

Backend sorumlulugu:
- listing aktif mi kontrol et
- secilen ana kalemler gecerli mi kontrol et
- en az 1 ana kalem secildigini dogrula
- ayni ana kalemin tekrar secilmedigini dogrula
- secilen hizmetler o listing icin aktif mi kontrol et
- hizmet secimi varsa en az 1 ana kalem secildigini dogrula
- fiyatlari backend tarafinda hesapla
- reservation kaydi olustur
- order kaydi olustur
- order_items kirilimini yaz
- payment baslangic kaydini olustur

### 3.2 Payment callback sonrasI orkestrasyon

Minimum akIs:
1. callback dogrula
2. ilgili payment kaydini bul
3. payment status guncelle
4. payment_events kaydi yaz
5. order status guncelle
6. reservation status guncelle
7. listing status pasife cek

### 3.3 Cift islem kurali

Kural:
- odeme baslatmak listing'i kapatmaz
- ilk basarili odeme listing'i kapatir
- sonradan gelen basarili callback'ler conflict olarak islenir

## 4. API / backend contract listesi

Bu fazda gerekli minimum backend contract'lar:

### 4.1 Public/backend-facing
- `POST /api/reservations`
  - reservation + order + payment init
- `POST /api/payment/callback`
  - banka callback handler

### 4.2 Read modelleri
- `GET /api/listings`
- `GET /api/listings/:id`
- `GET /api/services?listingId=...`

Not:
- Bunlar ister Next route handler, ister Supabase RPC/view odakli cozulur
- ayni isi gereksiz custom route ile tekrar etmeyiz

## Ek checkout kurali

Bu fazda checkout validation icin sabit kural:
- `main_items.length >= 1`
- `service_items.length >= 0`
- `service_items` secilmisse yine `main_items.length >= 1` olmak zorundadir
- `main_items` icinde ayni kalem tekrar edemez

## 5. Frontend ekibi icin hazir ciktilar

Faz 1 sonunda frontend ekibine verilecek net kontratlar:
- listing detay veri sekli
- checkout request payload sekli
- reservation/order response sekli
- payment callback sonrasi status alanlari
- service option veri sekli

## 6. Admin panel ekibi icin hazir ciktilar

Faz 1 sonunda admin ekibine verilecek net veri kaynaklari:
- listing listesi
- reservation listesi
- order listesi
- payment listesi
- payment event log listesi

## 7. Faz 1 disinda kalanlar

Bu fazda yapilmayacaklar:
- Chatwoot implementasyonu
- blog modulu implementasyonu
- consultant vitrin implementasyonu
- iade otomasyonu
- belge toplama modulu
- advanced analytics
- seller split / marketplace mantigi

## 8. Uygulama sirasi

Onerilen sira:
1. schema tasarimi sabitle
2. SQL migration yaz
3. RLS politikalari yaz
4. fiyatlama kurallarini netlestir
5. reservation/order olusturma backend logic'ini yaz
6. payment callback'i gercek tablolara bagla
7. payment event log akisini tamamla
8. listing pasife dusurme kuralini tamamla
9. frontend/admin ekipleri icin kontrat orneklerini dokumante et

## 9. Faz 1 tamamlanma kriteri

Faz 1 bitti sayilmasi icin:
- schema migration uygulanabiliyor olmali
- test ortaminda reservation/order/payment kaydi acilabiliyor olmali
- callback geldiginde ilgili payment/order/reservation guncellenmeli
- basarili odeme sonrasi listing pasife dusmeli
- admin tarafi gerekli veriyi okuyabilmeli
- fiyat hesaplama frontend yerine backend tarafinda yapiliyor olmali
