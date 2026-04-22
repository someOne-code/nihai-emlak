# Implementation Plan: Backend-Only Emlak Platform V1

## Özet

Bu plan, projeyi **backend odaklı**, **Supabase-first** ve **minimum custom code** ilkesiyle ilerletir.  
Amaç, frontend ve admin UI ekiplerinin bağlanacağı güvenli bir operasyonel backend kurmaktır.

Sabit mimari kararlar:
- **Supabase** = operational backend
- **Payload** = content backend
- **İş Bankası** = payment layer
- **Chatwoot** = communication layer
- Frontend ve admin UI bu planın uygulama kapsamı dışında

Bu revizyonda özellikle şu kararlar netleştirildi:
- Faz 4 ödeme tamamlama akışı **tek transaction sınırında** çalışacak
- Bu atomiklik, **tek DB function çağrısı** ile sağlanacak; callback handler birden fazla bağımsız update zinciri çalıştırmayacak
- `BEGIN/COMMIT` mantığı callback içinde ya da PL/pgSQL function gövdesinde elle kurulmayacak
- Faz 1 migration disiplini resmi Supabase akışına göre versioned migration dosyalarıyla yürütülecek
- Faz 7 Chatwoot entegrasyonunda **HMAC identity validation** zorunlu olacak
- Uygulama yöntemi **TDD-first** olacak; davranış testle tanımlanmadan production kodu yazılmayacak

## Uygulama Yöntemi

- Proje uygulaması yazılım yaşam döngüsü disiplinine göre yürütülür:
  1. scope ve sınır netleştirme
  2. Supabase-first katman kararı
  3. beklenen davranışı test ile tanımlama
  4. minimum implementasyon
  5. ilgili test katmanında doğrulama
  6. gerekiyorsa kısa refactor ve tekrar doğrulama
- Varsayılan geliştirme modeli `Red -> Green -> Refactor` döngüsüdür.
- Her fazda, o fazın davranışını doğrulayan test yazılmadan veya mevcut test güncellenmeden iş tamamlanmış sayılmaz.
- Test katmanları şu sırayla kullanılır:
  - helper/route davranışı için dar Node veya TypeScript testleri
  - schema/RLS/DB function davranışı için SQL testleri
  - repo sağlık kontrolü için `npm test`, `bash .codex/scripts/test.sh`, gerekirse `npm run build`

## Uygulama Planı

### Faz 0: Kararları sabitle
- `PROJECT_PLAN.md`, `BACKEND_PHASE_1.md`, `IMPLEMENTATION_PLAN.md`, `README.md` tek kaynak gerçeklik kabul edilir.
- Checkout kurali sabittir:
  - en az 1 ana odeme kalemi zorunlu
  - ana odeme kalemi secimi frontend request'inden gelir
  - secilebilirlik ve fiyat emlakci/admin tarafindan yonetilen DB konfigurasyonundan gelir
  - ek hizmet ancak ana odeme varsa secilebilir
- Sorumluluk sınırı sabittir:
  - frontend ayrı ekip
  - admin UI ayrı ekip
  - bu repo backend contracts, veri modeli ve business logic üretir

### Faz 0.5: Supabase capability audit
- Faz 1 şema yazımından önce, ana backend ihtiyaçları için kısa bir capability audit çıkarılır.
- Amaç, gereksiz custom kodu elemek ve her ihtiyacı doğru katmana yerleştirmektir.
- Her başlık için şu karar açık yazılır:
  - `Supabase native`
  - `ince custom`
  - `dış sistem`
- İlk audit kapsamı:
  - auth ve session yönetimi: Supabase Auth
  - kullanıcı sahipliği ve veri yetkisi: RLS
  - profil genişletme: `auth.users` + `profiles`
  - public/admin read modelleri: view/RPC + RLS
  - veri yoğun atomik işlemler: DB function
  - webhook alma ve imza doğrulama: route handler veya Edge Function
  - ödeme tamamlama akışı: tek DB function
  - uzun arka plan işleri: Inngest veya Edge Function background task
  - içerik yönetimi: Payload
  - mesajlaşma kimlik doğrulama: Chatwoot + server-side HMAC
- Audit sırasında şu sınırlar netleştirilir:
  - Data API `db_pre_request` yalnızca PostgREST yüzeyi için geçerlidir; genel authorization çözümü olarak seçilmez
  - `service_role` yalnızca gerçekten RLS bypass gereken sunucu tarafı operasyonlarda kullanılır
  - veri yoğun ve transaction kritik mantık için önce DB function tercih edilir; dış API/webhook alımı için Edge Function veya route handler tercih edilir

### Faz 1: Supabase çekirdek veri modeli ve migration disiplini
- İlk tur tablolar:
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
- İlk tur enumlar:
  - `listing_type`
  - `listing_status`
  - `reservation_status`
  - `order_status`
  - `payment_status`
- İlk tur constraint ve indexler:
  - kiralama süresi 1-12 ay
  - gerekli foreign key’ler
  - listing-service unique eşleşmesi
  - payment/order/reservation lookup indexleri
