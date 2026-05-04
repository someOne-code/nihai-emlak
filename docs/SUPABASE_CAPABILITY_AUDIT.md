# Supabase Capability Audit

## Amaç

Bu doküman, backend'in ana ihtiyaçlarını **Supabase native**, **ince custom** ve **dış sistem** olarak sınıflandırır.  
Hedef, Supabase-first yaklaşımını pratik karara dönüştürmek ve gereksiz custom code yazılmasını engellemektir.

Bu audit, [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) icindeki Faz 0.5'in ciktisidir ve [PHASE_1_2_TASKS.md](./PHASE_1_2_TASKS.md) icindeki Gorev 0 icin temel karar matrisi olarak kullanilacaktir.

## Karar Özeti

| İhtiyaç | Seçilen Katman | Sınıf |
| --- | --- | --- |
| Kullanıcı kimliği, oturum, JWT | Supabase Auth + `@supabase/ssr` | Supabase native |
| Veri sahipliği ve satır bazlı yetki | PostgreSQL RLS | Supabase native |
| Auth kullanıcısına bağlı uygulama profili | `auth.users` + `public.profiles` + trigger | Supabase native + ince custom |
| Public ve admin okuma yüzeyleri | table/view/RPC + RLS | Supabase native |
| Veri yoğun durum geçişleri | DB function / RPC | Supabase native |
| Harici ödeme callback alma ve imza doğrulama | Next route handler | İnce custom |
| Ödeme sonrası atomik state transition | DB function / RPC | Supabase native |
| Uzun süren arka plan işler | Inngest, gerekirse Edge Function background task | Dış sistem + ince custom |
| İçerik yönetimi | Payload CMS | Dış sistem |
| Mesajlaşma kimlik doğrulama | Chatwoot + server-side HMAC | Dış sistem + ince custom |
| Checkout intake / pre-payment contact bilgisi | DB table + checkout RPC + RLS | Supabase native + ince custom |
| Görsel/dosya asset yönetimi (blog kapak, danışman fotoğrafı vb.) | Supabase Storage + storage policies | Supabase native |

## Detaylı Karar Matrisi

### 1. Auth ve Session Yönetimi

- **Karar:** Supabase Auth kullanılacak.
- **Sınıf:** Supabase native
- **Uygulama:** `@supabase/ssr`, access token, refresh flow, `auth.users`
- **Neden:** Kimlik doğrulama, session, JWT ve kullanıcı yaşam döngüsü zaten Supabase tarafından çözülüyor.
- **Ne yapmayacağız:** Kendi auth sistemi, kendi JWT üretimi, kendi session tabanı yazılmayacak.

### 2. Ağ Sınırı ve Oturum Tazeleme

- **Karar:** `proxy.ts` yalnızca session refresh ve yüksek seviye route gate için kullanılacak.
- **Sınıf:** İnce custom
- **Uygulama:** Mevcut `lib/supabase/proxy.ts` korunur.
- **Neden:** SSR tarafında cookie bazlı session yenileme ve kaba erişim yönlendirmesi burada doğal.
- **Ne yapmayacağız:** Gerçek authorization mantığı `proxy.ts` içine taşınmayacak.

### 3. Authorization ve Veri Sahipliği

- **Karar:** Yetkilendirme RLS ile çözülecek.
- **Sınıf:** Supabase native
- **Uygulama:** `auth.uid()`, role tabanlı policy, own-data policy, admin policy
- **Neden:** Supabase veri güvenliğinin doğal merkezi veritabanıdır.
- **Ne yapmayacağız:** Uygulama kodunda `if user.id === row.user_id` tarzı merkezi olmayan güvenlik modeli kurulmayacak.

### 4. Profiles Modeli

- **Karar:** `auth.users` tablosu genişletilmeyecek; `public.profiles` tablosu ile birebir ilişki kurulacak.
- **Sınıf:** Supabase native + ince custom
- **Uygulama:** `profiles.id -> auth.users.id`, signup sonrası trigger/function
- **Neden:** Supabase kullanıcıyı auth şemasında tutar; domain verisi public şemada tutulmalıdır.
- **Ne yapmayacağız:** Güvenlik kritik yetkileri `user_metadata` içinde tutmayacağız.

### 5. Public Read ve Admin Read Modelleri

