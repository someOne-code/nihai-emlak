# Faz 3 Somut Gelistirme Gorevleri

## Ozet

Amac, Faz 1 ve Faz 2'de kurulan Supabase veri modeli uzerine checkout backend contract'ini tamamlamaktir.
Bu faz, frontend'in musteri tarafindan secilen ana odeme kalemlerini ve opsiyonel hizmetleri gonderdigi, backend'in bu secimleri listing/admin DB konfigune karsi dogruladigi, fiyati backend tarafinda hesapladigi ve tek checkout isteginden `reservation`, `order`, `order_items` ve pending `payment` urettigi uygulama katmanini kapsar.

Bu dokuman `IMPLEMENTATION_PLAN.md` icindeki Faz 3'un gunluk uygulama panosudur.
Faz 1 + Faz 2 icindeki `Gorev 6`, checkout icin ilk DB kontrati ve constraint hazirligini yapmis kabul edilir; bu dokuman o hazirligi admin-configurable ana kalemler, API, helper, fiyat hesaplama ve entegrasyon davranisina baglar.

Ana prensipler:
- Frontend toplam fiyat gondermez; toplam backend tarafinda hesaplanir.
- Frontend musteri secimini gonderir: listing, tarih, kalis suresi, kisi sayisi, en az bir `main_items`, opsiyonel `service_items` ve not.
- Frontend'in gonderdigi `main_items` keyfi kabul edilmez; secim, emlakci/admin tarafindan yonetilen DB konfigune karsi dogrulanir.
- `service_items` ancak en az bir ana odeme kalemi secilmis request uzerinde anlamlidir.
- Checkout validation once helper/route testleriyle tarif edilir.
- Transaction kritik kayit olusturma mantigi mumkun oldugunca DB function/RPC tarafinda tutulur.
- `service_role` yalnizca kontrollu server-side orchestration icin kullanilir, client erisiminin yerine gecmez.
- `proxy.ts` checkout authorization merkezi olmaz.
- Uygulama modeli: `Red -> Green -> Refactor`

## Calisma Yontemi

- Bu task listesi test-driven development ile uygulanir.
- Her gorevde zorunlu sira:
  1. gorevi sec
  2. `SUPABASE_CAPABILITY_AUDIT.md` ile katman kararini dogrula
  3. beklenen davranisi test ile yaz veya mevcut testi guncelle
  4. testi kirmiziya dusur
  5. minimum kodu yaz
  6. testi yesile cek
  7. gerekiyorsa refactor et ve tekrar calistir
- Ilgili test katmani:
  - request parser / validator -> Node veya TypeScript testleri
  - authoritative checkout pricing -> SQL/RPC testleri
  - checkout RPC / DB function / constraint davranisi -> SQL testleri
  - route davranisi -> Node veya TypeScript route testleri
  - repo sagligi -> `npm test`, `bash .codex/scripts/test.sh`, gerekirse `npm run build`
- Bir gorev, ilgili test katmani gecmeden tamamlandi sayilmaz.

## Gorev Listesi

### Gorev 0: Faz 3 gap check ve katman karari

- Mevcut checkout dosyalarini envantere al:
  - `app/api/checkout/init/route.ts`
  - `lib/payments/checkout-init.ts`
  - `lib/payments/checkout-init-route.ts`
  - `lib/payments/checkout-init-response.ts`
  - `tests/checkout-init-route.test.mts`
  - `tests/checkout-init-route-helper.test.mts`
  - `tests/sql/phase1_task6_checkout_contract.sql`
- Mevcut durum ile Faz 3 hedefini ayir:
  - mevcut `checkout/init`, var olan `orderId` icin Is Bankasi hosted checkout payload'i uretir
  - Faz 3 asil kontrati, checkout request'inden reservation/order/order_items/payment uretmelidir
- Katman kararini yazili hale getir:
  - request parse ve boundary validation: ince custom Next route/helper
  - listing, ana kalem ve secilebilir hizmet lookup: Supabase native table/view/RPC, gerekirse ince helper
  - atomik checkout create: DB function/RPC
  - Is Bankasi hosted checkout payload: mevcut ince helper
- Faz 3'te yeni endpoint ismi netlestirilir:
  - onerilen: `POST /api/checkout`
  - mevcut odeme baslatma endpoint'i: `POST /api/checkout/init`

Bitti kriteri:
- Faz 3 icin eksik davranis listesi netlesmistir
- `checkout/init` ile asil checkout create akisi karistirilmamistir
- hangi isin DB function, hangisinin route/helper oldugu nettir
- ilk test yazimina gecmeden once endpoint ve request contract karari yazili hale gelmistir

