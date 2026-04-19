# Security Best Practices Review Report

Date: 2026-04-18
Scope: `app/`, `components/`, `lib/`, `payload/`, `payload.config.ts`, `next.config.ts`, `supabase/`, `tests/`, `.github/workflows/ci.yml`, dependency audit

## Executive Summary

Bu turda proje Next.js/React route yuzeyi, Supabase migration/RLS katmani, Is Bankasi checkout ve callback akisi, Payload config, CSP/header ayarlari, CI guvenlik dogrulamalari ve dependency posture uzerinden yeniden tarandi.

Onceki kritik ve yuksek siddetli odeme butunlugu bulgulari kapanmis durumda:

- Callback route artik `provider`, `payment.status`, `provider_ref <-> oid`, `clientid`, `amount`, `currency`, `response` ve `procreturncode` kontratini dogruluyor.
- `process_payment_checkout` DB fonksiyonu terminal state ve provider invariantlarini DB seviyesinde zorunlu kiliyor.
- Callback receipt RPC ve checkout RPC icin `service_role` sinirlamasi korunuyor.
- Hassas `SECURITY DEFINER` fonksiyonlari `internal` semaya alinmis.
- `npm audit --omit=dev` artik temiz.

Guncel sonuc:

- Critical: 0
- High: 0
- Medium: 0
- Low: 2

## Active Findings

### SBP-001 - CI guvenlik odakli DB suite'i otomatik gate olarak calistirmiyor

- Rule ID: TEST-COVERAGE-SECURITY-001
- Severity: Low
- Location:
  - `package.json:3-12`
  - `.github/workflows/ci.yml:34-77`
- Evidence:
  - Repo `test:db-security` ve `test:payment-callback-smoke` script'lerine sahip.
  - CI `Test` job'i sadece `npm test` calistiriyor.
  - Smoke test ayri job olarak var ama sadece belirli path degisikliklerinde tetikleniyor; `test:db-security` icin esdeger job yok.
- Impact:
  - Migration, yetki, RLS veya `SECURITY DEFINER` regression'lari PR seviyesinde otomatik bloklanmayabilir.
  - Bu bir dogrudan exploit degil; ancak DB-katmani guvenlik regression'larinin sessizce merge edilme riskini artirir.
- Fix:
  - En azindan `supabase/migrations/**`, `tests/sql/**`, `lib/payments/**` ve callback route degisikliklerinde `npm run test:db-security` job'i calistir.
  - Alternatif olarak bu suite'i path-filter ile kosullu job veya nightly zorunlu gate haline getir.
- Mitigation:
  - PR checklist'ine `npm run test:db-security` ekle.
  - SQL migration review'larinda yetki/RLS checklist'i zorunlu tut.

### SBP-002 - Bazi non-payment absolute URL ayarlari hala localhost fallback ile fail-open

- Rule ID: NEXT-HOST-001
- Severity: Low
- Location:
  - `payload.config.ts:14-16`
  - `payload.config.ts:34-40`
  - `app/layout.tsx:6-13`
  - `README.md:127-133`
- Evidence:
  - `payload.config.ts` `serverURL` icin `process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"` kullaniyor.
  - `app/layout.tsx` `metadataBase` icin `VERCEL_URL` yoksa `http://localhost:3000` fallback'ine dusuyor.
  - README `NEXT_PUBLIC_SITE_URL` degiskenini zorunlu tanimliyor, ancak bu iki yuzey eksik env durumunda fail-closed degil.
- Impact:
  - Production env eksik konfigure edilirse absolute URL ureten bazi akislar localhost tabanli link/metadata uretebilir.
  - Bu dogrudan bir yetki asimi degil; fakat trusted-origin beklentilerini zayiflatir ve mail/link/metadata butunlugunu bozar.
- Fix:
  - Checkout init tarafinda yapildigi gibi development/test disinda canonical origin eksikse fail-closed davran.
  - `SITE_URL` ve/veya `NEXT_PUBLIC_SITE_URL` icin ortak bir strict resolver kullan.
- Mitigation:
  - Deploy sirasinda canonical origin env var'larini zorunlu check eden startup/CI assert'i ekle.

## Resolved Since Previous Scan

### Resolved - Payload admin CSP strict nonce profiline cekildi

- `lib/security/csp.ts:19-42` artik admin/public ayrimi yapmadan nonce tabanli tek CSP profili uretiyor.
- `/admin` icin `unsafe-inline`, `unsafe-eval` ve genis `https:` / `wss:` wildcard'lari kaldirildi.
- Bu beklenti testte de sertlestirildi:
  - `tests/csp-policy.test.mts:54-78`

### Resolved - DB checkout invariantlari

- `lib/payments/callback-route.ts:571-636` artik `provider`, `payment_status`, `oid`, `provider_ref`, `response`, `procreturncode`, `clientid`, `currency` ve `amount` kontratini dogruluyor.
- `supabase/migrations/20260418090000_11_harden_process_payment_checkout_invariants.sql:77-287` DB seviyesinde provider/state mismatch ve terminal state conflict davranisini zorluyor.
- SQL ve route testleri bu yolu dogruluyor:
  - `tests/payment-callback-route.test.mts`
  - `tests/sql/phase1_task7_payment_state_invariants.sql`

### Resolved - Sensitive definer fonksiyonlar internal schema'ya tasindi

- `supabase/migrations/20260418100000_12_internalize_payment_security_definers.sql:4-100`
- `tests/sql/phase1_task8_internal_payment_functions.sql:6-123`

### Resolved - Payment callback receipt RPC public/anon yuzeyi kapatildi

- `supabase/migrations/20260417203000_10_secure_payment_callback_receipt_rpc.sql`
- `tests/sql/payment_callback_receipts.sql`

### Resolved - Checkout return URL body override ve production fail-open sorunu kapatildi

- `app/api/checkout/init/route.ts:50-63`
- `lib/payments/checkout-init.ts:79-110`

### Resolved - Dependency posture temiz

- `package.json:47-50` patched override'lari tutuyor.
- `npm audit --omit=dev` artik `found 0 vulnerabilities`.

## Validation Performed

- `npm audit --omit=dev` OK, `found 0 vulnerabilities`.
- `npm test` OK.
- `npm run test:db-security` OK.
- `npm run test:payment-callback-smoke` OK.
- Static sink taramasi yapildi:
  - `dangerouslySetInnerHTML`, `innerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`, `localStorage`, `sessionStorage` sinyali repo kodunda gorulmedi.
  - `window.location.origin` sadece ayni-origin auth redirect helper'larinda goruldu:
    - `components/forgot-password-form.tsx:35-37`
    - `components/sign-up-form.tsx:43-48`

## Not Fully Verified

- Runtime edge/CDN/WAF tarafindaki rate limit, bot korumasi ve final response header davranisi repo disi oldugu icin dogrulanmadi.
- Is Bankasi resmi callback field contract'i guncel banka dokumani ile satir satir karsilastirilmadi; degerlendirme mevcut uygulama kontrati ve testler uzerinden yapildi.
