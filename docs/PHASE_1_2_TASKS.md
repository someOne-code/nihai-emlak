# Faz 1 + Faz 2 Harmanlanmış Somut Geliştirme Görevleri

## Özet

Amaç, çekirdek Supabase veri modelini ve minimum gerekli auth/RLS omurgasını birlikte kurmaktır.  
Bu görev seti, backend’in ilk gerçek uygulama turunu kapsar ve `IMPLEMENTATION_PLAN.md` içindeki Faz 1 ile Faz 2’yi kontrollü şekilde birleştirir.

Varsayılan günlük takip dokümanı budur; capability veya katman seçimi tartışmalarında `SUPABASE_CAPABILITY_AUDIT.md` referans alınır.

Ana prensipler:
- Tek kaynak gerçeklik: versioned Supabase migration dosyaları
- Auth/RLS, şemadan ayrı değil; şema ile birlikte tasarlanır
- `proxy.ts` sadece ağ sınırında kalır, veri yetkisi DB’de çözülür
- Erken optimizasyon yok; yalnızca gerçekten gereken güvenlik ve veri bütünlüğü kurulur
- Uygulama modeli: `Red -> Green -> Refactor`

## Çalışma Yöntemi

- Bu task listesi test-driven development ile uygulanır.
- Her görevde zorunlu sıra:
  1. görevi seç
  2. `SUPABASE_CAPABILITY_AUDIT.md` ile katman kararını doğrula
  3. beklenen davranışı test ile yaz veya mevcut testi güncelle
  4. testi kırmızıya düşür
  5. minimum kodu yaz
  6. testi yeşile çek
  7. gerekiyorsa refactor et ve tekrar çalıştır
- İlgili test katmanı:
  - migration / RLS / DB function -> SQL testleri
  - route / helper / parser / validator -> Node veya TypeScript testleri
  - repo sağlığı -> `npm test`, `bash .codex/scripts/test.sh`, gerekirse `npm run build`
- Bir görev, ilgili test katmanı geçmeden tamamlandı sayılmaz.

## Görev Listesi

### Görev 0: Supabase capability audit
- Şema yazımına başlamadan önce kısa bir capability audit hazırlanır.
- Amaç, her ana ihtiyacı Supabase native imkanlarla eşleştirip gereksiz custom code yazmamaktır.
- Audit formatı:
  - ihtiyaç
  - `Supabase native`
  - `ince custom`
  - `dış sistem`
  - alınan karar
- İlk audit kapsamı:
  - auth ve session: Supabase Auth
  - own-data authorization: RLS
  - profiles genişletme: `auth.users` + trigger + `profiles`
  - public/admin read modeli: view/RPC + RLS
  - veri yoğun state transition: DB function
  - webhook doğrulama: route handler veya Edge Function
  - uzun işler: Inngest veya Edge Function background task
  - içerik: Payload
  - chat identity: Chatwoot + server-side HMAC
- Audit sırasında şu negatif kararlar da yazılı hale getirilir:
  - `db_pre_request` genel authorization çözümü olarak kullanılmaz
  - `service_role` varsayılan erişim modeli olmaz
  - veritabanı içinde çözülebilecek yoğun transaction mantığı gereksiz uygulama koduna taşınmaz

Bitti kriteri:
- capability audit matrisi dokümana eklenmiştir
- Faz 1 ve Faz 2 görevlerinde hangi işin Supabase native, hangisinin ince custom olduğu nettir
- ilk migration yazımına geçmeden önce belirsiz mimari karar kalmamıştır

### Görev 1: Supabase migration omurgasını başlat
- İlk migration dosyasını oluştur: `01_initial_setup`
- Bu migration içine temel extension ve enum setini koy:
  - `pgcrypto`
  - `btree_gist` yalnızca ileride kullanılacağı için şimdiden eklenebilir
  - `listing_type`
  - `listing_status`
  - `reservation_status`
  - `order_status`
  - `payment_status`
- `supabase/config.toml` içindeki migration akışı mevcut repo standardıyla uyumlu kalır; declarative schema kullanılmaz, migration dosyaları esas alınır.

