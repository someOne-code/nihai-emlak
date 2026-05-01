# Implementation Plan: Emlak Platform Backend, Admin Operations ve Infrastructure V1

## Özet

Bu plan, projeyi **Supabase-first**, **minimum custom code** ve **operasyon paneli dahil kontrollu product backend** ilkesiyle ilerletir.  
Amaç, public frontend'in bağlanacağı güvenli operasyonel backend'i, Payload content backend'i, ödeme/iletişim altyapısını ve bu repo içinde sahiplenilen admin operasyon yüzeylerini kurmaktır.

Sabit mimari kararlar:
- **Supabase** = operational backend
- **Payload** = content backend
- **İş Bankası** = payment layer
- **Chatwoot** = communication layer
- Public frontend bu planın uygulama kapsamı dışında
- Admin operasyon paneli bu repo kapsamındadır; authoritative kararlar Supabase/RPC tarafında kalır, UI yalnızca dar admin route/read/workflow yüzeylerini tüketir

Bu revizyonda özellikle şu kararlar netleştirildi:
- Faz 4 ödeme tamamlama akışı **tek transaction sınırında** çalışacak
- Bu atomiklik, **tek DB function çağrısı** ile sağlanacak; callback handler birden fazla bağımsız update zinciri çalıştırmayacak
- `BEGIN/COMMIT` mantığı callback içinde ya da PL/pgSQL function gövdesinde elle kurulmayacak
- Faz 1 migration disiplini resmi Supabase akışına göre versioned migration dosyalarıyla yürütülecek
- Faz 7 Chatwoot entegrasyonunda **HMAC identity validation** zorunlu olacak
- Faz 7.1 communication data contract ve Faz 7.2 Chatwoot identity/client helper işleri kodlandı; sıradaki uygulama kapısı Faz 7.3 conversation open route'tur
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
  - admin operasyon paneli bu repo içinde kodlanır
  - bu repo backend contracts, veri modeli, business logic, Payload content backend'i, communication backend'i ve admin operations UI üretir
  - admin UI kritik state/eligibility kararı üretmez; bu kararlar DB/RPC ve route guard sınırında kalır

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

Durum: tamamlandi. 2026-04-30 itibariyla Faz 4 odeme callback,
atomiklik ve cakisma yonetimi kapisi gecildi.

Kapanis ozeti:
- Is Bankasi callback route'u imza/body normalize siniri olarak kalir.
- Dogrulanmis callback sonrasi state transition tek DB function/RPC
  sinirinda yurur.
- Payment, order, reservation, listing ve event guncellemeleri route
  icinde parca parca yapilmaz.
- Duplicate callback, terminal state, conflict ve invariant drift
  senaryolari fail-closed/audit davranisiyla korunur.
- Uzun isler atomik DB function icine alinmaz; callback sonrasi
  asenkron tarafta ele alinir.

Kapanis dogrulamasi:
- `npm run test:payment-callback-security`
- `npm run test:db-security`
- `npm test`

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
- Yetki kuralı:
  - `reservations`, `orders`, `payments`, `listings` state transition'ları direct admin tablo `UPDATE` ile değil, explicit DB workflow/RPC ile yürütülür
  - backoffice manuel işlem ihtiyacı varsa bu ihtiyaç ayrı isimli admin workflow function'ları ile çözülür
- Çakışma kuralı:
  - ödeme başlatmak listing’i kapatmaz
  - function ilgili sipariş ve listing satırlarını `SELECT ... FOR UPDATE` ile kilitli okuyarak karar verir
  - ilk başarılı ödeme listing’i kapatır
  - listing zaten pasifse function bunu `conflict` sonucu olarak döner
  - callback katmanı bu durumda refund/conflict akışını başlatır
- Callback sonrası e-posta, bildirim, CRM benzeri uzun işler atomik DB function içine alınmaz; gerekli olursa başarı sonrası asenkron event olarak tetiklenir.
- Admin read modeli:
  - reservation/order/payment/event verisi okunabilir halde sunulur
  - manuel operasyon butonları gerekiyorsa bu butonlar doğrudan tablo yazmaz; yetkili route veya RPC üzerinden kontrollü transition çağırır
