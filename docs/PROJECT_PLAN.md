# Toplanti Kararlari - 2026-03-27

Bu not, musteri gorusmesinden cikan kararlarin duzenlenmis halidir.

## Netlesen Kararlar

### Urun Kapsami

- Sistem sadece kiralik degil, satilik ilanlari da gosterecek.
- Ancak odeme akisi kiralik taraf icin olacak.
- Satilik ilanlarda odeme alinmayacak.
- Satilik ilanlarda ek hizmet olmayacak.
- Satilik ilanlarda temel akisin iletisim / basvuru odakli olmasi bekleniyor.

### Kiralama Sinirlari

- Minimum kiralama suresi: 1 ay
- Maksimum kiralama suresi: 1 yil
- 1 yilin uzeri mevcut modelin disinda kaliyor.

### Odeme ve Is Akisi

- Musteri odemeyi yaptiktan sonra ayrica son onay beklemeyecek.
- Odeme yapildiginda ilan artik aktifte kalmayacak.
- "Rezerve" kelimesi tercih edilmiyor.
- Is mantigi su: odeme alininca ilan fiilen kapanacak / pasife dusurulecek.

### Iade ve Kapora

- Genel iade mantigi: iade tam olacak.
- Ancak 1 hafta icinde kiralama islemini keyfi olarak iptal ederse kapora yanacak.
- Emlak komisyon ucreti emlakciya kalacak.

Not:
- Bu kisimta hukuki metin ve kesin is kurali daha sonra avukatla netlestirilmeli.
- "iade tam olacak" ile "kapora yanar" mantigi birlikte kullanildigi icin hukuki ve operasyonel netlestirme gerekir.

### Ana Odeme Kalemleri

Kiralik tarafta ana odeme kalemleri secmeli olabilir:
- kapora
- depozito
- 1 aylik kira bedeli

Notlar:
- Musteri bunlari selectbox benzeri secimli yapiyla dusunuyor.
- Ek hizmetler secilmeden once ana odeme kaleminin secilmesi gerekiyor.
- 6 aylik kira gibi toplu kira odemesi alinmayacak.

### Ek Hizmetler

- Ek hizmetler olacak.
- Ek hizmet fiyatlari sabit degil, duruma gore degisecek.
- Ornek mantik:
  - 100 m2 temizlik = farkli fiyat
  - 500 m2 temizlik = farkli fiyat

Bu nedenle:
- ek hizmetler ilana / duruma gore fiyatlanabilmeli
- sabit katalog + fiyat override mantigi gerekebilir

### Musteriden Ilk Asamada Alinacak Bilgiler

Temel bilgiler alinacak:
- isim
- soyisim
- telefon numarasi
- e-posta

Ayrica:
- odeme oncesi secimlerden sonra bir aciklama alani olabilir
- musteri para gonderirken not / aciklama yazabilsin mantigi dusunuluyor
- bu not alani avukat tarafindan da gerekli gorulmus olabilir

### Belge Sureci

- Belge trafigi site icinde tam yonetilmeyecek.
- Musteri odemeyi yaptiktan sonra belge ve sonraki surecler ekip tarafinda gercek hayatta ilerleyecek.
- Ekip kullaniciya WhatsApp veya telefonla ulasacak.
- Admin panelde odeme yapildi, onay / takip bekliyor gibi gorunurluk isteniyor.

### Mesajlasma

- Her ilan icin ayrica mesaj atilabilecek.
- Kullanici bir ilan hakkinda yazismaya baslayacak.
- Bu konusma kayitli kalacak.
- Daha sonra ayni yerden devam edilebilecek.

Ancak:
- Mesajlar ilgili danismana degil, ofise / on buroya dusecek.
- On buro sureci yonetecek.

### Danisman Yapisi

- Sitede danismanlar gorunsun isteniyor.
- Ancak danismanlar su an vitrin amacli olacak.
- Ilanlara birebir danisman atamasi yapilmayacak.

Bu nedenle net karar:
- `consultants` yapisi sistemde olsun
- ama `listing -> consultant` iliskisi kurulmasin
- mesajlasma ofis inbox'una dussun

### Blog

- Blog olacak.
- Amac SEO ve musteri cekme.
- Icerikleri muhtemelen emlak sirketinin sahibi girecek.
- Hafif blog/CMS yapisi yeterli.

