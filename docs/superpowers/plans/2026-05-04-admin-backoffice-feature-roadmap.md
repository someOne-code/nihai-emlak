# Admin Backoffice Feature Roadmap Plan

## Özet

Bu plan, mevcut backend/admin yüzeyine bakarak custom `/admin` panelde eksik kalan operasyonel özellikleri önceliklendirir. Amaç kodlamaya başlamadan önce hangi admin ekranlarının, hangi backend katmanına dayanarak ve hangi test kapılarıyla geliştirileceğini netleştirmektir.

Kapsam backend/infrastructure workspace ile sınırlıdır. Public frontend redesign bu planın parçası değildir. Custom admin panel ofis/operasyon kullanıcısına yönelik kalır; Payload `/cms` fallback olarak korunur.

## Mevcut Durum

Şu anda admin yüzeyinde var olan ana modüller:

- `/admin`: yönlendirme/kısayol dashboard iskeleti
- `/admin/listings`: ilan, görsel, checkout hazırlığı, ana ödeme kalemi ve ek hizmet bağlama yüzeyi
- `/admin/listing-catalog`: global ana ödeme kalemi ve ek hizmet katalog yönetimi
- `/admin/operations`: rezervasyon/sipariş/ödeme operasyon yüzeyi
- `/admin/content/posts`: blog yazıları
- `/admin/content/categories`: blog kategorileri
- `/admin/content/consultants`: danışman profilleri
- `/cms`: Payload fallback admin

Backend/API tarafında var olan önemli yüzeyler:

- `/api/admin/listings/*`
- `/api/admin/catalog/*`
- `/api/admin/read/*`
- `/api/admin/workflows/*`
- `/api/admin/content/*`
- `/api/communications/*`
- payment callback ve checkout route/RPC katmanları

## Katman Kararı

Bu plan Supabase-first kurallarına uyar:

1. Auth/session: Supabase Auth
2. Authorization/ownership: RLS ve DB-side logic
3. Data state/transactions: Postgres function/RPC
4. Admin read models: DB view/RPC + RLS; gerektiğinde ince Next route
5. File/image storage: Supabase Storage
6. Communication: Chatwoot dış sistem + server-side HMAC
7. Payment: İş Bankası dış sistem + thin callback boundary + DB RPC
8. Content backend: Payload CMS; custom admin UI Next route proxy üzerinden konuşur

Next.js route/controller sadece auth, validation, origin/body guard ve dış sistem orkestrasyonu için ince boundary olarak kalır.

## Öncelik Matrisi

| Öncelik | Modül | Neden |
| --- | --- | --- |
| P0 | Admin Dashboard Metrics | ✅ Tamamlandı (2026-05-04) |
| P0 | Listings Image Upload UX | ✅ Tamamlandı (2026-05-02) |
| P0 | Operations UI Standardization | ✅ Tamamlandı (2026-05-04) |
| P1 | Communication Admin | ✅ Tamamlandı (2026-05-05) |
| P1 | Sale Leads Admin | ✅ Tamamlandı (2026-05-05) |
| P1 | Document Tracking | ✅ Tamamlandı (2026-05-05) |
| P2 | Finance Ops | ✅ Tamamlandı (2026-05-05) |
| P2 | Audit Log Viewer | Kim ne yaptı sorusuna cevap |
| P2 | Content Polish | Blog/danışman modüllerini ürün kalitesine çekmek |
| P3 | System Health | Config/env/storage/payment/chatwoot readiness görünürlüğü |

## Faz A: Admin Dashboard Metrics

### Amaç

`/admin` dashboard sadece kısayol olmaktan çıkıp operasyon ekibine günlük öncelik gösteren özet ekran olsun.

### Kapsam

Dashboard kartları:

- Toplam ilan
- Aktif ilan
- Pasif ilan
- Görseli olmayan ilan
- Checkout hazır olmayan kiralık ilan
- Bekleyen rezervasyon
- Başarısız/conflict ödeme
- Manuel işlem bekleyen operasyon
- Yeni iletişim/lead sayısı, eğer backend read model hazırsa

### Backend Katmanı

- Önce Supabase view/RPC + RLS.
- UI doğrudan tablo detayı çekmez.
- Gerekirse `GET /api/admin/dashboard/summary` ince route boundary olur.

### TDD Kapısı

- Pure dashboard view-model testi
- Admin-only read guard testi
- Metrics RPC/view smoke testi
- Empty/fallback state testi

### Kabul Kriterleri

- Dashboard admin açılışında yapılacak işleri net gösterir.
- Metrik yoksa fake sayı gösterilmez; `Henüz veri yok` veya `Alınamadı` ayrımı yapılır.
- Kartlardan ilgili admin ekranlarına gidilir.

## Faz B: Listings Image Upload UX

### Amaç