- Faz kapısı:
  - invalid signature, duplicate callback, idempotency, conflict ve partial update senaryoları önce test ile yazılır
  - callback route ve DB function bu testler yeşile dönmeden tamamlanmış kabul edilmez

### Faz 5: Backend read modelleri

Durum: tamamlandi. 2026-04-30 itibariyla Faz 5 backend read modelleri,
admin operasyon workflow'lari ve checkout intake operasyon yuzeyleri kapisi
gecildi.

Kapanis ozeti:
- Public listing list/detail/services read yuzeyleri thin route + Supabase
  RPC modeliyle hazirlandi.
- Admin reservation/order/payment/payment-event read yuzeyleri admin guard
  ve dar RPC contract'i uzerinden sunuldu.
- Kritik backoffice state degisimleri direct tablo UPDATE yerine explicit
  admin workflow RPC/route sinirinda tutuldu.
- Operations admin yuzeyi Payload CMS'ten ayrildi; Supabase operasyon
  siniri `/admin/operations` tarafinda kaldi.
- Checkout intake bilgisi public read yuzeylerine sizdirilmeden admin
  read/snapshot yuzeylerinde sanitize edildi.

Kapanis dogrulamasi:
- `node --experimental-strip-types --test tests/read-model-contract-doc.test.mts tests/read-model-route.test.mts tests/admin-workflow-route.test.mts tests/admin-workflow-snapshot-route.test.mts tests/admin-operations-client.test.mts tests/admin-operations-view-model.test.mts tests/phase5-operations-auth-boundary.test.mts tests/phase5-task3-payload-admin-config.test.mts tests/phase5-task4-operations-ui.test.mts tests/phase5-task5-admin-operations-validation.test.mts`
- `npm run test:db-security`
- `npm test`

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
- Admin operasyon sınırı:
  - backoffice ekranları kritik state değişiklikleri için doğrudan tablo `UPDATE` yapmaz
  - manuel süreç adımları explicit admin workflow RPC/function üzerinden yürütülür

### Faz 5.5: Admin operasyon workflow'ları

Durum: tamamlandi. 2026-04-30 itibariyla Faz 5.5 admin operasyon
workflow'lari kapisi gecildi.

Kapanis ozeti:
- `admin_cancel_reservation`, `admin_reopen_listing` ve
  `admin_confirm_reservation` explicit DB workflow/RPC sinirinda tutuldu.
- Admin route'lari auth/profile/origin/production config guard'larini
  fail-closed uygular.
- Snapshot route'lari workflow eligibility, son event ve invariant drift
  durumlarini dar admin yuzeyinde dondurur.
- Kritik state degisimleri direct tablo UPDATE ile degil, audit/event
  yazan workflow siniriyle yurutulur.

Kapanis dogrulamasi:
- `node --experimental-strip-types --test tests/admin-workflow-route.test.mts tests/admin-workflow-snapshot-route.test.mts`
- `npm run test:db-security`

- Amaç:
  - gerçek hayattaki belge kontrolü, cayma, manuel iptal ve yeniden aktif etme ihtiyaçlarını authoritative DB sınırını bozmadan çözmek
- Tasarım kuralı:
  - her operasyon tek isimli workflow function/RPC olur
  - function state transition, sahiplik/invariant kontrolü ve audit log yazımını birlikte yapar
  - admin panel veya route bu function'ları çağırır; doğrudan tablo state'i yazmaz
- İlk backlog:
  - `admin_confirm_reservation`
  - `admin_cancel_reservation`
  - `admin_reopen_listing`
- `admin_confirm_reservation`
  - kullanım: ödeme sonrası gerçek dünya belge/kontrat süreci tamamlandığında operasyonel onay
  - guard: yalnızca izinli önceki state'lerden çağrılır; ilgili `reservation/order/payment/listing` tutarlılığı doğrulanır
  - sonuç: reservation/order uygun final state'e geçer; listing pasif kalır; audit/event kaydı yazılır