### Dil

Türkçe

### Admin Kullanimi

- Musterinin dedigine gore gunluk kullanim patronun sag kolunda olabilir.
- Ancak pratikte admin sifresine sahip birden fazla kisi kullanabilir.

Bu nedenle:
- tek kisi varsayimina gore gitmemek daha dogru
- temel rol veya en azindan birden fazla admin kullanicisi desteklenmeli

## Bizim Vermemiz Gereken Kararlar

### Cift Islem / Ayni Anda Odeme Baslatma

Onerilen urun karari:
- odeme baslatmak ilani kapatmasin
- odeme tamamlandiginda ilan pasife dusurulsun
- ilk basarili odeme alan kazanir
- yarim kalan odemeler ilani kilitlemesin

Bu, dusuk trafik varsayiminda en sade ve guvenli cozumdur.

## Belirsiz Kalanlar

Asagidaki maddeler hala tam net degil:

1. Ana odeme kalemleri ayni anda birden fazla secilebilecek mi, yoksa tek secim mi olacak?
birden çok secılebılsın.

2. "Iade tam olacak" mantigi ile "kapora yanar" mantigi tam olarak nasil ayrisiyor?
eger kapora süresü içinde örnegın kapora 2 haftayı rezerve etsın. ıade oluşturursa um parayı alır ama kapora 2 hafta dıyor sana rezerve ettık evı doyır sen gıdıyorsun 20 gun sonra ıade ışıyorsun o kapora yanmış olur ıade yok.

3. Aciklama alani sadece havale benzeri not mantigi mi, yoksa serbest not alani mi olacak?
havale benzerı olacak

4. Site dili kesin olarak tek dil mi, iki dil mi olacak?
tek dil

## Emlak Platformu Notlari

### Urun Tanimi

Bu proje klasik marketplace degil.

Hedef urun:
- uzun donem esyali daire kiralayan emlak firmasi icin ilan(MK group)
- rezervasyon / basvuru toplama
- site uzerinden online odeme alma
- opsiyonel ek hizmet satma
- admin panelden surec yonetme

Disaridan bakinca HousingAnywhere benzeri bir deneyim olabilir, ama finansal model ilk asamada daha sade olacak.

### Is Modeli Varsayimi

- Daireler cogunlukla emlak sirketinin kendi portfoyu veya vekalet/yetkiyle yonetiliyor.
- Tahsilat tek sirket hesabina alinacak.
- Ilk surumde gercek marketplace payout / escrow / seller split mantigi olmayacak.
- Sistem "online tahsilatli emlak rezervasyon platformu" gibi calisacak.

### Onerilen Stack

- frontend: Next.js
- auth: Supabase Auth
- database: Supabase Postgres
- yetki: Supabase RLS
- server-side logic: Supabase Edge Functions
- dosya / medya: Supabase Storage
- odeme: Is Bankasi Sanal POS veya hosted payment akisi

### Ana Mimari Kurali

Bu proje icin ana kural:
- Supabase-first ilerlemek ve gereksiz custom backend kodundan kacmak

Bu kuralin anlami:
- once Supabase'in sundugu yerlesik imkanlar kullanilacak
- auth, database, RLS, storage, realtime ve uygun oldugu yerde Edge Functions altyapi olarak tercih edilecek
- guvenlik ve operasyonel riski azaltmak icin gereksiz custom backend katmanlari kurulmayacak
- custom kod sadece urune ozel business rule gercekten baska yerde cozulmediginde yazilacak

Uygulama siniri:
- auth icin sifirdan ayri bir auth sistemi yazilmayacak
- temel veri depolama ve yetkilendirme Supabase uzerinden cozulmeli
- kritik business logic mumkun olan en ince custom katmanla yazilacak
- Supabase ile dogal cozulmeyen reservation / order / payment kurallari custom kod gerektirirse yazilacak
- Next.js server code veya Supabase Edge Functions sadece gerekli oldugu noktada eklenecek

### Sorumluluk Siniri

Bu projede takim ayrimi su sekildedir:
- frontend ayri bir kisi/ekip tarafinda gelistirilecek
- admin panel UI ayri bir kisi/ekip tarafinda gelistirilecek
- bizim sorumluluk alanimiz backend kodudur