`/admin/listings` görsel yönetimi manuel URL girişinden çıkarılıp Supabase Storage upload akışına bağlansın.

### Kapsam

- Bilgisayardan görsel seçme
- Supabase Storage upload
- Listing image kaydı oluşturma
- Preview grid
- Primary görsel badge
- Sıralama
- Silme
- Upload hata/success feedback
- Dosya tipi ve boyut validasyonu

### Backend Katmanı

- Supabase Storage bucket + storage policies
- `POST /api/admin/content/uploads/listing-image` veya listing-specific upload route
- Existing listing image route/RPC authoritative kalır

### TDD Kapısı

- Upload validator tests
- Upload route guard tests
- Listing image route regression tests
- UI helper/view-model tests

### Kabul Kriterleri

- Admin harici URL yapıştırmadan ilan görseli ekleyebilir.
- Upload sonrası görsel listede görünür.
- Primary/sıra/silme davranışları bozulmaz.
- Storage path/URL contract dokümante edilir.

## Faz C: Operations UI Standardization

### Amaç

`/admin/operations` eski `ops*` CSS tabanlı ekran olmaktan çıkıp shadcn/Tailwind standardındaki modern operasyon kuyruğuna dönüşsün.

### Kapsam

- Queue/table layout modernizasyonu
- Mobile-friendly layout
- Filtreler:
  - Bekleyen rezervasyon
  - Onaylanabilir
  - İptal edilebilir
  - Reopen mümkün
  - Payment issue/conflict
- Search:
  - reservation id
  - listing title/id
  - user/contact summary, eğer güvenli read modelde varsa
- Reservation snapshot summary
- Order/payment summary
- Event/timeline görünümü
- Action area:
  - Confirm
  - Cancel
  - Reopen listing
- Reason/note alanları daha net UX ile korunur

### Backend Katmanı

- Mevcut `/api/admin/read/*` ve `/api/admin/workflows/*` route/RPC contract korunur.
- Yeni filtre ihtiyacı varsa önce DB read model/RPC.
- Raw sensitive payload UI’ye taşınmaz.

### TDD Kapısı

- Existing operations client/controller/view-model tests
- Yeni filter/view-model tests
- Action disabled/enabled tests
- Raw sensitive data leak regression tests

### Kabul Kriterleri

- Admin hangi rezervasyona müdahale edeceğini hızlı anlar.
- Aksiyonlar eligibility’ye göre doğru enable/disable olur.
- Raw callback payload veya hassas veri render edilmez.
- UI diğer admin modülleriyle aynı görsel dile geçer.

## Faz D: Communication Admin

### Amaç

Chatwoot conversation backend’i admin panelde görünür ve takip edilebilir olsun.

### Kapsam

Yeni ekran: `/admin/communications` veya `/admin/messages`

Liste alanları:

- Kullanıcı özeti
- İlan özeti
- Conversation status
- Son mesaj zamanı
- Mapping durumu: provisioning/ready/failed
- Chatwoot’ta aç linki
- Failed mapping için teknik olmayan hata özeti

Aksiyonlar:

- Chatwoot’ta aç
- Failed mapping retry, eğer backend contract güvenli şekilde hazırsa
- Listing/user bağlamını görüntüle

### Backend Katmanı

- Chatwoot dış sistem
- Supabase conversation mapping source-of-truth
- Admin read model view/RPC + RLS
- Retry gerekiyorsa explicit route/RPC; direct table update yok

### TDD Kapısı

- Admin read access tests
- Sanitization tests
- Failed/ready/provisioning mapping view-model tests
- Retry route tests, eğer uygulanırsa

### Kabul Kriterleri

- Operasyon ekibi hangi konuşmanın hangi ilan/kullanıcı ile ilişkili olduğunu görür.
- Chatwoot provider raw/secret data sızmaz.
- Failed durumlar takip edilebilir olur.

## Faz E: Sale Leads Admin

Durum: Tamamlandi (2026-05-05).

Kapanis ozeti:

- `/admin/sale-leads` ekrani eklendi.
- `sale_leads` + `sale_lead_events` Supabase modeli eklendi.
- Public create route sadece satilik ilanlar icin lead olusturuyor.
- Admin status transition RPC audit/event yaziyor.
- Danisman atamasi eklenmedi; roadmap siniri korundu.
- Satilik checkout reddi regresyonu korunuyor.

### Amaç

Satılık ilanlar için checkout yerine lead/başvuru operasyon akışı oluşturulsun.

### Kapsam

Yeni ekran: `/admin/sale-leads` veya `/admin/leads`

Lead alanları:

- İlan
- Kullanıcı/contact bilgisi
- Mesaj/not
- Lead status
danısmanlar sıtede vıtrın olarak duracak atama yok
- Son güncelleme

Status önerileri:

- Yeni
- Arandı
- Görüşme planlandı
- İlgilenmiyor
- Kapandı

### Backend Katmanı

- Supabase table + RLS
- State transition gerekiyorsa RPC
- Chatwoot conversation ile ilişkilendirilebilir
- Satılık checkout create/quote reddi korunur

### TDD Kapısı

- Sale listing checkout rejected regression
- Lead create/read ownership tests
- Admin-only status update tests
- UI view-model tests

### Kabul Kriterleri

- Satılık ilan talepleri admin tarafından listelenir ve takip edilir.
- Lead status değişimleri audit/event bırakır veya dokümante edilmiş workflow’dan geçer.
- Admin dışı kullanıcı başka kullanıcının lead kaydını okuyamaz.

## Faz F: Document Tracking

Durum: ✅ Tamamlandı (2026-05-05). Supabase `reservation_document_tracking` tablosu, explicit admin workflow RPC'leri, audit event yazımı, thin Next route ve `/admin/operations` içinde `Belge Takibi` kartı eklendi. Hassas belge upload bu faza alınmadı.

### Amaç

Ödeme sonrası belge/kontrat takip süreci admin panelde durum olarak yönetilsin. Hassas belge upload bu fazın parçası değildir.

### Kapsam

Operations içinde sekme veya ayrı ekran:

- Belge istendi
- Bekleniyor
- Tamamlandı
- Eksik/başarısız
- Admin notu
- Son güncelleyen admin
- Son güncelleme zamanı
- Reservation/order bağlantısı

### Backend Katmanı

- Supabase table/state fields
- Explicit workflow RPC:
  - `admin_request_documents`
  - `admin_mark_documents_waiting`
  - `admin_mark_documents_completed`
  - `admin_mark_documents_failed`
- Audit/event write zorunlu

### TDD Kapısı

- Admin-only workflow tests
- Invalid transition tests
- Terminal reservation için deny tests
- Event yazılmadan state değişmez testi

### Kabul Kriterleri

- Admin belge sürecini dosya upload olmadan takip eder.
- Her state change kim/neden/zaman bilgisiyle izlenir.

## Faz G: Finance Ops: Refund, Deposit, Conflict

Durum: ✅ Tamamlandı (2026-05-05). Supabase `payment_finance_ops` karar tablosu, explicit admin finance workflow RPC'leri, `admin_workflow_events` + `payment_events` audit yazımı, thin Next route ve `/admin/operations` içinde `Finans Operasyon` kartı eklendi. Otomatik provider refund/para hareketi bu faza alınmadı.

### Amaç

Başarısız ödeme, conflict callback, iade ve kapora kararları admin panelde görünür hale gelsin.

### Kapsam

Operations içinde finans sekmesi veya ayrı `/admin/finance-ops` ekranı:

- Refund required
- Refund requested
- Refund completed
- Deposit forfeited
- Manual resolution required
- Conflict payment
- Amount drift / ownership drift / missing payment gibi fail-closed durumları

### Backend Katmanı

- Product/hukuk kararı netleşmeden otomatik refund yok
- Supabase state/event model
- Explicit admin workflow RPC
- İş Bankası provider orchestration gerekiyorsa thin route boundary

### TDD Kapısı

- Admin-only workflow tests
- Event/audit required tests
- Amount drift fail-closed tests
- Missing payment fail-closed tests
- Manual resolution state tests

### Kabul Kriterleri

- Operasyon ekibi para ile ilgili sorunlu kayıtları görebilir.
- Otomatik finansal işlem product/legal karar olmadan tetiklenmez.
- Her karar audit trail üretir.

## Faz H: Audit Log Viewer

### Amaç

Admin panelde kritik state değişiklikleri için “kim ne yaptı?” görünürlüğü sağlansın.

### Kapsam

Yeni ekran: `/admin/audit`

Filtreler:

- Entity type: listing, reservation, order, payment, catalog, content
- Entity id
- Admin/user id
- Action type
- Tarih aralığı

Görünen alanlar:

- Zaman
- Aktör
- Aksiyon
- Entity
- Özet
- Güvenli metadata

### Backend Katmanı

- Var olan event/audit tabloları varsa read model
- Yoksa yeni audit/event contract önce DB migration ile netleşir
- Sensitive raw payload render edilmez

### TDD Kapısı

- Admin-only read tests
- Sensitive payload leak tests
- Filter parsing/view-model tests

### Kabul Kriterleri

- Kritik aksiyonların geçmişi admin tarafından okunabilir.
- Raw provider payload, token, secret, exact sensitive data UI’ye çıkmaz.

## Faz I: Content Polish

### Amaç

Blog/danışman içerik ekranları admin-dostu ve yayın öncesi kontrol edilebilir hale gelsin.

### Kapsam

Blog yazıları:

- SEO preview kartı
- Public preview link
- Rich text editor v2 değerlendirmesi
- Taslak/yayında filtre polish
- Eski cover image cleanup backlog’u

Blog kategorileri:

- Kategoriye bağlı yazı sayısı
- Silme öncesi kullanım uyarısı
- Aktif/pasif etkisi açıklaması

Danışmanlar:

- Danışmana bağlı ilan/lead/conversation sayısı
- Fotoğraf upload cleanup
- Danışman public preview link

### Backend Katmanı

- Payload content backend kalır
- Custom admin Next route proxy kullanır
- Media Supabase Storage kalır

### TDD Kapısı

- UI helper tests
- Route DTO tests
- Delete usage warning tests, eğer backend desteklenirse

### Kabul Kriterleri

- İçerik editörü yayına almadan önce içeriğin nasıl görüneceğini anlayabilir.
- Teknik alanlar admin’e zorunlu manuel iş olarak sunulmaz.

## Faz J: System Health

### Amaç

Production readiness için admin/devops seviyesinde sade sistem sağlık ekranı oluşturulsun.

### Kapsam

Yeni ekran: `/admin/system`

Local readiness notes:

- Chatwoot smoke command: `npm run test:chatwoot-live`
- Required smoke env: `CHATWOOT_BASE_URL`, `CHATWOOT_INBOX_IDENTIFIER`,
  `CHATWOOT_HMAC_TOKEN`
- Admin Chatwoot open-link env: `CHATWOOT_ACCOUNT_ID`
- Chatwoot webhook sync remains out of scope until a signed webhook
  ingestion contract is planned.

Kontroller:

- Supabase bağlantısı
- Payload local API hazır mı
- Storage bucket/policy hazır mı
- Chatwoot config hazır mı
- İş Bankası config hazır mı
- Required env vars eksik mi
- Son payment callback zamanı
- Son failed event/job özeti

### Backend Katmanı

- Read-only route
- Production’da required config eksikse fail-closed davranış dokümante edilir
- Secrets değerleri asla render edilmez, sadece hazır/eksik durumu gösterilir

### TDD Kapısı

- Secret redaction tests
- Missing config tests
- Production fail-closed tests

### Kabul Kriterleri

- Admin/devops panelden sistemin kritik entegrasyonlarının hazır olup olmadığını anlayabilir.
- Secret veya raw credential UI’ye çıkmaz.

## Önerilen Uygulama Sırası

1. ✅ Faz A: Admin Dashboard Metrics
2. ✅ Faz B: Listings Image Upload UX
3. ✅ Faz C: Operations UI Standardization
4. ✅ Faz D: Communication Admin
5. ✅ Faz E: Sale Leads Admin
6. ✅ Faz F: Document Tracking
7. ✅ Faz G: Finance Ops
8. ⬜ Faz H: Audit Log Viewer ← **sıradaki**
9. ⬜ Faz I: Content Polish
10. ⬜ Faz J: System Health

## İlk Sprint Önerisi (tamamlandı)

✅ Dashboard Metrics read model + `/admin` UI kartları
✅ Listings Image Upload UX
✅ Operations UI Standardization

İkinci sprint: Communication Admin + Sale Leads Admin.

## Validation Stratejisi

Her faz için standart döngü:

1. Supabase-first layer decision
2. En küçük davranış testi
3. Minimal implementation
4. Narrow tests
5. `npm run typecheck`
6. Gerekirse `npm test`
7. Browser smoke

Başlangıçta dar doğrulamalar:

- Admin dashboard: `tests/admin-dashboard-view-model.test.mts` ve yeni dashboard route/helper testleri
- Listings upload: upload validator + listings image route tests
- Operations: existing operations client/controller/view-model tests

## Kapsam Dışı

Bu roadmap şunları kapsamaz:

- Public frontend redesign
- Payload admin `/cms` kaldırma
- Otomatik refund entegrasyonu için product/legal karar olmadan finansal state machine
- Hassas belge upload
- Client-side service_role kullanımı
- RLS yerine uygulama katmanı authorization

## Açık Kararlar

Kodlamaya geçmeden önce netleşmesi gerekenler:

1. Dashboard metrikleri için DB view/RPC mi, ince Next route mu kullanılacak?
2. Listing image upload mevcut `/api/admin/content/uploads/listing-image` route’una mı bağlanacak, yoksa listing-specific upload boundary mi açılacak?
3. Communication Admin ayrı menü mü olacak, Operations altında sekme mi?
4. Sale Leads için bağımsız tablo mu, Chatwoot conversation mapping üstünden read model mi?
5. Belge takip state’i reservation tablosunda mı ayrı document_tracking tablosunda mı tutulacak?
6. Finance Ops için product/legal karar metni ne olacak?
7. Audit log için mevcut event tabloları yeterli mi, yoksa yeni canonical audit contract mı yazılacak?
