# Faz 9A: Custom Content Admin

## Özet

Payload CMS içerik motoru olarak kalacak; içerik yönetimi yüzü custom `/admin`
shell içine taşınacak. İlk teslimat üç modülü birlikte kapsar: `Posts`,
`Categories`, `Consultants`. Uygulama küçük, bağımsız ve TDD uyumlu task'lara
bölünür; her task kendi dar testleriyle kapanır.

Karar kilitleri:
- Navigasyon: `/admin` içinde yeni `Icerik` bölümü olacak.
- Kapsam: `Posts + Categories + Consultants` birlikte çıkacak.
- Veri sınırı: UI doğrudan Payload REST'e gitmeyecek; `Next route proxy ->
  Payload Local API` modeli kullanılacak.
- Admin UX sınırı: custom content admin yazılımcı olmayan ofis kullanıcısı
  içindir. Teknik alanlar zorunlu manuel iş olarak öne çıkarılmaz.
  `slug` kullanıcıya ham teknik jargon olarak sunulmaz; `URL adı` olarak
  başlık/ad bilgisinden otomatik üretilir ve yalnızca gerekirse
  düzenlenebilir.
- Supabase-first medya kararı: içerik görseli veya danışman fotoğrafı
  gerektiğinde kalıcı UX manuel harici URL yapıştırma değildir. Önce
  Supabase Storage upload akışı tercih edilir; Next route/controller yalnızca
  auth, validation ve upload boundary olarak kalır.

## Task 1: Contract ve Faz Kapısı

- `docs/IMPLEMENTATION_PLAN.md` içine yeni faz ekle:
  - `/admin/content/*` custom content admin
  - `/cms` Payload fallback admin
  - Payload backend olarak kalır, UI birincil yüz olmaz
- README admin ayrımını güncelle:
  - `/admin` = custom admin
  - `/cms` = Payload admin
- `docs/superpowers/plans/...` altında bu faz için plan dosyası oluştur.
- Bu task kod üretmez; sadece kararları repo içine sabitler.

Doğrulama:
- metin/grep doğrulaması
- gerekiyorsa mevcut docs testleri etkilenmiyorsa ek test gerekmez

## Task 2: Sidebar ve Route İskeleti

- Mevcut admin shell navigation contract'ını genişlet:
  - `Icerik` bölümü
  - alt hedefler: `Posts`, `Categories`, `Consultants`
  - `CMS` fallback linki korunur
- Header title resolver'ı yeni route'ları tanısın:
  - `/admin/content/posts`
  - `/admin/content/categories`
  - `/admin/content/consultants`
- Yeni boş page skeleton'ları ekle:
  - `app/(site)/admin/content/posts/page.tsx`
  - `app/(site)/admin/content/categories/page.tsx`
  - `app/(site)/admin/content/consultants/page.tsx`
- Bu task sadece shell entegrasyonu ve erişilebilir route iskeleti sağlar.

Doğrulama:
- nav/title helper testleri
- `/admin/content/*` route render smoke
- mevcut shell test regresyonu

## Task 3: Content Admin Access Boundary

- Custom content admin için route-level access helper ekle:
  - Supabase session zorunlu
  - `profiles.role = admin` zorunlu
- Listings/operations access pattern'ine paralel helper yaz:
  - `content-admin-access` veya aynı ailenin benzeri
- UI page-level guard authoritative kalır.
- Payload users auth burada kullanılmaz.

Doğrulama:
- admin geçer
- anon redirect/unauthorized
- non-admin deny
- mevcut operations/listings access testleri bozulmaz

## Task 4: Posts API Contract

- Yeni route contract'larını ekle:
  - `GET /api/admin/content/posts`
  - `POST /api/admin/content/posts`
  - `GET /api/admin/content/posts/[id]`
  - `PATCH /api/admin/content/posts/[id]`
  - `DELETE /api/admin/content/posts/[id]`
- Route handler, `Payload Local API` kullanır.
- Auth/origin/content-type/body parsing bizim route katmanında yapılır.
- DTO sadeleştirilir; UI doğrudan Payload raw shape tüketmez.
- `Posts` filtreleri:
  - `search`
  - `status`
  - `category`
  - pagination

Doğrulama:
- red-green route tests
- 403/400/404
- create/update/delete success
- query parsing
- content-type/origin guard

## Task 5: Categories API Contract

- Route'lar:
  - `GET /api/admin/content/categories`
  - `POST /api/admin/content/categories`
  - `GET /api/admin/content/categories/[id]`
  - `PATCH /api/admin/content/categories/[id]`
  - `DELETE /api/admin/content/categories/[id]`
  - `GET /api/admin/content/categories/options`
- `options` endpoint, posts form select'i için optimize edilmiş sade liste
  döndürür.
- Active/inactive ayrımı DTO'da görünür olur.

Doğrulama:
- route contract tests
- options endpoint tests
- guard tests
- invalid id / not found / duplicate slug mapping

## Task 6: Consultants API Contract

- Route'lar:
  - `GET /api/admin/content/consultants`
  - `POST /api/admin/content/consultants`
  - `GET /api/admin/content/consultants/[id]`
  - `PATCH /api/admin/content/consultants/[id]`
  - `DELETE /api/admin/content/consultants/[id]`
- Liste ve detail DTO'su custom admin kullanımı için sadeleştirilir.

Doğrulama:
- route contract tests
- create/update/delete success
- guard coverage
- invalid payload / missing doc coverage

## Task 7: Content Client + View Model Katmanı

- `lib/admin-ui/content-*` helper ailesi ekle:
  - posts client/controller/view-model
  - categories client/controller/view-model
  - consultants client/controller/view-model
- Turkce display mapping sabitlenir:
  - `draft -> Taslak`
  - `published -> Yayinda`
  - boolean label'lar modül bazlı netleşir
- Empty state, filter state, badge copy, table row display burada normalize
  edilir.

Doğrulama:
- pure view-model tests
- client payload shaping tests
- controller mapping tests

## Task 8: Posts UI

- `/admin/content/posts` ekranını gerçek ürün yüzeyine dönüştür:
  - header
  - filter bar
  - list/table
  - create button
  - edit/detail page veya edit form surface
- Form alanları:
  - `title`
  - `slug` teknik değeri UI'da `URL adı` olarak gösterilir; başlıktan
    otomatik üretilir ve admin elle düzenlemedikçe başlık değiştikçe güncellenir
  - `excerpt`
  - `content`
  - `category`
  - `status`
  - `publishedAt`
  - kapak görseli upload akışı; kalıcı UX Supabase Storage'a dosya yükleme
    olmalıdır. Mevcut Payload post contract'ı için URL/path tutulabilir, ancak
    admin harici URL yapıştırmaya zorlanmaz
  - `seoTitle`
  - `seoDescription`
- `content` v1'de textarea kalır; rich text yok.
- Auto-slug zorunludur: Türkçe karakterleri normalize eder. Admin `URL adı`
  alanını elle değiştirirse sonraki başlık değişiklikleri manuel değeri ezmez.
- Kapak görseli için manuel `coverImageUrl` nihai kullanıcı akışı değildir;
  Supabase Storage upload task'ı bu fazın admin-dostu içerik UX kapsamına
  alınır. Medya upload henüz uygulanmadıysa bu eksik açık takip maddesi olarak
  kalır, final kabul kriteri gibi raporlanmaz.

Doğrulama:
- view-model/client tests + UI contract tests
- browser smoke:
  - liste açılıyor
  - boş state okunabilir
  - create form açılıyor
  - edit form açılıyor

## Task 9: Categories UI

- `/admin/content/categories` ekranı:
  - liste
  - create/edit form
  - active badge
  - sort order görünümü
- Form alanları:
  - `title`
  - `slug` teknik değeri UI'da `URL adı` olarak gösterilir; başlıktan otomatik
    üretilir ve yalnızca gerekirse düzenlenir
  - `description`
  - `isActive`
  - `sortOrder`

Doğrulama:
- UI contract tests
- create/edit empty state
- browser smoke

## Task 10: Consultants UI

- `/admin/content/consultants` ekranı:
  - liste
  - create/edit form
  - publish state
  - iletişim bilgileri
- Form alanları:
  - `fullName`
  - `slug` teknik değeri UI'da `URL adı` olarak gösterilir; addan otomatik
    üretilir ve yalnızca gerekirse düzenlenir
  - `title`
  - danışman fotoğrafı upload akışı; kalıcı UX Supabase Storage'a dosya
    yükleme olmalıdır. Mevcut contract için URL/path tutulabilir, ancak admin
    harici URL yapıştırmaya zorlanmaz
  - `shortBio`
  - `phone`
  - `email`
  - `whatsappUrl`
  - `linkedinUrl`
  - `isPublished`
  - `sortOrder`

Doğrulama:
- UI contract tests
- browser smoke
- empty/list/edit states

## Task 11: Shared Delete / Form UX Polish

- Üç modülde ortak davranışları hizala:
  - delete confirmation dialog
  - save success/error banner
  - loading/disabled states
  - unsaved form feedback gerekiyorsa basit koruma
- Üç modülde teknik olmayan admin UX'ini hizala:
  - `slug` yerine `URL adı` copy'si
  - otomatik URL adı üretimi
  - admin URL adını elle düzenlediyse otomatik üretimin bu değeri ezmemesi
  - görsel/fotoğraf alanlarında manuel harici URL yapıştırma yerine
    Supabase Storage upload hedefinin korunması
- Copy ve empty state'ler yeni admin diliyle tutarlı olsun.

Doğrulama:
- shared UI behavior tests
- manual smoke for destructive flow confirmation
- lint/typecheck

## Task 12: Full Browser Smoke ve Faz Kapanışı

- Gerçek browser smoke yap:
  - `/admin/content/posts`
  - `/admin/content/categories`
  - `/admin/content/consultants`
  - `/cms` fallback link
- Screenshot al
- `npm run typecheck`
- ilgili dar test setleri
- gerekirse `npm run lint`
- docs closure notu ekle:
  - Payload UI fallback kaldı
  - custom content admin birincil yüz oldu
  - `slug` teknik alanı admin'e zorunlu manuel iş olarak sunulmuyor
  - içerik görsel/fotoğraf işleri için Supabase Storage upload akışı
    hedefleniyor; manuel URL girişi final UX kabul edilmiyor

## Varsayılan Task Sırası

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 6
7. Task 7
8. Task 8
9. Task 9
10. Task 10
11. Task 11
12. Task 12

## Varsayımlar

- İlk versiyonda rich text editor ve SEO preview yok.
- Medya/fotoğraf için manuel URL yapıştırma final UX değildir; Supabase
  Storage upload akışı admin-dostu hedef olarak plana dahildir.
- `slug` manuel teknik alan değildir; `URL adı` otomatik üretilir ve yalnızca
  gerekirse düzenlenir.
- Custom content admin Payload REST yerine `Next route proxy -> Payload Local API`
  kullanır.
- `/cms` kaldırılmaz.
- Üç modül birlikte çıkar; "sadece posts" yaklaşımı seçilmez.

## Kapanış Notu (2026-05-02)

Faz 9A birincil teslimatı tamamlandı. Üç içerik modülü custom admin yüzüyle
yayında:

- **`/admin/content/posts`**: tam ürün yüzeyi. Filtre, liste, create/edit
  formları, `URL adı` otomatik üretimi, `slug` manuel donma davranışı, SEO
  helper copy'si, Supabase Storage tabanlı kapak görseli upload (`content-media`
  bucket), 16:9 preview ve yüklendi status göstergesi dahil.
- **`/admin/content/categories`**: liste + create/edit, aktif/pasif badge,
  sıra numarası, `URL adı` başlıktan otomatik üretim, manuel düzenleme
  donma davranışı, delete confirmation.
- **`/admin/content/consultants`**: liste + create/edit, Yayında/Taslak
  badge, iletişim alanları (telefon, e-posta, WhatsApp, LinkedIn),
  `URL adı` addan otomatik üretim. **Fotoğraf upload ertelendi**: mevcut
  yüzey geçici bir text input; helper metni yüklemenin planlı UX olduğunu
  net belirtiyor, manuel URL **final UX olarak sunulmuyor**.
- **`/cms`**: Payload fallback canlı. Birincil yüz artık custom admin.

Doğrulama:

- `npm test` → 259 test pass, 0 fail, 0 lint error
- `npm run typecheck` → temiz
- Otomatik browser smoke erişim korumasından (admin login zorunlu)
  içeri giremedi; gerçek admin oturumuyla manuel smoke gerekli.

Açık takip maddeleri (product backlog):

- Consultants fotoğraf upload → Supabase Storage pattern'i posts cover
  image helper'larından yeniden kullanılarak açılacak.
- Eski cover image ve fotoğraf dosyalarının Storage'dan güvenli temizliği
  (yeni upload yapıldığında veya içerik silindiğinde).
- Rich text editor (Posts `content`) — v2.
- SEO preview kartı — v2.
- `/admin/content/*` için gerçek admin-oturumlu görsel smoke test (mümkünse
  Playwright ile otomatik) — bir sonraki faz/release kapısında.