### Gorev 1: Checkout request kontratini ve validator'ini sabitle

- Request body icin minimum model:
  - `listing_id`
  - `move_in_date`
  - `stay_months`
  - `guest_count`
  - `main_items`
  - `service_items`
  - `note`
  - kullanici temel bilgileri gerekiyorsa `contact` objesi
- Validation kurallari:
  - authenticated user zorunlu
  - trusted origin kontrolu state-changing cookie-auth POST icin uygulanir
  - `listing_id` UUID olmali
  - `move_in_date` gecerli ISO tarih olmali
  - `stay_months` 1 ile 12 arasinda olmali
  - `guest_count` pozitif integer olmali
  - `main_items` array olmali ve en az bir ana kalem icermeli
  - `main_items` duplicate icermemeli
  - `service_items` duplicate icermemeli
  - frontend tarafindan gonderilen `total`, `amount`, `price` gibi alanlar reddedilmeli
- Validator saf helper olarak yazilir; route ve testler bu helper'i kullanir.

Bitti kriteri:
- invalid JSON 400 doner
- unauthenticated request 401 doner
- untrusted origin 403 doner
- bos `main_items` 400 doner
- duplicate `main_items` 400 doner
- duplicate service item 400 doner
- invalid stay/guest/date 400 doner
- client-supplied total kabul edilmez
- tum davranislar Node/TypeScript testleriyle dogrulanir

### Gorev 2: Listing, ana kalem ve hizmet uygunluk kontrolunu kur

- Checkout yalnizca aktif listing icin baslayabilir.
- Listing lookup backend tarafinda yapilir; client'in listing fiyatina guvenilmez.
- Ana odeme kalemi secimi frontend'den gelir, fakat keyfi kabul edilmez.
- Ana odeme kalemi katalogu ve listing'e bagli secilebilir ana kalemler emlakci/admin tarafindan yonetilecek DB konfigunden okunur.
- Bu konfigurasyon icin Faz 3 kapsaminda gerekirse yeni tablolar eklenir:
  - `main_item_catalog`
  - `listing_main_item_options`
- Listing icin en az bir aktif secilebilir ana odeme kalemi yoksa checkout baslayamaz.
- Request'teki her `main_items` kodu ilgili listing icin aktif ve secilebilir olmalidir.
- Service secimleri listing'e tanimli ve aktif hizmetlerden gelmelidir.
- `listing_service_options` icindeki override fiyat varsa kullanilir; yoksa `service_catalog.base_price` kullanilir.
- Inactive listing checkout'a giremez.
- Inactive service veya listing'e bagli olmayan service checkout'a giremez.
- Satilik/kiralik ayrimi mevcut domain kararlarina gore korunur; satilik akista hizmet/odeme beklentisi farkliysa burada acik testlenir.

Bitti kriteri:
- active listing bulunursa checkout devam eder
- missing listing 404 veya 400 ile reddedilir
- passive listing 409 veya 400 ile reddedilir
- listing icin aktif ana odeme kalemi yoksa 409 ile reddedilir
- request'teki ana kalem secimi listing DB konfigune karsi dogrulanir
- listing'e bagli olmayan ana kalem 400 ile reddedilir
- inactive ana kalem 400 ile reddedilir
- listing'e bagli olmayan service 400 ile reddedilir
- inactive service 400 ile reddedilir
- service fiyatinda override onceligi testlenir

### Gorev 3: Authoritative fiyat hesaplama katmanini DB/RPC olarak sabitle

- Nihai checkout fiyatinin source-of-truth'u TypeScript helper degil PostgreSQL olmalidir.
- `POST /api/checkout` veya ilerideki checkout create route'u, Node tarafinda uretilmis `totalAmount` degerini DB'ye yazmaz.
- Fiyat hesaplama girdileri RPC icinde DB'den okunur:
  - listing base price
  - request'ten normalize edilmis secili ana kalem kodlari
  - listing'e bagli aktif ana kalem konfigurasyonu
  - ana kalem fiyat tipi ve ilan bazli override fiyatlari
  - secilen service item kodlari
  - listing service override fiyatlari
  - kalis suresi gerekiyorsa `stay_months`
- Main item kodlari implementer kararina birakilmaz; admin/DB katalogunda tanimli set kullanilir.
- Hesaplama sonucu DB tarafinda uretilir:
  - `order.total_amount`
  - `order.currency`
  - `order_items` satirlari icin code, label, item_type, amount, listing_id, service_catalog_id