- Migration politikası:
  - repo içinde versioned Supabase migration dosyaları tutulur
  - yerel şema değişiklikleri migration’a çevrilirken `supabase db diff` kullanılabilir
  - declarative schema yaklaşımı yalnızca ekip bunu bilinçli seçerse ikincil yardımcı akış olarak kullanılır
  - **tek kaynak gerçeklik migration dosyalarıdır**
- Faz kapısı:
  - her migration davranışı önce SQL test veya smoke test ile tarif edilir
  - migration yazıldıktan sonra `supabase db reset` ve ilgili SQL testleri geçmeden Faz 1 işi tamamlanmış sayılmaz

### Faz 2: Auth ve RLS omurgası
- `auth.users` ile ilişkili `profiles` modeli kurulur.
- `proxy.ts`, yalnızca ağ sınırında oturum yenileme ve yüksek seviyeli erişim yönlendirmesi için kullanılır.
- Temel RLS:
  - `listings`, `listing_images`, `service_catalog`, `listing_service_options`: public read
  - `reservations`, `orders`, `payments`: user own read
  - `payment_events`: admin/backoffice read
  - admin/backoffice erişimi role tabanlıdır
- Gerekli yerlerde sade SQL view/function eklenebilir.
- Yetkilendirme mantığı mümkün olduğunca uygulama kodundan çıkarılıp DB seviyesine taşınır.
- Detaylı authorization ve veri sahipliği kontrolü `proxy.ts` içinde değil, RLS ve gerekli DB helper function'larında çözülür.
- Rol sınırı notu:
  - ürün/backoffice role source-of-truth'u `public.profiles.role` alanıdır
  - `auth.users` yalnızca kimlik ve oturum kaynağıdır
  - Payload içindeki `users.role`, varsa yalnızca CMS/admin access control yardımcı alanıdır
  - reservation/order/payment yetkisi Payload role'una bağlanmaz; Supabase Auth + `profiles` + RLS ile çözülür
- Faz kapısı:
  - own-data ve admin behavior önce test ile tanımlanır
  - RLS değişiklikleri SQL testleriyle doğrulanmadan merge edilmez

### Faz 3: Checkout backend contract
- Girdi modeli:
  - `listing_id`
  - kullanıcı temel bilgileri
  - taşınma tarihi
  - kalış süresi
  - kişi sayısı
  - `main_items`
  - `service_items`
  - havale benzeri açıklama/not
- Validation:
  - `main_items` en az 1 secim icermeli
  - `main_items` duplicate icermemeli
  - secilen ana kalemler listing icin DB/admin konfigurasyonunda aktif ve secilebilir olmali
  - service seçimleri listing’e uygun olmalı
  - inactive listing checkout’a girememeli
- Fiyat hesaplama:
  - frontend toplam göndermez
  - authoritative toplam PostgreSQL/RPC içinde listing + secili ana kalemlerin admin/DB fiyat konfigurasyonu + service override verisine gore hesaplanir
  - Node.js tarafinda uretilen fiyat, checkout create icin source-of-truth kabul edilmez
- Çıktı:
  - `reservation`
  - `order`
  - `order_items`
  - pending `payment`
- Faz kapısı:
  - validation senaryoları önce testle yazılır
  - fiyat ve request kontratı testleri geçmeden checkout implementasyonu tamamlanmış sayılmaz

### Faz 4: İş Bankası callback, atomiklik ve çakışma yönetimi
- Callback handler önce imzayı doğrular, payload’ı normalize eder.
- Doğrulanmış callback sonrası **tek bir DB function** çağrılır.
- Bu function tek çağrıda şunları yapar:
  - ilgili `payment` kaydını bulur
  - `payment_events` log yazar
  - `payments.status` günceller
  - `orders.status` günceller
  - `reservations.status` günceller
  - başarılı ödeme ise `listings.status` değerini pasife çeker
- Atomiklik kuralı:
  - bu güncellemeler callback kodunda ayrı ayrı sorgular halinde çalıştırılmaz
  - function tek statement/transaction sınırında çalışır
  - function içinde manuel `BEGIN/COMMIT` yazılmaz
- Çakışma kuralı:
  - ödeme başlatmak listing’i kapatmaz
  - function ilgili sipariş ve listing satırlarını `SELECT ... FOR UPDATE` ile kilitli okuyarak karar verir
  - ilk başarılı ödeme listing’i kapatır
  - listing zaten pasifse function bunu `conflict` sonucu olarak döner
  - callback katmanı bu durumda refund/conflict akışını başlatır
- Callback sonrası e-posta, bildirim, CRM benzeri uzun işler atomik DB function içine alınmaz; gerekli olursa başarı sonrası asenkron event olarak tetiklenir.
- Faz kapısı:
  - invalid signature, duplicate callback, idempotency, conflict ve partial update senaryoları önce test ile yazılır
  - callback route ve DB function bu testler yeşile dönmeden tamamlanmış kabul edilmez