Bizim backend kapsamimiz:
- veri modeli
- schema tasarimi
- migration mantigi
- RLS ve yetki kurallari
- reservation / order / payment business logic
- odeme callback ve event log akisi
- chat entegrasyonunun backend siniri
- blog ve icerik modulu icin backend modeli

Kapsam disi:
- public site frontend UI
- ozel admin panel UI
- tasarim, component sistemi ve sayfa kompozisyonu

### Custom Kod Politikasi

Bu projede varsayilan yaklasim:
- gerekmedikce custom kod yazilmayacak
- once Supabase'in yerlesik cozumu var mi diye bakilacak
- Supabase ile cozuluyorsa ayri backend soyutlamasi yazilmayacak

Oncelikli kullanilacak yerlesik imkanlar:
- Supabase Auth
- Supabase Postgres
- Supabase RLS
- Supabase Storage
- Supabase SQL function / trigger / view imkanlari
- Supabase Edge Functions

Custom kod yazilabilecek istisna alanlar:
- Is Bankasi odeme callback dogrulamasi
- reservation / order / order_items olusturma kurallari
- ana kalem + ek hizmet fiyatlama mantigi
- payment success sonrasi listing pasife dusurme ve event log akisi
- Chatwoot ile sistem verisi arasindaki baglanti mantigi

### Supabase-First Karar Matrisi

#### Dogrudan Supabase ile cozulmeli

- kullanici kaydi / girisi / sifre reset:
  - Supabase Auth
- oturum ve cookie tabanli auth:
  - Supabase SSR
- temel veri depolama:
  - Supabase Postgres
- satir bazli yetkilendirme:
  - Supabase RLS
- medya ve dosya yukleme:
  - Supabase Storage
- basit CRUD islemleri:
  - Supabase + SQL + gerekli yerde Payload
- veritabanina yakin basit turev mantik:
  - SQL function / trigger / view
- temel admin veri yonetimi:
  - Payload admin veya Supabase odakli veri modeli
- auth kaynakli kullanici bilgisi:
  - `auth.users` + `profiles`

#### Ince custom katman gerektiren alanlar

- Is Bankasi callback imza dogrulamasi
- hosted payment donus payload'ini normalize etme
- reservation + order + order_items olusturma akisi
- secilen ana kalemleri ve ek hizmetleri fiyatlandirma
- listing bazli service override mantigi
- payment success sonrasi listing pasife dusurme
- payment event log kaydi
- iade / kapora kuralinin uygulanmasi
- ayni kullanici + ayni ilan icin tekil conversation mantigi
- Chatwoot conversation ile listing/user baglama

#### Ilk asamada custom yazilmamasi gereken alanlar

- custom auth provider
- custom session store
- custom ORM katmani
- ayri microservice backend
- ayri queue altyapisi
- custom CMS
- custom file service
- seller split / escrow / marketplace payout sistemi
- tam otomatik belge toplama sistemi

#### Pratik karar kurali

Bir ozellik ekleneceginde su sira izlenmeli:
1. Bu is Supabase'in yerlesik imkaniyla cozuluyor mu?
2. SQL function / trigger / view ile ince ve guvenli sekilde cozuluyor mu?
3. Edge Function veya Next.js server code sadece ince bir orkestrasyon katmani olarak yeterli mi?
4. Hala cozulmuyorsa minimum custom kod yaz.

Son kural:
- custom kod varsayilan degil, istisnadir
- business rule gercekten zorunluysa yazilir
- ayni is Supabase native cozuluyorsa custom katman eklenmez

### Mimari Katmanlar

Bu projede sistem rolleri su sekilde ayrilir:

#### 1. Operational Backend

Ana sistem backend'i budur.

Teknolojiler:
- Supabase Auth
- Supabase Postgres
- Supabase RLS
- Supabase Storage
- Supabase SQL function / trigger / view
- gerekli oldugu yerde Edge Functions

Sorumlu oldugu alanlar:
- users / profiles
- listings
- reservations
- orders
- order_items
- payments
- payment_events
- service_catalog
- listing_service_options
- reservation / order / payment business logic
- odeme callback ve event log akisi
- yetkilendirme ve veri erisim sinirlari

#### 2. Content Backend

Bu katman icerik ve CMS yonetimi icindir.