- Rounding ve currency davranisi DB testleriyle sabitlenir:
  - para birimi default `TRY`
  - toplam, line item toplamlariyla birebir uyumlu olur
  - negatif veya NaN tutar uretilemez
- Fiyat onizlemesi gerekiyorsa ayri bir `checkout quote` akisi eklenir; o akisin da authoritative sonucu DB/RPC'den gelir.

Bitti kriteri:
- frontend total gondermese de DB/RPC toplam hesaplar
- frontend total gonderse bile sonuc DB verisinden hesaplanir
- secili ana kalemler request'ten gelir, fakat fiyat/uygunluk DB config'den hesaplamaya girer
- duplicate service item hesaplamaya giremez
- line item toplamiyla order toplam tutari eslesir
- Node.js tarafinda authoritative checkout pricing motoru bulunmaz
- fiyat davranisi SQL/RPC testleri gecmeden route implementasyonu tamamlanmis sayilmaz

### Gorev 4: Atomik checkout create DB function/RPC tasarla

- Tek checkout create akisi su kayitlari atomik uretir:
  - `reservations`
  - `orders`
  - `order_items`
  - pending `payments`
- Function/RPC input'u route tarafinda normalize edilmis istek ve backend tarafinda okunmus/hesaplanmis veriyle sinirli tutulur.
- Function icinde:
  - listing halen aktif mi kontrol edilir
  - request'teki secili ana kalemler listing'e bagli guncel konfigurasyona karsi kontrol edilir
  - reservation pending olusturulur
  - order pending olusturulur
  - ana kalem ve hizmet `order_items` satirlari olusturulur
  - pending Is Bankasi payment olusturulur
  - `provider_ref` ve Is Bankasi `oid` kontrati payment id ile uyumlu kalir
- Function manuel `BEGIN/COMMIT` kullanmaz; tek statement/transaction sinirinda calisir.
- Partial insert kalmamasi testlenir.

Bitti kriteri:
- valid checkout tek RPC ile reservation/order/order_items/payment uretir
- function hata alirsa partial reservation/order/payment kalmaz
- generated pending payment order ve user ile iliskilidir
- `provider_ref = payment.id` kontrati korunur
- SQL testleri bu davranisi dogrular

### Gorev 5: Checkout create route'unu bagla

- Onerilen endpoint: `POST /api/checkout`
- Route sorumluluklari:
  - Supabase Auth ile user'i al
  - request origin kontrolu yap
  - request body parse et
  - validator'i calistir
  - normalize edilmis checkout intent'i Supabase RPC'ye gonder
  - listing/main item/service uygunluk ve fiyat hesaplama sonucunu DB/RPC'den al
  - checkout create RPC'yi cagir
  - response olarak reservation/order/payment ozetini don
- Route, payment callback state transition yapmaz.
- Route, listing'i pasife cekmez; bu Faz 4 callback function sorumlulugudur.
- Route, client total'a guvenmez.
- Route, client main item secimini DB/admin konfigune karsi dogrulamadan kullanmaz.

Bitti kriteri:
- unauthenticated request 401
- untrusted origin 403
- invalid request 400
- inactive listing 409 veya 400
- valid request 201 veya 200 ile checkout summary doner
- response icinde payment status `pending` olur
- route testleri DB'siz mock dependency ile gecerlidir

### Gorev 6: Checkout init ile checkout create arasindaki kontrati temizle

- `POST /api/checkout/init` yalnizca var olan pending order/payment icin Is Bankasi hosted checkout payload uretir.
- `POST /api/checkout` yeni checkout kayitlarini olusturur.
- Frontend akisi iki adim olarak netlesir:
  - once checkout create
  - sonra payment init
- Alternatif olarak tek adim secilecekse, `POST /api/checkout` response'u Is Bankasi payload'ini da doner; bu karar test ve dokumanda net yazilir.
- Endpoint davranislari birbiriyle cakismayacak sekilde response contract'a baglanir.

Bitti kriteri:
- `checkout/init` artik checkout create gibi davranmaz
- `checkout/init` order sahipligini kontrol etmeye devam eder
- pending payment reuse davranisi korunur
- stale/terminal payment rewrite edilmez
- mevcut checkout init testleri regresyon olarak yesil kalir

Not:
- Faz 3 zorunlu kapsami icinde `checkout/init` ince route/helper olarak kalabilir.
- Daha sert bir race hardening ihtiyaci dogarsa, Gorev 6 sonrasinda ayri bir takip isi olarak `internal.prepare_checkout_init_payment(...)` benzeri bir DB function/RPC dusunulebilir.
- Bu takip isinde amac, `order` ve `payment` satirlarini lock + revalidate ederek yalnizca halen `pending` durumda olan payment icin init hazirlamak olur.
- Is Bankasi hosted checkout payload uretimi yine uygulama katmanindaki helper/route tarafinda kalir; DB function yalnizca guvenli pending payment hazirlama sorumlulugunu alir.