- `admin_cancel_reservation`
  - kullanım: müşteri caydı, belge süreci başarısız oldu veya manuel iptal gerekiyor
  - guard: terminal state çakışmaları engellenir; iptal sebebi/açıklaması zorunlu tutulabilir
  - sonuç: reservation/order uygun cancel state'ine geçer; gerekiyorsa ayrı refund/conflict akışı tetiklenir; audit/event kaydı yazılır
- `admin_reopen_listing`
  - kullanım: iptal veya başarısız süreç sonrası ilanın yeniden yayına alınması
  - guard: aktif reservation, tamamlanmış order veya açık pending checkout varken çağrı reddedilir
  - sonuç: listing tekrar `active` olur; reopen işlemi audit/event kaydıyla izlenir
- TDD sırası:
  - önce SQL test matrisi yazılır
  - ilk implementasyon önceliği `admin_cancel_reservation` olur
  - sonra `admin_reopen_listing`
  - en son `admin_confirm_reservation`
- Neden bu sıra:
  - iptal ve yeniden açma akışları inventory bütünlüğü açısından en yüksek operasyonel riski taşır
  - confirm akışı callback sonrası doğal finalizasyonla daha yakın çalışır; cancel/reopen daha fazla manuel hata riski taşır

### Faz 5.6: Checkout intake / pre-payment contact bilgisi
- Amac:
  - odeme oncesi ofisin musteriye hizli ulasmasini ve belge surecini hazirlamasini saglayacak minimum operasyonel bilgiyi toplamak
- Tasarim kurali:
  - intake bilgisi checkout create authoritative sinirinda dogrulanir ve reservation ile birebir iliskili ayri bir tabloda tutulur
  - `reservations` tablosu state/stay parametreleri icin sade kalir
  - public read modelleri intake bilgisini asla dondurmez
  - admin read/snapshot yuzeyleri yalnizca ofis operasyonu icin gereken sanitize alanlari gosterir
- Toplanacak minimum alanlar:
  - ad soyad
  - telefon / WhatsApp
  - opsiyonel e-posta
  - tercih edilen iletisim kanali
  - opsiyonel tercih edilen iletisim zamani
  - farkliysa kalacak kisi ad soyad
  - belge hazirlik durumu
  - kisa musteri notu
- Kapsam disi hassas alanlar:
  - TC kimlik, pasaport, oturum izni, belge upload, maas/banka/kefil evraki, imzali kontrat, kart/banka hesap bilgisi ve mevcut acik adres
- TDD sirasi:
  - once checkout create SQL/route contract testleri kirmiziya dusurulur
  - sonra migration/RPC ve route parser minimum implementasyonla yesile cekilir
  - en son admin read/snapshot yuzeyine intake alanlari eklenir

### Faz 6: Content backend
Durum: tamamlandi. 2026-04-30 itibariyla Faz 6 Payload content backend
kapisi gecildi.

Kapanis ozeti:
- Payload CMS content siniri `/cms` altinda korundu.
- `blog_categories`, `blog_posts` ve `consultants` koleksiyonlari eklendi.
- Content read/write access helper'lari admin/public ayrimini net uygular.
- Reservation/order/payment/listing gibi operasyonel Supabase cekirdegi Payload'a
  alinmadi.
- Phase 6 kapsam disi public API/UI ve MCP read yuzeyi eklenmedi.

Kapanis dogrulamasi:
- `node --experimental-strip-types --test tests/phase6-payload-content-config.test.mts`
- `node --experimental-strip-types --test tests/phase6-payload-content-access.test.mts tests/phase6-payload-content-config.test.mts`
- `node --experimental-strip-types --test tests/payload-security.test.mts tests/phase5-task3-payload-admin-config.test.mts`
- `npm test`

- Payload içerik backend’i olarak kalır.
- İlk içerik modülleri:
  - `blog_posts`
  - `blog_categories`
  - `consultants`