Teknoloji:
- Payload CMS

Sorumlu oldugu alanlar:
- blog yazilari
- blog kategorileri
- danisman vitrini
- statik icerik sayfalari
- SEO alanlari
- icerik odakli medya yonetimi

Not:
- Payload proje icin gereklidir
- ancak cekirdek operasyon backend'i degildir
- finansal ve rezervasyon mantigi Payload icinde kurulmayacaktir

#### 3. Payment Layer

Teknoloji:
- Is Bankasi hosted payment / sanal POS

Sorumlu oldugu alanlar:
- kullaniciyi guvenli odeme sayfasina yonlendirme
- callback / donus
- banka referanslari
- tahsilat sonucu

Not:
- odeme saglayicisi dis sistemdir
- odeme business logic'i yine bizim operational backend katmanimizda kalir

#### 4. Communication Layer

Teknoloji:
- Chatwoot

Sorumlu oldugu alanlar:
- kullanici ile ofis arasi mesajlasma
- shared inbox
- conversation operasyonu
- ileride WhatsApp benzeri kanal genislemeleri

Not:
- Chatwoot ana veri sahibi degildir
- listing / reservation / user / payment gibi ana is verileri Supabase tarafinda kalir

#### 5. Frontend ve Admin UI

Bu katmanlar ayri ekip/kisi tarafinda gelistirilir.

Not:
- bizim backend kontratlarimiz bu UI'lere veri saglar
- ancak frontend/admin panel tasarimi ve bilesen sistemi bizim kapsamimizda degildir

### Odeme Yaklasimi

Is Bankasi Sanal POS varsa en hizli dogru yol:
- hosted payment / guvenli odeme sayfasi
- mumkunse kart verisini banka tarafinda toplama
- callback / odeme state yonetimini bizim tarafta tutma

Alternatif hizli yol:
- Linkle Tahsilat

Ama uzun vadede daha iyi urun icin tercih:
- Is Bankasi hosted payment

### Ana Checkout Karari

Onerilen V1:
- en az 1 ana odeme kalemi zorunlu
- birden fazla ana odeme kalemi secilebilir
- 0..n opsiyonel ek hizmet

Ana kalem icin ilk tercih:
- kapora/blokaj ucreti

Opsiyonel ek hizmet ornekleri:
- ev temizligi
- boya
- yeni mobilya
- tasinma destegi
- internet / kurulum

Not:
- fiyat toplami frontend tarafinda hesaplanmamalidir
- frontend sadece secimleri yollar
- gercek fiyat, order toplamı ve line item olusumu backend/Edge Function tarafinda yapilmalidir
- ek hizmet secimi, en az 1 ana odeme kalemi secilmeden yapilamaz

En mantikli V1:
- kullanici en az 1 ana odeme kalemi secer
- ayni checkout icinde birden fazla ana odeme kalemi secilebilir
- ek hizmetler sadece ana odeme secimi varsa eklenebilir
- emlakci ana kalemleri ve ek hizmetleri admin tarafinda yonetebilir
- secilebilir ek hizmetler

- ilk ay kira + ek hizmetler

Ilk surumde ayni anda cok sayida zorunlu buyuk kalemle baslamamak daha dogru:
- ilk ay kira
- depozito
- hizmet bedeli
- ek hizmetler

Bu kombinasyon tek checkout'ta fazla buyurse donusumu dusurebilir.

#### Checkout Dogrulama Kurali

Backend tarafinda uygulanacak net kural:
- en az 1 ana odeme kalemi secilmelidir
- birden fazla ana odeme kalemi secilebilir
- ayni ana odeme kalemi bir checkout icinde tekrar edemez
- ek hizmetler ancak en az 1 ana odeme kalemi secildiyse eklenebilir

### Belge Toplama Karari

V1'de siteden tam belge toplama yapilmamali.

Sitede alinacak minimum bilgiler:
- ad soyad
- e-posta
- telefon / WhatsApp
- tasinma tarihi
- kalis suresi
- kisi sayisi
- not / ozel istek
- secilen ek hizmetler
- odeme

Opsiyonel hafif alanlar:
- ogrenci / calisan
- gelir araligi
- evcil hayvan durumu
- sigara kullanimi