- **Karar:** Önce table/view/RPC + RLS; gerekirse ince route handler.
- **Sınıf:** Supabase native
- **Uygulama:** `listings` public read, admin/backoffice için view veya RPC
- **Neden:** Okuma tarafında PostgREST ve RPC yeterli ise ek API katmanı yazmak gereksizdir.
- **Ne yapmayacağız:** Her listeleme ve detay için otomatik olarak ayrı Next API route yazmayacağız.
- **Yetki sınırı:** Admin/backoffice okuma yüzeyi doğrudan table/view/RPC olabilir; ancak transaction-kritik state değişiklikleri (`reservations/orders/payments/listings`) direct tablo `UPDATE` grant’i ile değil explicit workflow/RPC ile yapılmalıdır.

### 6. Checkout ve Fiyat Hesabı

- **Karar:** Fiyat backend tarafında hesaplanacak; veri yoğun kısım DB function ile çözülecek.
- **Sınıf:** Supabase native + ince custom
- **Uygulama:** `orders`, `order_items`, `payments` ve listing/service verisine bakan DB function
- **Neden:** Transaction kritik ve veri yoğun mantık veritabanına yakın çözülmeli.
- **Ne yapmayacağız:** Frontend toplam fiyat göndermeyecek; fiyatı client belirlemeyecek.

### 6.5. Checkout Intake / Pre-payment Contact Bilgisi

- **Karar:** Odeme oncesi operasyonel iletisim bilgisi checkout create sinirinda alinacak ve reservation ile iliskili DB tablosunda tutulacak.
- **Sinif:** Supabase native + ince custom
- **Uygulama:** `reservation_intake` benzeri tablo, RLS, checkout create RPC ve admin read/snapshot yuzeyleri.
- **Neden:** Ofis belge surecini gercek hayatta yurutuyor; musteriye ulasma bilgisi operational backend kaydi olarak transaction sinirina yakin tutulmali.
- **Ne yapmayacagiz:** Checkout sirasinda TC kimlik, pasaport, belge upload, banka/kart bilgisi veya mevcut acik adres toplamayacagiz.

### 7. Ödeme Callback Alma ve İmza Doğrulama

- **Karar:** Harici banka callback'i Next route handler üzerinde alınacak; imza doğrulaması burada yapılacak.
- **Sınıf:** İnce custom
- **Uygulama:** `app/api/payment/callback/route.ts`
- **Neden:** Callback alma, header/form-data/json ayrıştırma ve kriptografik imza kontrolü DB tarafının değil uygulama sınırının işidir.
- **Ne yapmayacağız:** Banka callback'ini doğrudan tablo insert/update ile bağlamayacağız.

### 8. Atomik Ödeme Tamamlama

- **Karar:** Callback doğrulandıktan sonra tek DB function çağrılacak.
- **Sınıf:** Supabase native
- **Uygulama:** `payments`, `payment_events`, `orders`, `reservations`, `listings` güncellemesi tek function içinde
- **Neden:** State transition veri yoğun ve transaction kritik.
- **Ne yapmayacağız:** Callback handler içinde birden fazla bağımsız update zinciri çalıştırmayacağız.
- **Admin/backoffice uzantısı:** Ödeme sonrası manuel tamamlama, iptal veya yeniden açma gibi operasyonlar gerekirse aynı veri bütünlüğü kurallarını koruyan ayrı DB workflow/RPC ile modellenmelidir; direct tablo `UPDATE` aynı authoritative sınırın alternatifi değildir.

### 9. Edge Function Kullanım Sınırı

- **Karar:** Edge Function zorunlu ana backend taşıyıcısı olmayacak; yalnızca ihtiyaç varsa webhook/public endpoint veya background task için kullanılacak.
- **Sınıf:** İnce custom
- **Neden:** Supabase resmi yönlendirmesi, data-intensive işler için DB functions; düşük gecikme veya webhook/public HTTP için Edge Functions kullanılmasıdır.
- **Ne yapmayacağız:** Sırf Supabase içinde olduğu için her backend işini Edge Function'a taşımayacağız.

### 10. Uzun Süren Arka Plan İşleri

- **Karar:** İlk tercih mevcut Inngest akışı; gerekirse Supabase Edge Function background task destekleyici rol oynar.
- **Sınıf:** Dış sistem + ince custom
- **Uygulama:** callback sonrası e-posta, CRM, bildirim, analitik
- **Neden:** Atomik DB function içinde uzun iş çalıştırmak yanlış; bu işler asenkron ayrıştırılmalı.
- **Ne yapmayacağız:** Uzun işler ödeme transaction içine alınmayacak.

### 11. Content Backend

- **Karar:** İçerik yönetimi Payload üzerinde kalacak.
- **Sınıf:** Dış sistem
- **Uygulama:** blog, danışman vitrini, statik sayfalar, SEO içerikleri
- **Neden:** Repo kararı bu yönde; içerik editörlü panel ihtiyacı gerçek.
- **Ne yapmayacağız:** İçerik modüllerini Supabase operasyon tablolarıyla karıştırmayacağız.