- Payload yalnızca içerik/CMS yönetimi için kullanılır.
- Reservation/order/payment çekirdeği Payload içine alınmaz.

### Faz 7: Communication layer

Durum: tamamlandi. 2026-04-30 itibariyla Faz 7.1 communication data
contract, Faz 7.2 Chatwoot identity/client helper katmani, Faz 7.3
conversation open route, Faz 7.4 conversation read + messages
route'lari ve Faz 7.5 communication contract dokumantasyonu kodlandi.
Faz 7.3 sonrasi claim race fix (`23505` -> 409, conflict-safe RPC
insert) uygulandi.

Aktif alt plan:
- `docs/superpowers/plans/2026-04-30-phase7-communication-layer.md`
- `docs/superpowers/plans/2026-04-30-chatwoot-conversation-claim-race-fix.md`

Tamamlanan alt fazlar:
- Faz 7.1:
  - `chatwoot_conversations` mapping tablosu eklendi.
  - Unique contract `user_id + listing_id` olarak sabitlendi.
  - User-own read ve admin read RLS siniri kuruldu.
  - Conversation claim/complete/fail RPC modeli eklendi.
  - Fresh provisioning duplicate conversation acmayi engeller; stale
    provisioning ve failed kayitlar reclaim edilebilir.
- Faz 7.2:
  - Chatwoot server-side helper katmani eklendi.
  - `CHATWOOT_BASE_URL`, `CHATWOOT_INBOX_IDENTIFIER` ve
    `CHATWOOT_HMAC_TOKEN` eksikse fail-closed davranir.
  - HMAC identity token server-side uretilir; frontend secret veya token
    uretim mantigi tasimaz.
  - Contact, conversation ve message request helper'lari raw provider
    response/secret sizdirmeyecek sekilde sinirlanir.
- Faz 7.3:
  - `POST /api/communications/listings/:listingId/conversation` route'u
    TDD ile uygulandi.
  - Supabase auth zorunlu; state-changing JSON POST icin trusted origin,
    content-type ve body limit guard'lari uygulaniyor.
  - existing ready mapping Chatwoot'a yeni network call yapmadan ayni
    conversation dondurur.
  - Mapping yoksa DB claim alinir, Chatwoot contact/conversation
    olusturulur, opsiyonel initial message gonderilir ve mapping ready
    yapilir.
  - Chatwoot hatasinda mapping failed yapilir, response `502` olur ve
    raw provider payload disari sizmaz.
  - Claim race fix: `claim_chatwoot_conversation` RPC artik
    `INSERT ... ON CONFLICT ON CONSTRAINT do nothing` + `SELECT FOR
    UPDATE` fallback ile race-safe; route layer SQLSTATE `23505` icin
    deterministik `409` mapping yapar.
- Faz 7.4:
  - `GET /api/communications/listings/:listingId/conversation` route'u
    eklendi (sadece ready mapping veya 404).
  - `GET /api/communications/conversations/:conversationId/messages`
    route'u eklendi; ownership guard ve customer-facing sanitization
    (private/activity/template filtreli) uygulandi.
  - `POST /api/communications/conversations/:conversationId/messages`
    route'u eklendi; provider response sanitize edilemezse `502`
    fail-closed.
  - Tum davranis `tests/phase7-communication-read-messages-route.test.mts`
    altinda route-level testlerle korunuyor.
- Faz 7.5:
  - `docs/COMMUNICATION_CONTRACT.md` eklendi (endpoint reference,
    status code haritasi, response envelope, sanitization kurallari,
    concurrency contract, security boundaries, known limitations).
  - Faz 7 kapanis dogrulamasi `phase7-chatwoot-client`,
    `phase7-communication-route`,
    `phase7-communication-read-messages-route`,
    `phase7-chatwoot-concurrency-contract` testleri ve `npm test` ile
    yapildi. SQL smoke runner bu kanonik workspace'te yok; kontrat ve
    route testleri tek dogrulama katmani olarak kabul edildi ve
    docs/COMMUNICATION_CONTRACT.md'de known limitation olarak
    isaretlendi.

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

