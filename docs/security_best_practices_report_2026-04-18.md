# Security Best Practices Report

Tarih: 2026-04-18
Kapsam: `C:\Users\umut\MetaGPT\workspace\nihaiEmlak_windows_canonical` mevcut worktree durumu

## Executive Summary

Bu incelemede mevcut worktree uzerinden statik kod taramasi, repo baseline testi ve uretim bagimlilik audit'i yapildi.

- Kritik veya yuksek siddette dogrulanmis bulgu cikmadi.
- 2 adet `Medium`, 2 adet `Low` bulgu tespit edildi.
- `npm test` basarili.
- `npm audit --omit=dev --json` sonucunda uretim bagimliliklarinda bilinen acik gorulmedi.
- Pozitif taraf: odeme callback akisi raw body + boyut limiti + content-type allowlist + sabit zamanli hash karsilastirmasi kullaniyor; checkout init akisi kullanici sahipligini server tarafinda dogruluyor; proxy katmani nonce tabanli CSP uyguluyor.

Not: Bu repo tarama aninda dirty worktree durumundaydi. Bulgular mevcut dosya sistemindeki kod ve migration dosyalarina gore yazildi; runtime ortami, deploy edge katmani ve uygulanmis veritabani migration seviyesi ayri dogrulanmadi.

## Medium

### SEC-001: `SECURITY DEFINER` callback receipt RPC'si `anon` ve `authenticated` rollerine acik

- Rule ID: SEC-001
- Severity: Medium
- Location: `supabase/migrations/20260415223000_03_payment_callback_receipts.sql:16`, `supabase/migrations/20260415223000_03_payment_callback_receipts.sql:47`, `supabase/migrations/20260415223000_03_payment_callback_receipts.sql:66`
- Evidence:

```sql
create or replace function public.register_payment_callback_receipt(...)
returns boolean
language plpgsql
security definer
set search_path = ''

insert into public.payment_callback_receipts (...)

grant execute on function public.register_payment_callback_receipt(text, text, text, text)
to anon, authenticated;
```

- Impact: Anon veya dusuk ayricalikli istemciler RLS'i bypass eden bu RPC'yi cagirip callback receipt tablosuna keyfi satirlar yazabilir; bu audit trail'i kirletebilir ve event key tahmin edilebildigi durumda duplicate-detection davranisini bozabilir.
- Fix: Fonksiyonu `private` veya `internal` schema'ya tasi; `anon` ve `authenticated` icin `EXECUTE` yetkisini kaldir; sadece `service_role` veya kontrollu server-side worker rolune izin ver.
- Mitigation: Hemen tasinamiyorsa en azindan `revoke execute ... from anon, authenticated, public;` uygulayip server-side cagrilari ayricalikli rol uzerinden surdur.
- False positive notes: Runtime DB'de ek bir hardening migration uygulanmis olabilir; bu bulgu repo icindeki gorunen migration zincirine gore yazildi.

### SEC-002: `.gitignore` tum `.env*` varyantlarini engellemiyor

- Rule ID: SEC-002
- Severity: Medium
- Location: `.gitignore:33`, `.gitignore:34`, `.gitignore:35`, `.gitignore:36`
- Evidence:

```gitignore
# env files (can opt-in for committing if needed)
.env*.local
.env
```

- Impact: `.env.production`, `.env.staging`, `.env.test` veya benzeri dosyalar yanlislikla repo'ya eklenebilir; bu repo servis rol anahtari, DB baglanti string'i ve payment secret'lari kullandigi icin gizli bilgi sizintisi etkisi yuksek olur.
- Fix: `.env*` desenini genel olarak ignore et, sadece `.env.example` dosyasini allowlist et.
- Mitigation: CI'da `.env*` commit'lerini reddeden bir secret-scan veya pre-receive kontrolu ekle.
- False positive notes: Bu bulgu aktif bir sizintiyi degil, kolayca gerceklesebilecek bir operasyonel hata riskini ifade eder.

## Low

### SEC-003: Ayricalikli `SECURITY DEFINER` fonksiyonlar halen `public` schema altinda