### Gorev 7: Checkout sozlesmesini dokumante et

- Frontend ve admin ekipleri icin contract dokumani eklenir veya mevcut README bolumu guncellenir.
- Dokumanda su basliklar yer alir:
  - endpoint
  - auth gereksinimi
  - request body
  - response body
  - hata kodlari
  - fiyat hesaplama kurali
  - ana kalem seciminin frontend'den geldigi, fakat secilebilirlik ve fiyat bilgisinin admin/DB config'den geldigi
  - checkout create ve payment init ayrimi
- Bu dokuman UI implementasyonu degil, backend contract dokumanidir.

Bitti kriteri:
- frontend toplam fiyat gondermeyecegini bilir
- frontend secili ana odeme kalemlerini `main_items` ile gonderecegini bilir
- admin/emlakci ana kalem konfigurasyonunun source-of-truth oldugunu bilir
- UI hangi hata kodlarini bekleyecegini bilir
- Is Bankasi payload'inin hangi endpoint'ten gelecegi nettir
- dokuman implementation ile celismiyor

### Gorev 8: Faz 3 dogrulama ve smoke testi

- Dar helper testleri:
  - request parser
  - validator
  - listing/main item/service eligibility
  - checkout init response helper
- Dar route testleri:
  - checkout create
  - checkout init regresyonlari
- SQL testleri:
  - checkout contract constraints
  - authoritative checkout pricing
  - main item config constraints/RLS
  - checkout create RPC atomiklik
- Repo dogrulamasi:
  - once en dar ilgili test
  - sonra `npm test`
  - DB/RPC degisikligi varsa `npm run test:db-security`
  - faz kapisi icin gerekirse `bash .codex/scripts/test.sh`

Bitti kriteri:
- Faz 3 validator, eligibility, pricing ve route testleri geciyor
- checkout create DB/RPC smoke testi geciyor
- mevcut payment callback ve checkout init regresyonlari kirilmiyor
- dogrulanamayan kisim varsa acik risk olarak yaziliyor

## Test Senaryolari

- Authenticated olmayan kullanici checkout baslatamaz
- Request `main_items` gondermezse veya bos gonderirse reddedilir
- Request duplicate `main_items` gonderirse reddedilir
- Listing icin aktif ana odeme kalemi yoksa checkout reddedilir
- Request'teki ana kalem listing'e bagli degilse reddedilir
- Service item, listing'e bagli degilse request reddedilir
- Inactive listing checkout'a giremez
- Inactive service checkout'a giremez
- Client tarafindan gonderilen toplam fiyat kullanilmaz
- Valid checkout reservation + order + order_items + pending payment uretir
- Order total, order_items toplami ile eslesir
- Ana kalem order_items satirlari frontend secimi + DB/admin fiyat konfigu ile uretilir
- Pending payment `provider_ref = payment.id` kontratini korur
- Checkout create sirasinda hata olursa partial reservation/order/payment kalmaz
- Mevcut `checkout/init` pending payment reuse davranisi bozulmaz
- Terminal payment callback race sirasinda yeniden pending'e cekilmez

## Varsayimlar ve Sabit Tercihler

- Faz 1 + Faz 2 `Gorev 6` DB kontrat hazirligi olarak kabul edilir; Faz 3 API davranisini tamamlar.
- `POST /api/checkout/init` mevcut odeme baslatma endpoint'i olarak korunur.
- Yeni checkout create endpoint'i icin varsayilan onerim `POST /api/checkout` olur.
- Frontend ve admin UI bu fazin kapsaminda degildir.
- Ana odeme kalemi secimi frontend request'inden gelir; secilebilirlik, label ve fiyat emlakci/admin tarafindan yonetilecek DB konfigurasyonundan gelir.
- Bu konfigurasyon icin Faz 3 kapsaminda `main_item_catalog` ve `listing_main_item_options` benzeri migration/RLS/test ihtiyaci dogabilir.
- Listing'i pasife cekme checkout create sirasinda yapilmaz; basarili odeme callback'i sonrasi Faz 4 DB function sorumlulugudur.
- Checkout create icinde uzun sureli isler calistirilmaz.
- Is Bankasi callback, duplicate callback, conflict ve refund akislari Faz 4 kapsaminda kalir.
- Source of truth migration dosyalaridir; DB degisikligi gerekirse yeni versioned migration eklenir.