### Faz 8: Admin listing ve fiyat konfigurasyon yonetimi

Durum: planlandi. Bu faz, admin panelin sadece operasyon dashboard'u
olmaktan cikip ilani ve checkout konfigurasyonunu yonetebilir hale gelmesini
saglar.

Amaç:
- Admin kullanicilar listing, listing image, main item ve service option
  konfigurasyonlarini bu repo icindeki admin yuzeyinden yonetebilir.
- Public frontend yine ayri kapsamdir; burada yalnizca admin write yuzeyi,
  route/RPC boundary ve read model etkileri ele alinir.

Katman karari:
- Supabase source-of-truth olmaya devam eder.
- Listing fiyatlari, main item katalogu, listing main item option'lari,
  service catalog ve listing service option'lari DB/RPC veya dar admin route
  sinirinda yonetilir.
- Payload content backend'i operasyonel listing source-of-truth'u olmaz.
- Admin UI direct tablo write yapmaz; route/RPC guard ve RLS/constraint
  sinirindan gecer.

Kapsam:
- Listing create/update/deactivate/reactivate icin admin route/RPC kontrati.
- Listing image ekleme/silme/siralama icin minimum admin kontrat.
- Main item option aktif/pasif, fiyat override ve label yonetimi.
- Service option aktif/pasif, fiyat override ve listing baglantisi.
- Satis/kiralik ayrimi:
  - satilik listing icin checkout/main item/service konfigurasyonu beklenmez.
  - kiralik listing icin checkout eligibility DB konfigurasyonundan gelir.
- Admin operations UI icinde veya ayri `/admin/listings` yuzeyinde bu
  kontrollerin gorunmesi.

TDD kapisi:
- Admin olmayan kullanici write route'larini kullanamaz.
- Invalid price, duplicate code, inactive listing ve sale/rent uyumsuzluklari
  DB constraint/RPC testleriyle reddedilir.
- Admin UI helper/view model raw private alan veya service-role-only veri
  tasimaz.
- Public read modelleri admin-only konfigurasyon detaylarini gereksiz
  sizdirmaz.

#### Faz 8.5: Functional admin listings UI completion

Durum: uygulanmakta. Bu alt faz, admin listing UI'nin backend kontratlarini
kullanabildigini kanitlar; ancak Phase 8 kapanis kalitesi icin tek basina
yeterli degildir.

Kapsam:
- `/admin/listings` ekraninda listing secme, create/update, image add/delete,
  main item config ve service config aksiyonlari calisir.
- Admin mevcut `main_item_catalog` ve `service_catalog` kayitlarini listing'e
  baglayabilir.
- Bu alt faz global katalog yonetimi yapmaz; sadece mevcut katalogdan ilana
  baglama akisidir.

Kapanis kapisi:
- Admin listing client/controller/view-model testleri yesildir.
- Phase 8 route testleri yesildir.
- Ekranin urun kalitesi Faz 8.6'da ayrica ele alinir.

#### Faz 8.6: Admin listings product UX upgrade

Durum: tamamlandi (2026-05-01). Mevcut teknik/admin listing ekrani
profesyonel, anlasilir ve guven veren bir operasyon yuzeyine cevrildi.

Kapsam:
- Ortak admin shell/sidebar ve `/admin` dashboard iskeleti.
- `/admin/listings` bilgi mimarisinin yeniden duzenlenmesi.
- Ana odeme kalemi ve ek hizmet baglama akislarinin admin tarafindan net
  anlasilir hale getirilmesi.
- Checkout-ready eksiklerinin checklist ve yonlendirme olarak gosterilmesi.
- TailAdmin ve shadcn kaynaklari yalnizca UI donor/reference olarak kullanilir;
  backend/RPC/RLS karar modeli degismez.

Kapanis kapisi (tumunu gecti):
- Admin browser'da katalogdan ana odeme kalemi ekleyebilir ve eklenen kalemi
  listede gorur. (dogrulandi: seed'deki `smoke-admin@example.test` ile
  `Phase 8 Rent With Main` uzerinde 2 ana kalem + 1 hizmet baglanmis halde
  listede gorundu)