### Faz 5: Backend read modelleri
- Frontend/admin ekipleri için minimum read yüzeyleri hazırlanır:
  - listing listesi
  - listing detay
  - listing’e bağlı seçilebilir hizmetler
  - reservation listesi
  - order listesi
  - payment listesi
  - payment event log listesi
- Öncelik sırası:
  - önce Supabase view/RPC
  - yetmezse ince route handler

### Faz 6: Content backend
- Payload içerik backend’i olarak kalır.
- İlk içerik modülleri:
  - `blog_posts`
  - `blog_categories`
  - `consultants`
- Payload yalnızca içerik/CMS yönetimi için kullanılır.
- Reservation/order/payment çekirdeği Payload içine alınmaz.

### Faz 7: Communication layer
- Chatwoot entegrasyonu backend sınırıyla uygulanır.
- Ana veri Supabase’de kalır.
- Chatwoot’a yalnızca conversation/inbox bağlamı verilir.
- İlk tur kurallar:
  - conversation hangi listing ile ilişkili net tutulur
  - aynı user + aynı listing için gereksiz yeni conversation açılmaz
- Güvenlik kuralı:
  - Chatwoot identity validation için HMAC zorunludur
  - HMAC token frontend’de üretilmez
  - token sunucu tarafında, gizli anahtarla üretilip istemciye verilir

## Arayüzler ve Davranışlar

### Sabit backend kontratları
- Checkout:
  - `main_items: string[]`
  - `service_items: string[]`
  - `main_items.length >= 1`
  - secilen ana odeme kalemleri DB/admin konfigurasyonuna karsi dogrulanir
  - toplam fiyat frontend'den alinmaz
  - toplam fiyat checkout create sirasinda DB/RPC tarafinda hesaplanir
- Payment callback:
  - ham payload işlenmeden önce imza doğrulanır
  - doğrulanmış callback tek DB function yoluna girer
- Listing read modeli:
  - kiralık/satılık ayrımı açık gelir
  - satılık akışta ödeme/hizmet alanı beklenmez
- Admin read modeli:
  - reservation/order/payment/event verisi okunabilir halde sunulur

## Test Planı

### TDD ve yaşam döngüsü kapıları
- her task `Red -> Green -> Refactor` döngüsüyle ilerler
- task başlangıcında davranışı tanımlayan test eklenir veya güncellenir
- dar testler geçmeden geniş repo testlerine çıkılmaz
- ilgili faz doğrulanmadan sonraki fazın implementasyonuna geçilmez

### Capability audit
- audit dokümanı veya karar matrisi oluşturulur
- her ana backend ihtiyacı için `Supabase native / ince custom / dış sistem` kararı yazılıdır
- DB function, RLS, Edge Function ve Payload sınırları netleşmiştir
- Faz 1 şema yazımına geçmeden önce tekrar eden mimari tartışma kalmamıştır

### Şema ve migration
- migration temiz veritabanında uygulanır
- migration zinciri yerelde yeniden kurulabilir
- enum, constraint, FK ve unique kuralları beklenen şekilde oluşur

### RLS
- public kullanıcı yalnızca aktif listing okuyabilir
- authenticated kullanıcı yalnızca kendi reservation/order/payment verisini okuyabilir
- admin role gerekli kayıtları okuyabilir

### Checkout
- request `main_items` gondermezse veya bos gonderirse reddedilir
- duplicate `main_items` reddedilir
- secilen ana kalem listing DB/admin konfigurasyonunda yoksa reddedilir
- listing için aktif ana kalem konfigürasyonu yoksa checkout reddedilir
- inactive listing checkout’a girmez
- valid checkout reservation + order + order_items + payment üretir

### Payment
- invalid callback signature reddedilir
- valid callback tek DB function yoluna girer
- başarılı ödeme listing’i pasife çeker
- ikinci başarılı callback same listing için `conflict` sonucu üretir
- `payment_events` log kaydı oluşur
- function içindeki herhangi bir hata partial update bırakmaz

### Sistem sağlığı
- `bash .codex/scripts/test.sh`
- `npm run build`
- migration smoke testi
- RLS smoke testi
- payment callback integration smoke testi

## Varsayımlar ve Sabit Tercihler

- Payload kaldırılmayacak; içerik backend olarak kalacak.
- Inngest çekirdek modelin temeli olmayacak; sadece gerçekten gereken orchestration alanında kullanılacak.
- Blog ve Chatwoot, çekirdek Faz 1-4 tamamlanmadan uygulanmayacak.
- Migration tarafında temel ekip standardı versioned Supabase migration dosyaları olacak.
- `supabase db diff`, migration üretimini kolaylaştıran yardımcı araç olarak kullanılabilir; ancak tek kaynak gerçeklik migration dosyalarıdır.
- Atomik ödeme tamamlama akışı, callback handler içinde değil, tek DB function çağrısında çözülecek.
- Supabase-first yaklaşımı, capability audit ile her faz başında yeniden yorumlanmayacak; Faz 0.5 çıktısı temel karar matrisi olarak kullanılacak.