Bitti kriteri:
- `supabase db reset` temiz çalışır
- enum tipleri ve extension’lar veritabanında görünür
- enum ve extension davranışını doğrulayan SQL veya smoke test eklenmiştir

### Görev 2: Auth tabanı ve `profiles` modelini kur
- `profiles` tablosunu oluştur
- `profiles.id` alanını `auth.users(id)` ile birebir ilişkilendir
- Temel alanları ekle:
  - `id`
  - `email`
  - `full_name`
  - `phone`
  - `role`
  - `created_at`
  - `updated_at`
- Yeni auth kullanıcısı oluşunca `profiles` kaydı üreten trigger/function yaz
- İlk RLS setini yalnızca `profiles` için ekle:
  - kullanıcı kendi profilini okuyabilir
  - kullanıcı kendi profilini güncelleyebilir
  - admin tüm profilleri okuyabilir

Bitti kriteri:
- yeni sign-up sonrası `profiles` kaydı otomatik oluşur
- normal kullanıcı başka profil okuyamaz
- admin tüm profilleri okuyabilir
- bu davranışlar SQL security testleriyle doğrulanır

### Görev 3: Public katalog ve listing tablolarını kur
- Aşağıdaki tabloları tek migration seti içinde oluştur:
  - `consultants`
  - `listings`
  - `listing_images`
  - `service_catalog`
  - `listing_service_options`
- Temel veri bütünlüğü kuralları:
  - fiyat alanlarında `CHECK (price >= 0)`
  - `listing_service_options` için unique `(listing_id, service_catalog_id)`
  - gerekli foreign key’ler
- `consultants` tablosu yalnızca vitrin amaçlı kurulur; `listings.consultant_id` eklenmez
- İlk public RLS kuralları:
  - `listings` için yalnızca aktif kayıtlar public read
  - `listing_images`, `service_catalog`, `listing_service_options` public read
  - yönetim yazma yetkileri admin role ile sınırlı

Bitti kriteri:
- anon kullanıcı yalnızca aktif listing okuyabilir
- service ve listing image verileri public okunabilir
- listing ile consultant arasında zorunlu bağ yoktur
- public read ve admin write davranışı testlerle doğrulanır

### Görev 4: İşlemsel tabloları kur
- Aşağıdaki tabloları oluştur:
  - `reservations`
  - `orders`
  - `order_items`
  - `payments`
  - `payment_events`
- `reservations` için şu alanları ekle:
  - `listing_id`
  - `user_id`
  - `move_in_date`
  - `stay_months`
  - `guest_count`
  - `note`
  - `status`
- `orders` ve `order_items` ayrımını koru:
  - order başlık
  - line item detay
- `order_items` içinde ana ödeme ve ek hizmet ayrımını saklayacak alan ekle
- Bu turda overlap için `EXCLUDE USING GIST` zorunlu değildir; yalnızca `stay_months BETWEEN 1 AND 12` gibi temel check kısıtları eklenir
- İlk own-data RLS kuralları:
  - kullanıcı yalnızca kendi reservation/order/payment kayıtlarını okuyabilir

Bitti kriteri:
- transactional tablolar FK ve check’lerle oluşur
- kullanıcı yalnızca kendi reservation/order/payment verisini okuyabilir
- henüz callback veya checkout logic yazılmadan veri modeli hazır olur
- own-data RLS ve temel constraint davranışları SQL testleriyle doğrulanır

### Görev 5: Admin erişim modelini minimum düzeyde kur
- Erken aşamada zorunlu olmayan `SECURITY DEFINER` helper’ları hemen yazma
- Önce sade role tabanlı RLS kur:
  - admin tüm kritik tabloları okuyabilir
  - admin gerekli tablolarda güncelleyebilir
- Eğer sade RLS’de performans veya tekrar problemi çıkarsa sonraki task olarak `get_user_role()` helper’ı eklenir
- Bu task’ta amaç, backoffice’in en azından read/update yapabilmesidir; tam optimizasyon değildir