- Admin browser'da katalogdan ek hizmet ekleyebilir ve eklenen hizmeti listede
  gorur. (dogrulandi: ayni smoke oturumu)
- Katalog bos veya tum ogeler bagliysa UI bunu teknik olmayan bir empty state
  ile aciklar. (dogrulandi: `Phase 8 Rent With Main` icin
  `Eklenebilir ana odeme kalemi yok...` empty state gorundu)
- Kiralik listing checkout-ready degilse eksikler ekranda net gorunur.
  (dogrulandi: `Phase 8 Rent Without Main` icin tab ve side panel ayni
  checklist'i gosterdi: `Aktif ana odeme kalemi eksik`,
  `Aktif ek hizmet eksik`)
- Desktop ve mobile browser smoke yapildi.

Smoke notu (2026-05-01, Playwright MCP):
- `/admin` dashboard: sidebar (Dashboard/Ilanlar/Operasyonlar/CMS), header,
  Hizli erisim ve Operasyon yuzeyleri kartlari dogru linklerle render.
- `/admin/listings` desktop: liste, filtreler, 5 tab (Genel Bilgiler,
  Gorseller, Ana Odeme Kalemleri, Ek Hizmetler, Checkout Hazirligi) ve side
  readiness paneli tutarli. Genel Bilgiler gruplari (Temel/Konum/Fiyat/
  Ozellikler/Aciklama), status action satiri (`Su an aktif/pasif` chip +
  `Aktiflestir`/`Pasife al` ile dogru disabled durumu), `Ilan bilgilerini
  kaydet` butonu gorunuyor.
- Gorseller paneli URL-only helper not'u, empty state ve `Gorsel ekle`
  kutusu ile cikti.
- Ana Odeme Kalemleri ve Ek Hizmetler panelleri raw sayi label'lari
  (`Varsayilan tutar: Yok`, `Varsayilan carpan: 1.5`, `Varsayilan fiyat:
  500`) kullandi; currency uydurmadi.
- Readiness mapping: SALE icin `Checkout uygulanmaz` + not-applicable
  mesaji; ready rent icin `Checkout hazir`; missing rent icin
  `Hazir degil` + missing key checklist.

Residual risk:
- Mobile viewport (420x900) smoke'unda shell sidebar fixed kaliyor,
  dedicated hamburger toggle yok. Icerik stack ediliyor ve erisilebilir
  ama mobile collapse bir sonraki polish turunde ele alinabilir. Bu
  kapanis kapilarini bloklamaz.

Plan:
- Ayrintili uygulama plani:
  `docs/superpowers/plans/2026-05-01-phase8-6-admin-ui-productization.md`

#### Faz 8.7: Phase 8 hardening, docs and closure

Durum: planlandi. Faz 8.5 ve Faz 8.6 gecmeden Phase 8 kapanmis sayilmaz.

Kapsam:
- `docs/ADMIN_LISTING_CONFIG_CONTRACT.md` son haline getirilir.
- Phase 8 narrow testleri, `npm test`, gerekirse `npm run build` calistirilir.
- Browser smoke sonucu dokumante edilir.
- Verification gap varsa komut ve gerekce acik yazilir.

Kapanis kapisi:
- Admin listing konfigurasyonu hem backend kontratlari hem de kullanilabilir
  admin UI acisindan dogrulanmistir.

### Faz 9: Belge sureci ve backoffice takip modeli

Durum: planlandi. Bu faz, odeme sonrasi gercek hayatta yurutulen belge ve
kontrat takip surecinin admin tarafinda gorunur ve denetlenebilir olmasini
saglar.

Amaç:
- Admin panelde `belge istendi`, `bekleniyor`, `tamamlandi`,
  `basarisiz/eksik` gibi operasyonel durumlar gorulur ve kontrollu sekilde
  degistirilir.
- V1'de hassas belge upload'i, TC/pasaport/oturum izni dosyalari, banka
  dokumu, maas bordrosu veya imzali kontrat dosyasi toplanmaz.

