# Security Best Practices Review Report

Date: 2026-04-13  
Scope: Next.js + Supabase + Payload + Inngest code under `app/`, `lib/`, `payload.config.ts`, `next.config.ts`, dependency audit (`npm audit --omit=dev`)

## Executive Summary

Bu incelemede kritik güvenlik yüzeyleri (auth redirect, ödeme callback doğrulama, Payload secret yönetimi, prod admin yüzeyi ve temel response header'ları) kontrol edildi.  
Toplam 8 bulgu değerlendirildi:

- 4 adet High
- 3 adet Medium
- 1 adet Low

Kod içinde tespit edilen High/Medium bulguların tamamı bu turda patchlenmiştir.  
Bağımlılık upgrade turu sonrası `npm audit --omit=dev` sonucu `high: 0`, `moderate: 5` seviyesine düşürülmüştür.

## High Severity

### SBP-001 (Fixed) - Auth confirm akışında open redirect riski
- Location: `app/auth/confirm/route.ts:10,21` (önceki durum)
- Evidence: `next` query param doğrudan `redirect(next)` ile kullanılıyordu.
- Impact: Kullanıcı doğrulama sonrası harici domaine yönlendirilebilir (phishing / auth-flow abuse).
- Fix Applied:
  - `getSafeNextPath()` eklendi, sadece relative path (`/`) kabul ediliyor.
  - Dosya: `app/auth/confirm/route.ts:6-15,21,32`

### SBP-002 (Fixed) - Ödeme callback doğrulamasında fail-open secret davranışı
- Location: `app/api/payment/callback/route.ts:47` (önceki durum)
- Evidence: `ISBANK_STORE_KEY` yoksa `""` kullanılıyordu.
- Impact: Yanlış konfigürasyonda doğrulama mantığı güvenlik anahtarsız çalışır.
- Fix Applied:
  - Key yoksa `500` ile fail-closed dönülüyor.
  - Dosya: `app/api/payment/callback/route.ts:60-69`

### SBP-003 (Fixed) - Geçersiz imzalı callback event’i iç iş akışına iletiliyordu
- Location: `app/api/payment/callback/route.ts:52-59` (önceki durum)
- Evidence: `verified` false olsa da `payment/callback.received` event’i gönderiliyordu.
- Impact: Internal workflow katmanına zehirli event akışı riski.
- Fix Applied:
  - Invalid imzada yalnızca `payment/callback.rejected` gönderiliyor.
  - `payment/callback.received` sadece doğrulanmış callback için gönderiliyor.
  - Dosya: `app/api/payment/callback/route.ts:95-124`

### SBP-004 (Fixed) - Payload secret için production fallback
- Location: `payload.config.ts:26` (önceki durum)
- Evidence: `secret: payloadSecret ?? "dev-only-payload-secret"` koşulsuz fallback idi.
- Impact: Prod yanlış konfigürasyonda tahmin edilebilir secret ile token/cookie güvenliği zayıflar.
- Fix Applied:
  - Prod ortamında `DATABASE_URI` / `PAYLOAD_SECRET` zorunlu.
  - Eksikte process startup `throw` ile durduruluyor.
  - Dosya: `payload.config.ts:26-32`

## Medium Severity

### SBP-005 (Fixed) - GraphQL Playground production'da açık
- Location: `app/(payload)/api/graphql/route.ts:4` (önceki durum)
- Evidence: `GET = GRAPHQL_PLAYGROUND_GET(configPromise)` koşulsuz export ediliyordu.
- Impact: Prod ortamında gereksiz endpoint keşfi / introspection yüzeyi.
- Fix Applied:
  - Prod’da GET `404`, dev’de Playground aktif.
  - Dosya: `app/(payload)/api/graphql/route.ts:4-7`

### SBP-006 (Fixed) - Temel response güvenlik header’ları tanımlı değildi
- Location: `next.config.ts` (önceki durum)
- Evidence: Security header override yoktu.
- Impact: `nosniff`, clickjacking, referrer policy savunmaları eksik.
- Fix Applied:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - Dosya: `next.config.ts:6-26`

### SBP-007 (Partially Fixed) - Bağımlılık güvenlik açıkları (transitive)
- Location: `package-lock.json` (audit çıktısı)
- Evidence:
  - Uygulanan güncellemeler:
    - `payload`, `@payloadcms/next`, `@payloadcms/db-postgres` -> `3.83.0-internal.ddc1147`
    - `drizzle-orm` zinciri -> `0.45.2` (high SQLi advisory kapanmış durumda)
    - `dompurify` override -> `3.3.3`
  - Kalan açıklar:
    - `drizzle-kit -> @esbuild-kit/esm-loader -> @esbuild-kit/core-utils -> esbuild@0.18.20`
    - `npm audit --omit=dev` sonucu: `high: 0`, `moderate: 5`
- Impact: Kalan riskler build/dev-tool zinciri üzerinden geliyor; runtime exploitability sınırlı olsa da supply-chain hijyeni açısından takip edilmesi gerekir.
- Recommended Action:
  - `drizzle-kit` ve `@esbuild-kit/*` için upstream fix çıktığında öncelikli upgrade.
  - Payload tarafında internal yerine stable patch çıktığında stable hatta geri dönme planı yapılmalı.

## Low Severity

### SBP-008 (Fixed) - Hata mesajı query param’a encode edilmeden yazılıyordu
- Location: `app/auth/confirm/route.ts:24` (önceki durum)
- Evidence: `error?.message` direkt URL query string’e ekleniyordu.
- Impact: Query bozulması / gereksiz bilgi sızması.
- Fix Applied:
  - `encodeURIComponent` ile encode edildi.
  - Dosya: `app/auth/confirm/route.ts:35`

## Validation Performed

- `bash .codex/scripts/typecheck.sh` ✅
- `bash .codex/scripts/test.sh` ✅ (repo test script: `typecheck + lint`)
- `npm audit --omit=dev --json` ✅ (çıktı analiz edildi)

## Not Fully Verified

- Edge/WAF/rate-limit politikaları (kod dışında olabilir)
- Prod runtime’da TLS termination ve header override davranışı
- Isbank callback field-order sözleşmesinin banka dokümanına birebir uyumu (iskelette güvenlik kontrolleri güçlendirildi; nihai entegrasyon sırasında banka spec ile birebir doğrulama önerilir)
