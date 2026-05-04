# Nihai Emlak

Bu repo, emlak operasyon platformunun backend ve altyapi workspace'idir.

Mevcut durum:

- aktif kod tabani starter uzerinden yeniden kurulmustur
- Supabase auth akisi calisirdadir
- Payload CMS admin/API iskeleti kuruludur
- Is Bankasi callback dogrulama skeleton'i vardir
- Inngest endpoint ve ilk workflow skeleton'i vardir
- asil emlak domain modulleri henuz tam uygulanmamistir

Ana kural:
- Supabase-first ilerleyecegiz, gerekmedikce custom backend kodu yazmayacagiz

Sorumluluk siniri:
- frontend ayri bir ekip/kisi tarafinda yaziliyor
- admin panel UI ayri bir ekip/kisi tarafinda yaziliyor
- bu repo icinde bizim odagimiz veri modeli, backend contracts ve minimum gerekli business logic

## Mevcut stack

- Next.js 16
- React 19
- TypeScript
- Supabase SSR + Supabase Auth
- Payload CMS 3
- PostgreSQL (Supabase)
- Inngest
- Tailwind CSS + shadcn/ui
- Paket yoneticisi: `npm`

## Kanonik workspace

Aktif gelistirme yolu:

```text
C:\Users\umut\MetaGPT\workspace\nihaiEmlak_windows_canonical
```

Referans amacli eski kopyalar:

- `C:\Users\umut\MetaGPT\workspace\nihaiEmlak_1775004324`
- `/home/umut/code/nihaiEmlak_1775004324__ARCHIVE_DO_NOT_USE`

Bu eski kopyalari aktif gelistirme workspace'i olarak kullanma.

## Ilk okunacaklar

Repo icinde ilerleme sirasi:

1. `AGENTS.md`
2. `README.md`
3. `docs/PHASE_3_TASKS.md`
4. `docs/SUPABASE_CAPABILITY_AUDIT.md`
5. gorevle ilgili diger plan dokumanlari

Hizli repo haritasi:

- `AGENTS.md`: repo kurallari ve kanonik workspace
- `docs/IMPLEMENTATION_PLAN.md`: faz sirasini ve teslim kapilarini tanimlar
- `docs/PHASE_3_TASKS.md`: guncel checkout backend gorev panosu
- `docs/PHASE_1_2_TASKS.md`: Faz 1 + Faz 2 gorev gecmisi ve erken backend referansi
- `docs/SUPABASE_CAPABILITY_AUDIT.md`: katman karar matrisi
- `docs/CHECKOUT_CONTRACT.md`: Phase 3 frontend/backend checkout API sozlesmesi
- `docs/PROJECT_PLAN.md`: is ve domain baglami
- `docs/BACKEND_PHASE_1.md`: erken faz referans notu
- `docs/WORKSPACE_HEALTH_CHECKLIST.md`: yeni gorev oncesi hizli kontrol listesi

## Kurulum

```powershell
cd C:\Users\umut\MetaGPT\workspace\nihaiEmlak_windows_canonical
npm install
```

Ortam degiskenleri icin `.env.example` dosyasini baz al.

## Dogrulama

En kucuk anlamli baseline:

```powershell
npm test
```

DB, RLS, migration veya RPC degisikliklerinde:

```powershell
npm run test:db-security
```

Daha genis local kontrol gerektiginde:

```powershell
bash .codex/scripts/test.sh
```

Gerektiginde:

```powershell
npm run build
```

## Calisma sekli

Bu repo TDD ile ilerler:

1. aktif faz gorev dokumanindan gorevi sec (`docs/PHASE_3_TASKS.md` Phase 3 icin)
2. `docs/SUPABASE_CAPABILITY_AUDIT.md` ile katman kararini kontrol et
3. en kucuk failing testi yaz veya guncelle
4. minimum implementasyonu yap
5. ilgili testi tekrar calistir
6. ancak sonra daha genis dogrulamaya cik

## Onemli route'lar

- `/admin`: custom admin panel (icerik, ilanlar, operasyonlar)
- `/cms`: Payload CMS fallback admin
- `/api/[...slug]`: Payload REST API
- `/api/graphql`: Payload GraphQL
- `/api/inngest`: Inngest endpoint
- `/api/payment/callback`: Is Bankasi callback endpoint
- `/auth/*`: Supabase auth ekranlari
- `/protected`: auth korumali demo alan

## Environment variables

Zorunlu cekirdek degiskenler:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `SITE_URL` (onerilen; production server-side origin icin)
- `DATABASE_URI`
- `PAYLOAD_SECRET`

Duruma bagli degiskenler:

- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`
- `ISBANK_STORE_KEY`

Ornek degerler icin `.env.example` dosyasina bak.

## Dokuman referanslari

- Ana proje plani: `docs/PROJECT_PLAN.md`
- Supabase-first capability audit: `docs/SUPABASE_CAPABILITY_AUDIT.md`
- Ilk backend implementasyon listesi: `docs/BACKEND_PHASE_1.md`
- Faz bazli uygulama sirasi: `docs/IMPLEMENTATION_PLAN.md`
- Faz 3 checkout gorev listesi: `docs/PHASE_3_TASKS.md`
- Phase 3 checkout API sozlesmesi: `docs/CHECKOUT_CONTRACT.md`
- Faz 1-2 somut gorev listesi: `docs/PHASE_1_2_TASKS.md`
- Workspace kontrol listesi: `docs/WORKSPACE_HEALTH_CHECKLIST.md`

## Durum notu

Bu repo artik genel Supabase starter dokumani degil. Domain modeli, odeme kalemleri, ek hizmetler ve operasyon akislarina odakli backend workspace'i olarak ele alinmalidir.

Mimari ayrim:
- Supabase = operational backend
- Payload = content backend
- Is Bankasi = payment layer
- Chatwoot = communication layer