Katman karari:
- Belge sureci durumlari Supabase operasyonel backend'de tutulur.
- Kritik state degisiklikleri explicit workflow RPC/route ile audit/event
  yazar.
- Payload yalnizca icerik/CMS icin kalir; belge state source-of-truth'u olmaz.

Kapsam:
- Reservation/order ile iliskili belge takip durumu.
- Admin notu, son guncelleyen admin ve timestamp bilgisi.
- `admin_request_documents`, `admin_mark_documents_waiting`,
  `admin_mark_documents_completed`, `admin_mark_documents_failed` benzeri
  explicit workflow'lar.
- Admin snapshot/read modelde belge durumunun gorunmesi.
- Operations UI'da belge durum butonlari ve son event ozeti.

TDD kapisi:
- Normal kullanici baska kullanicinin belge takip bilgisini okuyamaz.
- Admin disi kullanici belge workflow cagiramaz.
- Terminal/cancelled reservation icin uygunsuz belge transition reddedilir.
- Workflow event/audit kaydi yazilmadan state degismez.

### Faz 10: Iade, kapora ve conflict operasyon modeli

Durum: planlandi. Bu faz hukuki/product karar netlestirme gerektirir; karar
netlesmeden otomatik finansal state machine implementasyonu yapilmaz.

Amaç:
- Basarisiz odeme, conflict callback, musteri caymasi ve kapora yanma
  durumlari admin panelde gorunur ve kontrollu operasyon akisi olusturur.
- Is Bankasi tarafinda otomatik refund entegrasyonu ancak provider kontrati ve
  hukuk/product karari netlestikten sonra eklenir.

Karar bekleyen konu:
- `iade tam olacak` ile `kapora yanar` ayrimi kesinlestirilecek.
- Kaporanin hangi sure boyunca evi tuttugu ve hangi iptal zamaninda yanacagi
  tarih/saat bazli test edilebilir kurala cevrilecek.
- Emlak komisyonu ve provider fee davranisi yazili hale getirilecek.

Kapsam:
- Payment/order/reservation icin `refund_required`, `refund_requested`,
  `refund_completed`, `deposit_forfeited`, `manual_resolution_required`
  gibi operasyon durumlari veya event tipleri.
- Conflict payment gorunurlugu ve manuel takip aksiyonu.
- Admin UI'da failed/conflict/refund bekleyen islerin filtrelenmesi.
- Audit trail: kim, neden, hangi tutar/kalem icin karar verdi.

TDD kapisi:
- Hukuki karar metni olmadan para iadesi otomatik tetiklenmez.
- Admin disi refund/forfeit workflow cagiramaz.
- Amount drift, missing payment, terminal state ve ownership drift
  fail-closed davranir.
- Event yazilmadan refund/forfeit state'i degismez.

### Faz 11: Satilik ilan lead/basvuru akisi

Durum: planlandi. Proje sadece kiralik degildir; satilik ilanlarda odeme ve
ek hizmet yoktur, temel akis iletisim/basvuru odaklidir.

Amaç:
- Satilik listing public read modelde gorunur.
- Satilik listing icin checkout acilmaz.
- Kullanici satilik ilan hakkinda iletisim/basvuru/konusma baslatabilir.

Katman karari:
- Satilik lead/basvuru verisi Supabase'de tutulur veya Faz 7 Chatwoot
  conversation mapping ile iliskilendirilir.
- Chatwoot conversation, listing baglamini tasir; ana is verisinin sahibi
  Chatwoot olmaz.

Kapsam:
- Satilik ilan icin contact/lead route veya communication route davranisi.
- Admin panelde satilik lead/conversation gorunurlugu.
- Satilik ilanlarda service/main item/payment alanlarinin UI/API tarafinda
  beklenmemesi.

TDD kapisi:
- Sale listing checkout create/quote akisi reddedilir.
- Sale listing conversation/lead akisi listing ile iliskili kayit uretir.
- Admin disi kullanici baska kullanicinin sale lead kaydini okuyamaz.

