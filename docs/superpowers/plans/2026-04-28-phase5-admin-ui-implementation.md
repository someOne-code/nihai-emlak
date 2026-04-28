# Faz 5 Payload Admin Operations UI Görev Planı

## Özet
Payload Admin’e `/admin/operations` custom view eklenecek. UI yalnızca mevcut admin read-model ve workflow proxy route’larını kullanacak; DB migration, RPC business logic veya public frontend değişmeyecek. Uygulama TDD sırasıyla ilerleyecek: client kontratı, pure view model, Payload config/import map, ardından client UI.

## Görevler

### Task 0: Preflight ve sınır kontrolü
- `AGENTS.md`, `package.json`, `SUPABASE_CAPABILITY_AUDIT.md` okunur.
- `git status --short` ile dirty tree not edilir.
- Bu işte stage edilecek dosyalar sadece admin operations UI/read-model entegrasyonu olur.
- Mevcut `tests/admin-operations-client.test.mts` şu an geçiyor, ama kontrat eksik; ilk RED bu teste eklenecek.

### Task 1: Operations client kontratını tamamla
- Dosyalar: `tests/admin-operations-client.test.mts`, `lib/admin-ui/operations-client.ts`.
- Önce testlere şunlar eklenir ve RED izlenir:
  - Her fetch çağrısı `credentials: "same-origin"` ve `cache: "no-store"` kullanır.
  - Başarısız HTTP status veya `success:false` envelope `AdminOperationsClientError` fırlatır.
  - Invalid JSON ve bozuk envelope generic `"Invalid admin operation response"` mesajı verir.
  - POST body’leri sadece planlanan action body’lerini gönderir.
- Sonra client minimal düzeltilir:
  - `requestAdminJson` init içine `cache: "no-store"` ekler.
  - `!response.ok` durumunda success envelope olsa bile typed error üretir.
  - Stack/raw server payload UI’ye taşınmaz.
- Dar doğrulama:
  - `node --experimental-strip-types --experimental-specifier-resolution=node --test tests/admin-operations-client.test.mts`

### Task 2: Pure operations view model ekle
- Dosyalar: `tests/admin-operations-view-model.test.mts`, `lib/admin-ui/operations-view-model.ts`.
- Önce testler yazılır ve RED izlenir:
  - `eligibility.can_cancel/can_confirm/can_reopen` false ise ilgili buton disabled.
  - `actionPending !== null` iken tüm workflow butonları disabled.
  - Listing id yoksa `reopen` action görünmez veya disabled değil, tamamen saklanır.
  - `payment_events.payload`, `payload`, `raw_callback_payload`, `exact_address` gibi raw/sensitive alanlar model output’una geçmez.
- View model tek sorumlulukla uygulanır:
  - Export: `buildOperationsViewModel(input)`.
  - Input: overview listeleri, seçili reservation id, reservation snapshot, listing snapshot, pending action.
  - Output: tablo satırları, seçili reservation/listing id, snapshot özetleri, action modelleri.
  - Eligibility hesaplanmaz; sadece snapshot boolean’ları okunur.
  - Label’lar Türkçe ve insan-okur olur.
- Dar doğrulama:
  - `node --experimental-strip-types --experimental-specifier-resolution=node --test tests/admin-operations-view-model.test.mts`

### Task 3: Payload admin config ve import map bağla
- Dosyalar: `tests/payload-admin-operations-config.test.mts`, `payload.config.ts`, `app/(payload)/admin/importMap.ts`.
- Önce config testi yazılır ve RED izlenir:
  - `admin.components.views.operations.path === "/operations"`.
  - View component path’i `./payload/admin/OperationsView.tsx`.
  - `afterNavLinks` içinde `./payload/admin/OperationsNavLink.tsx`.
  - Import map’te `./payload/admin/OperationsView.tsx#default` ve `./payload/admin/OperationsNavLink.tsx#default` entry’leri var.
- Config minimal bağlanır:
  - `admin.importMap.baseDir` korunur.
  - `admin.components.views.operations` ve `admin.components.afterNavLinks` eklenir.
  - Import map manuel güncellenir; unrelated codegen çalıştırılmaz.
- Dar doğrulama:
  - `node --experimental-strip-types --experimental-specifier-resolution=node --test tests/payload-admin-operations-config.test.mts`

### Task 4: Payload admin Operations UI componentlerini ekle
- Dosyalar: `payload/admin/OperationsView.tsx`, `payload/admin/OperationsNavLink.tsx`.
- `OperationsView.tsx` client component olur ve sadece `operations-client` + `operations-view-model` kullanır.
- İlk ekran tablo odaklı olur:
  - Pending reservation listesi.
  - İlişkili order/payment özeti.
  - Reservation snapshot, listing snapshot, latest event özeti.
  - Eligibility durumu ve `cancel`, `confirm`, `reopen` aksiyon butonları.
- Aksiyon davranışı:
  - `cancel` ve `reopen` reason zorunlu; boş reason submit edilmez.
  - `confirm` sadece optional note gönderir.
  - Başarılı aksiyon sonrası overview ve seçili snapshot’lar yeniden fetch edilir.
  - Hata mesajı typed client error’dan güvenli/generic biçimde gösterilir.
- `OperationsNavLink.tsx` `/admin/operations` linkini admin nav’a ekler.
- UI hiçbir yerde raw callback payload, `payment_events.payload`, exact address veya service-role-only veri render etmez.

### Task 5: Regression ve baseline doğrulama
- Dar testler:
  - `node --experimental-strip-types --experimental-specifier-resolution=node --test tests/admin-operations-client.test.mts`
  - `node --experimental-strip-types --experimental-specifier-resolution=node --test tests/admin-operations-view-model.test.mts`
  - `node --experimental-strip-types --experimental-specifier-resolution=node --test tests/payload-admin-operations-config.test.mts`
- Backend regression:
  - `node --experimental-strip-types --experimental-specifier-resolution=node --test tests/admin-workflow-snapshot-route.test.mts tests/read-model-route.test.mts tests/admin-workflow-route.test.mts`
  - `npm.cmd run test:db-security`
- Repo baseline:
  - `npm.cmd run typecheck`
  - `npm.cmd run lint`
  - `npm.cmd test`
  - `npm.cmd run build`
- Eğer admin dev server açılabiliyorsa tarayıcı smoke:
  - `/admin/operations` açılır.
  - Nav link görünür.
  - Liste yüklenir.
  - Eligibility false olan aksiyonlarda butonlar disabled kalır.

## API / Interface Notları
- Yeni public API yok.
- Internal client helper route listesi değişmez: `/api/admin/read/*` ve `/api/admin/workflows/*`.
- Yeni internal export: `buildOperationsViewModel(input)`.
- Payload custom view path’i kesin olarak `/admin/operations`.

## Varsayımlar
- Snapshot ve read-model route’ları source of truth kabul edilir.
- DB migration yazılmaz.
- Payload Admin bu operasyon ekranının sahibidir; public frontend kapsam dışıdır.
- Commit/stage sınırı yalnızca admin operations UI entegrasyon dosyalarıdır; payment callback smoke, state-changing JSON boundary ve diğer dirty değişiklikler karıştırılmaz.