Ilk surumde checkout sirasinda toplanmamasi onerilen belgeler:
- pasaport dosyasi
- maas bordrosu
- banka dokumu
- oturum izni
- kefil evraklari
- imzali kontrat

Onerilen surec:
1. reserve + pay
2. documents later

Belgeler odeme sonrasinda admin panel / backoffice sureci ile toplanmali.

### Admin Panelde Olmasi Gerekenler

- listing yonetimi
- basvuru / rezervasyon listesi
- odeme durumu
- basarisiz odemeler
- callback / payment event loglari
- belge istendi / bekleniyor / tamamlandi durumu
- manuel onay / iptal

### Onerilen Temel Veri Modeli

Ana tablolar:
- agencies
- users
- profiles
- consultants
- listings
- listing_images
- service_catalog
- listing_service_options
- reservations
- orders
- order_items
- payments
- payment_events

Tablo rolleri:
- consultants: emlak ofisinin danisman kayitlari
- service_catalog: sistemdeki tum ek hizmetler
- listing_service_options: hangi ilanda hangi hizmet secilebilir
- reservations: kullanicinin ilan icin bir rezervasyon/basvuru kaydi
- orders: tek siparis basligi
- order_items: ana kalem + ek hizmet kirilimi
- payments: banka odeme sonucu
- payment_events: callback / provider event loglari

### Danisman Modeli

Sistemde danismanlar olacak.

Danismanlarin rolu:
- vitrin / guven unsuru olarak sitede gorunmek
- ofisin insan tarafini gostermek
- gerekirse ileride ayri bir atama modeline acik olmak

Bu nedenle V1 veri modeli:
- `consultants` tablosu olsun
- ama `listings.consultant_id` alani olmasin
- listing ile consultant arasinda zorunlu ya da opsiyonel bir bag kurulmasin

Danisman icin tutulabilecek alanlar:
- ad soyad
- telefon
- e-posta
- WhatsApp
- profil fotografi
- unvan
- aktif/pasif durumu
- sira / gorunurluk durumu

Listing tarafinda:
- ilan detayinda genel ofis iletisim akisi calisacak
- mesajlasma ve basvuru akisi ofis / on buro tarafina dusecek
- danismanlar vitrin bileseni gibi listelenebilecek ama ilana baglanmayacak

### Danisman Tarafinda Is Akisi

Beklenen urun davranisi:
- kullanici sitede danisman vitrini gorebilir
- mesaj gonderirse ilgili lead / conversation o ilana bagli olur
- mesajlar ilgili danismana degil ofis inbox'una duser
- admin panelde danisman bazli ilan atama veya lead yonlendirme beklenmez

Bu model V1 icin daha sade ve daha dogru bir sinirdir.

### Onerilen Odeme Akisi

1. kullanici ilana girer
2. rezervasyon/basvuru formunu doldurur
   zorunlu ana kalemden ıstedıgı ana kalemlerı secer
3. ek hizmetleri secer
4. sistem reservation + order + order_items olusturur
5. kullanici Is Bankasi hosted payment sayfasina yonlenir
6. callback / donus alinir
7. payment basariliysa reservation uygun status'e cekilir
8. admin panelde islem gorunur
9. belge toplama ve sonraki operasyon backoffice'ten yurur

### Mimari Sinirlar

Ilk surumde yapilmamasi onerilenler:
- cok saticili payout sistemi
- escrow benzeri karma finans mantigi
- seller split
- tam otomatik dispute engine
- mikroservis mimarisi
- ayri custom backend zorunlulugu

### Mesajlasma / Chat Karari

Musteri Sahibinden benzeri mesajlasma istemektedir.

Bu ihtiyac icin ilk surumde onerilen cozum:
- Chatwoot

Chatwoot'un projedeki dogru rolu:
- emlak ofisi ile potansiyel kiraci arasinda mesajlasma
- satis / destek inbox'i
- ekip tarafinda tum konusmalari tek panelden yonetme
- gerekirse ileride WhatsApp gibi kanallari ayni inbox'a baglama

Onemli sinir:
- Chatwoot ana is verisinin sahibi olmamali
- ana veri yine bizim sistemde kalmali

Bizim sistemde kalacak veriler:
- users
- listings
- applications / reservations
- orders
- payments

Chatwoot'ta kalacak sey:
- conversation / inbox / agent cevap sureci