- Rule ID: SEC-003
- Severity: Low
- Location: `supabase/migrations/20260415213000_02_profiles_auth.sql:32`, `supabase/migrations/20260415213000_02_profiles_auth.sql:64`, `supabase/migrations/20260415223000_03_payment_callback_receipts.sql:16`, `supabase/migrations/20260417173000_08_atomic_payment_checkout.sql:4`
- Evidence:

```sql
create or replace function public.handle_new_user() ... security definer
create or replace function public.is_admin() ... security definer
create or replace function public.register_payment_callback_receipt(...) ... security definer
create or replace function public.process_payment_checkout(...) ... security definer
```

- Impact: Bugun icin her fonksiyon ayni siddette acik degil; ancak privileged fonksiyonlarin `public` schema'da tutulmasi, gelecekte yanlis `GRANT`, RPC exposure veya policy tasmasi ile saldiri yuzeyini gereksiz buyutur.
- Fix: Tetikleyici veya ic servis fonksiyonlarini `private`/`internal` schema'ya tasi; `public` schema'yi yalnizca gercekten dis API yuzeyi olan nesneler icin kullan.
- Mitigation: Schema tasima hemen yapilamiyorsa tum privileged fonksiyonlar icin `REVOKE EXECUTE FROM PUBLIC` taban cizgisini migration'lara ekle.
- False positive notes: `process_payment_checkout` icin mevcut migration'da `service_role` ile sinirlama var; risk burada dogrudan exploit'ten cok future-hardening eksikligidir.

### SEC-004: Canonical origin ayarlari bazi server-side yuzeylerde `localhost`'a fail-open dusuyor

- Rule ID: SEC-004
- Severity: Low
- Location: `payload.config.ts:14`, `payload.config.ts:40`, `app/layout.tsx:6`, `app/layout.tsx:11`
- Evidence:

```ts
const publicServerURL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

serverURL: publicServerURL,
```

```ts
const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

metadataBase: new URL(defaultUrl),
```

- Impact: Uretimde canonical origin eksik konfigure edilirse admin/auth/link ureten server-side yuzeyler yanlis origin'e dusebilir; bu durum link butunlugunu ve guvenilen origin varsayimlarini zayiflatir.
- Fix: Checkout init akisindaki gibi development/test disinda canonical origin'i zorunlu kil ve fail-closed davran.
- Mitigation: Deploy pipeline'inda `SITE_URL` veya canonical origin env'i yoksa build/start fail etsin.
- False positive notes: Bu bulgu dogrudan auth-bypass degil; daha cok trusted-origin butunlugu ve operasyonel guvenlik sertlestirmesi ile ilgilidir.

## Verification Performed

### Static Review

- `process.env`, `service_role`, `SECURITY DEFINER`, redirect, CSP, payment callback, Supabase access, `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, `localStorage`, `document.write`, `postMessage`, `fetch`, `Access-Control-Allow-Origin` kaliplari icin hedefli tarama yapildi.
- Odeme callback ve checkout init yollarinda dosya bazli detay inceleme yapildi.

### Commands

```powershell
npm test
npm audit --omit=dev --json
```

Sonuc:

- `npm test`: basarili
- `npm audit --omit=dev --json`: uretim bagimliliklarinda 0 bilinen acik

## Verification Gaps

- Supabase auth cookie'lerinin runtime `SameSite`, `Secure`, `HttpOnly` ayarlari uygulama kodunda dogrudan gorunmedigi icin kesin dogrulanmadi.
- Edge/CDN/WAF tarafinda rate limiting, HSTS, CORS ve ekstra security header'larin uygulanip uygulanmadigi repo icinden dogrulanamadi.
- Payload REST/GraphQL endpoint'lerinin runtime auth/csrf davranisi kullanilan Payload runtime ayarlari ve deployment topolojisine bagli; repo kodunda gorunen konfig ile sinirli degerlendirildi.

## Recommended Next Steps

1. `register_payment_callback_receipt` fonksiyonunu `private` schema + `service_role` ile daralt.
2. `.gitignore` kuralini `.env*` genel deny + `.env.example` explicit allowlist seklinde sertlestir.
3. Kalan `SECURITY DEFINER` fonksiyonlari `public` disina tasima planini migration olarak tamamla.
4. Payload ve app-level canonical origin ayarlarini production'da fail-closed hale getir.