### Faz 12: Launch hardening ve production readiness

Durum: planlandi. Faz 7-11 tamamlanmadan production release hazir sayilmaz.

Kapsam:
- CI tarafinda DB/RLS/security suite gate'i netlestirilir; migration/RPC
  degisikliklerinde `npm run test:db-security` PR seviyesinde kosulur.
- Production canonical origin eksikse localhost fallback'e dusen yuzeyler
  fail-closed hale getirilir.
- `/api/payment/callback` icin Cloudflare/WAF rate limit, method/content-type
  allowlist ve body-size guard'lari deploy checklist'ine eklenir.
- Required production env vars eksikse auth, payment, Payload server URL,
  Chatwoot ve trusted-origin yuzeyleri sessiz fallback kullanmaz.
- Production migration chain temiz veritabaninda kurulabilir ve test-only
  hook/sentinel barindirmaz.
- Privileged write surface'ler tek authoritative route/RPC sinirinda kalir;
  direct client-executable bypass yollari revoke edilir veya intentional
  olarak dokumante edilir.

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
- Admin operations UI:
  - bu repo kapsamindadir
  - `/admin/operations` Payload admin altinda operasyonel yuzey olarak kalir
  - eligibility ve critical state kararlarini UI hesaplamaz; snapshot/RPC
    boolean'larini ve workflow route sonucunu kullanir
- Communication:
  - ayni user + ayni listing icin tek conversation mapping hedeflenir
  - HMAC identity token server-side uretilir
  - Chatwoot provider response'u sanitize edilmeden client'a donmez
  - raw provider payload, HMAC secret ve service-role-only veri UI/API
    response'larina sizmaz

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

### Communication
- `chatwoot_conversations` user/listing uniqueness ve RLS davranisi SQL
  testleriyle dogrulanir
- Chatwoot HMAC helper deterministik uretim, eksik env fail-closed ve secret
  sizdirmeme testlerinden gecer
- conversation open route unauthenticated, invalid UUID, non-json,
  untrusted origin, oversized body ve provider failure senaryolarini testler
  ile sabitler
- existing ready mapping yeni Chatwoot conversation network call'i yapmaz
- Chatwoot failure halinde mapping failed olur ve raw provider payload donmez

### Admin operations
- Admin UI client helper'lari `credentials: "same-origin"` ve
  `cache: "no-store"` kullanir
- Operations view model raw callback payload, exact address ve service-role-only
  veri tasimaz
- Workflow butonlari yalnizca snapshot eligibility boolean'larindan acilir
- State-changing admin route'lar auth/profile/origin/body guard'larini
  fail-closed uygular

### Sistem sağlığı
- `bash .codex/scripts/test.sh`
- `npm run build`
- migration smoke testi
- RLS smoke testi
- payment callback integration smoke testi

## Varsayımlar ve Sabit Tercihler

- Payload kaldırılmayacak; içerik backend olarak kalacak.
- Inngest çekirdek modelin temeli olmayacak; sadece gerçekten gereken orchestration alanında kullanılacak.
- Blog/content backend Faz 6'da Payload uzerinde tamamlandi; public content API/UI ayri kapsamdir.
- Chatwoot Faz 7'de backend contract olarak uygulanir; widget/custom chat UI ve anonymous lead chat V1 Faz 7 kapsaminda degildir.
- Admin operasyon paneli bu repo kapsamindadir; public frontend yine ayri ekip/scope olarak kalir.
- Migration tarafında temel ekip standardı versioned Supabase migration dosyaları olacak.
- `supabase db diff`, migration üretimini kolaylaştıran yardımcı araç olarak kullanılabilir; ancak tek kaynak gerçeklik migration dosyalarıdır.
- Atomik ödeme tamamlama akışı, callback handler içinde değil, tek DB function çağrısında çözülecek.
- Supabase-first yaklaşımı, capability audit ile her faz başında yeniden yorumlanmayacak; Faz 0.5 çıktısı temel karar matrisi olarak kullanılacak.