### 12. Chat ve Identity Validation

- **Karar:** Mesajlaşma için Chatwoot, kimlik doğrulama için server-side HMAC.
- **Sınıf:** Dış sistem + ince custom
- **Uygulama:** kullanıcı ID'sinden HMAC üretip frontend'e güvenli şekilde verme
- **Neden:** Chatwoot konuşma sahipliği ve impersonation riski bu şekilde çözülür.
- **Ne yapmayacağız:** HMAC token frontend'de üretmeyeceğiz.

### 13. Görsel / Dosya Asset Yönetimi

- **Karar:** Admin'in URL yapıştırması yerine custom admin UI'dan görsel seçip Supabase Storage'a yüklemesi hedefleniyor.
- **Sınıf:** Supabase native
- **Uygulama:** Supabase Storage bucket, Storage RLS/policies, admin upload component, post `coverImageUrl` / `coverImagePath` alanı.
- **Mevcut durum:** Phase 9A'da `coverImageUrl` text input placeholder olarak mevcut. Gerçek upload UX sonraki fazda uygulanacak.
- **Neden:** Görsel depolama Supabase Storage'ın doğal uzmanlık alanıdır; erişim politikası uygulama katmanı yerine Storage RLS ile yönetilmelidir.
- **Ne yapmayacağız:** Admin'den harici URL yapıştırmasını final UX olarak kabul etmeyeceğiz. Payload CMS içerik motoru olarak kalır ancak görsel asset storage Supabase'e taşınır.
- **Kapsam:** Posts, categories, consultants — görsel ihtiyacı olan tüm content type'lar.

## Negatif Kararlar

### `db_pre_request`

- **Karar:** Genel authorization mekanizması olarak seçilmeyecek.
- **Neden:** Supabase dokümanına göre `pgrst.db_pre_request` yalnızca Data API (PostgREST) yüzeyi için geçerlidir; Storage, Realtime ve diğer ürünler için genel çözüm değildir.

### `service_role`

- **Karar:** Varsayılan uygulama erişim modeli olmayacak.
- **Neden:** `service_role` RLS bypass eder; yalnızca gerçekten yönetimsel ve kontrollü sunucu işlemlerinde kullanılmalıdır.

### Tamamen uygulama kodu merkezli authorization

- **Karar:** Reddedildi.
- **Neden:** Supabase-first yaklaşımında veri güvenliği merkezi olarak veritabanında çözülmelidir.

### Her okuma için ayrı custom API route

- **Karar:** Varsayılan model olmayacak.
- **Neden:** view/RPC + RLS yeterliyse ekstra uygulama yüzeyi gereksiz bakım yükü yaratır.

## Faz 1-2 İçin Somut Etki

Bu audit sonucunda ilk task sırası şu şekilde sabitlenmiştir:

1. `Görev 0`: Capability audit tamamlandı
2. `Görev 1`: Initial setup migration
3. `Görev 2`: `profiles` + auth trigger + ilk RLS
4. `Görev 3`: public katalog ve listing tabloları
5. `Görev 4`: transactional tablolar
6. `Görev 5`: minimum admin RLS
7. `Görev 6`: checkout veri kontratı
8. `Görev 7`: atomik payment DB function
9. `Görev 8`: smoke test

## Bu Repo İçin Operasyonel Yorum

- `lib/supabase/proxy.ts` kalir, ama authorization merkezi olmaz.
- `app/api/payment/callback/route.ts` harici boundary olarak kalir.
- `lib/inngest/functions/payment-callback.ts` uzun arka plan isler icin dogal yerdir; transaction mantigi burada cozulmez.
- `payload.config.ts` content backend sinirinda kalir.

## Rol Ayrimi Notu

- Uygulama ve backoffice yetki source-of-truth'u `public.profiles.role` alanidir.
- `auth.users` kimlik ve oturum kaynagidir; uygulama rolu burada tasinmaz.
- Payload `users.role` alani varsa bu yalnizca CMS/admin access control yardimci alanidir.
- Reservation, order, payment ve event erisim kararlari Payload role'u ile degil, Supabase Auth + `profiles` + RLS ile verilir.

## Kaynaklar

- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase Edge Functions Development Tips](https://supabase.com/docs/guides/functions/development-tips)
- [Supabase Managing Environments](https://supabase.com/docs/guides/deployment/managing-environments)
- [Supabase Local Development with Schema Migrations](https://supabase.com/docs/guides/local-development/overview)
- [Supabase Users](https://supabase.com/docs/guides/auth/users)