### Chat Icin Onerilen Uygulama Stratejisi

#### V1 en hizli yol

- siteye Chatwoot widget eklenir
- listing detail sayfasinda "Mesaj Gonder" butonu ile chat acilir
- emlak ofisi ekibi Chatwoot panelinden cevap verir

#### V1.5 daha duzgun yol

- sitede kendi mesaj giris arayuzu olur
- alttan Chatwoot API ile conversation acilir
- conversation'a listing ile ilgili alanlar eklenir

Eklenmesi onerilen baglamsal alanlar:
- listing_id
- listing_title
- move_in_date
- user_id

### Chat Tarafinda Dikkat Edilecekler

- her konusmanin hangi ilanla ilgili oldugu net olmali
- kullanici giris yaptiysa kimligi Chatwoot ile baglanmali
- ayni kullanicinin ayni ilan icin gereksiz fazla konusma acmasi engellenmeli
- admin tarafinda bir lead'in hangi listing'den geldigini gormek kolay olmali

### Chat Son Karari

Ilk surum icin:
- Chatwoot dogru secim
- destek / mesajlasma katmani olarak kullanilacak
- urunun ana is verisi bizim sistemde tutulacak
- zaman kazanmak icin once Chatwoot widget ile baslanabilir

### Mesajlasma Beklentisinin Netlesmis Hali

Musterinin mesajlasma tarafindaki asil beklentisi:
- kullanici bir ilan hakkinda mesaj baslatabilsin
- bu konusma kayitli kalsin
- daha sonra ayni konusma tekrar acilip devam edilebilsin
- gecmis mesajlar gorulebilsin

Yani beklenti sadece canli destek widget'i degildir.

Istenen sey:
- ilan bazli kalici konusma gecmisi

Beklenen urun davranisi:
- kullanici listing detay sayfasinda mesajlasma baslatir
- o listing icin mevcut bir conversation varsa ayni conversation acilir
- yoksa yeni conversation olusturulur
- daha sonra kullanici ayni mesaja geri donup devam edebilir

Bu nedenle chat tarafinda kritik kural:
- conversation ile listing iliskisi net tutulmali
- ayni kullanici ayni ilan icin gereksiz yere cok sayida farkli conversation acmamalidir

### Kisaca MVP Karari

Bu urun su sekilde tanimlanabilir:

"Uzun donem kiralama yapan emlak firmalari icin ilan, rezervasyon, online tahsilat ve ek hizmet satis platformu."

Ilk teknik yon:
- Supabase merkezli kurulum
- Next.js frontend
- Is Bankasi hosted payment
- 1 zorunlu ana kalem + secilebilir ek hizmetler
- odeme sonrasi belge toplama

### Blog / Icerik Modulu

Musteri blog/icerik sayfasi istemektedir.

Amac:
- gurbetci ve yabanci musterileri organik olarak cekmek
- SEO tarafini guclendirmek
- kiralama sureci, bolge rehberleri ve yasam icerikleri yayinlamak
- guven veren bir icerik altyapisi kurmak

Bu nedenle blog modulu ilk surume dahil edilebilir ama hafif tutulmalidir.

Onerilen yaklasim:
- tam gelismis CMS yazmamak
- basit ama yeterli bir icerik yonetim yapisi kurmak
- admin panelden blog yazisi eklenebilecek bir modulle ilerlemek

### Blog Icin Onerilen Temel Yapilar

Tablolar:
- blog_posts
- blog_categories

blog_posts icin temel alanlar:
- title
- slug
- excerpt
- content
- cover_image
- seo_title
- seo_description
- status
- published_at

blog_categories icin temel alanlar:
- name
- slug

### Blog Tarafinda Onerilen Icerik Tipleri

- sehir / bolge rehberleri
- gurbetciler icin kiralama sureci
- gerekli belgeler
- tasinma ve yerlesme rehberleri
- yasam maliyetleri
- uzun donem kiralama ipuclari

### Blog Son Karari

Blog ilk surume dahil olabilir.

Ama kapsam kontrollu tutulmalidir:
- hafif icerik yonetimi
- temel SEO alanlari
- kategori bazli listeleme
- detay sayfasi

Ilk surumde yapilmamasi onerilenler:
- cok gelismis editor
- karmasik draft/review workflow
- cok rollu editorial sistem