Bitti kriteri:
- admin rolündeki kullanıcı `profiles`, `listings`, `reservations`, `orders`, `payments`, `payment_events` üzerinde gerekli okuma erişimine sahiptir
- normal kullanıcı aynı verilere erişemez
- admin ve non-admin ayrımı testlerle doğrulanır

### Görev 6: Checkout veri kontratını ve DB hazırlığını sabitle
- Henüz tam API implementasyonu yapmadan önce DB tarafını checkout’a hazırla
- `orders` ve `order_items` modelinde şu kuralları karşılayacak alanları sabitle:
  - `main_items[]` en az 1
  - duplicate ana kalem yok
  - service item’lar listing bazlı seçilebilir
- Bu task’ta şu iki şey netleşir:
  - line item tipleri nasıl tutulacak
  - pending payment kaydı nasıl temsil edilecek
- İster enum ister text constraint ile çöz, ama implementer karar bırakılmamalı: `main_item`, `service_item` ayrımı yazılı olmalı

Bitti kriteri:
- checkout request’ini taşıyacak tablo alanları eksiksizdir
- order/order_items modeli ana kalem + ek hizmet mantığını karşılar
- ileride API yazarken schema değişikliği gerekmeyecek seviyede netleşmiştir
- checkout validation davranışı önce testle tanımlanmıştır

### Görev 7: Atomik ödeme tamamlama DB fonksiyonunu kur
- `process_payment_checkout` benzeri tek DB function yaz
- Function şunları tek transaction sınırında yapar:
  - ilgili siparişi kilitli okur
  - payment event log yazar
  - payment status günceller
  - order status günceller
  - reservation status günceller
  - listing’i pasife çeker
- Çakışma yönetimi:
  - `SELECT ... FOR UPDATE`
  - zaten tamamlanmış siparişte idempotent sonuç
  - listing zaten pasifse `conflict` sonucu
- Callback handler bu task kapsamında yalnızca bu function’ı çağıracak şekilde planlanır; ayrı update zinciri kurulmaz

Bitti kriteri:
- aynı order için eşzamanlı iki çağrıdan yalnızca biri başarıya gider
- ikinci çağrı idempotent/conflict sonucu alır
- function içinde hata olduğunda partial update kalmaz
- duplicate callback, idempotency ve rollback senaryoları testlerle doğrulanır

### Görev 8: Faz 1 doğrulama ve smoke testi
- `supabase db reset`
- local veya linked ortamda temel RLS smoke testleri
- own-data read testleri
- active listing public read testi
- atomik payment function testi
- repo doğrulaması:
  - `bash .codex/scripts/test.sh`
  - `npm run build`

Bitti kriteri:
- migration zinciri temiz kurulabiliyor
- RLS beklendiği gibi çalışıyor
- build ve type/lint geçiyor
- payment function temel conflict/idempotency senaryosunu karşılıyor
- önce dar testler, sonra geniş smoke testler çalıştırılmıştır

## Test Senaryoları

- Yeni auth kullanıcısı oluşunca `profiles` satırı otomatik oluşur
- Anon kullanıcı yalnızca aktif listing’leri okuyabilir
- Authenticated kullanıcı başka kullanıcının reservation/order/payment verisini okuyamaz
- Admin kullanıcı kritik tabloları okuyabilir
- `stay_months = 0` veya `13` olan reservation reddedilir
- Aynı order için iki payment tamamlama çağrısından yalnızca biri başarılı olur
- Payment function hata verdiğinde payment/order/reservation/listing kısmi güncellenmez

## Varsayımlar ve Sabit Tercihler

- `consultants` tablo olarak erken kurulur, ama listing ilişkisi kurulmaz
- `EXCLUDE USING GIST` bu turda zorunlu değildir; gerekirse sonraki task olarak eklenir
- `SECURITY DEFINER get_user_role()` bu turda zorunlu değildir; sade admin role RLS önce gelir
- Source of truth migration dosyalarıdır; `supabase db diff` yalnızca yardımcı araçtır
- Callback API implementasyonu, DB function hazır olduktan sonra bağlanacaktır
- Görev 0 capability audit çıktısı, kalan tüm görevlerde teknik sınır kararı olarak kullanılacaktır
