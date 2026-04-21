# Security Best Practices Review Report

Tarih: 2026-04-21
Kapsam: `C:\Users\umut\MetaGPT\workspace\nihaiEmlak_windows_canonical`

## Executive Summary

Bu tarama Next.js/React route yuzeyi, Supabase migration/RLS/RPC katmani, Payload CMS auth koleksiyonu, odeme callback/checkout akisi, env/secret hijyeni, CI guvenlik kapilari ve dependency posture uzerinden yapildi.

- Critical: 0
- High: 1
- Medium: 3
- Low: 2

Pozitif notlar:

- Is Bankasi callback akisi imza dogrulama, callback kontrat kontrolu, duplicate receipt ve atomik DB function ayrimini buyuk olcude dogru kurmus.
- Kritik payment `SECURITY DEFINER` fonksiyonlari `internal` semaya tasinmis ve `service_role` ile sinirlanmis.
- CSP nonce tabanli ve wildcard/unsafe script kaynaklari gorunmuyor.
- `npm test` ve `npm audit --omit=dev` basarili.

## High

### SBP-2026-04-21-001 - Payload `users` koleksiyonunda explicit access-control yok

- Rule ID: PAYLOAD-AUTHZ-001
- Severity: High
- Location: `payload/collections/Users.ts:3-15`
- Evidence:

```ts
export const Users = {
  slug: "users",
  auth: true,
  admin: {
    useAsTitle: "email",
  },
  fields: [
    {
      name: "fullName",
      type: "text",
    },
  ],
} satisfies CollectionConfig;
```

- Impact: Payload v3.83 dokumanina gore default access kontrolu sadece `Boolean(req.user)` davranisina dayanir. Bu koleksiyonda role/owner/admin access tanimi olmadigi icin herhangi bir authenticated Payload kullanicisinin kullanici koleksiyonu uzerinde beklenenden genis CRUD/admin yuzeyine erisme riski var.
- Fix: `users` koleksiyonuna explicit `access` ekle. En azindan admin panel erisimi, create/read/update/delete ve unlock davranislari rol tabanli olmali; admin olmayan kullanici yalnizca kendi kaydini okuyup guncelleyebilmeli veya hic admin yuzeyine girememeli.
- Mitigation: Payload admin kullanicilarini az sayida tut; public kayit/acik auth endpoint davranisini deployment'ta ayrica dogrula.
- False positive notes: Bu bulgu Payload default access semantigine dayaniyor; runtime'da upstream proxy veya Payload plugin ile ek kisit varsa ayrica dogrulanmali.

## Medium

### SBP-2026-04-21-002 - Cookie-auth checkout init endpoint'inde explicit CSRF/Origin gate yok

- Rule ID: NEXT-CSRF-001
- Severity: Medium
- Location: `lib/payments/checkout-init-route.ts:96-123`, `lib/payments/checkout-init-route.ts:213-222`, `lib/payments/checkout-init-route.ts:507-515`
- Evidence:

```ts
const bodyResult = await readCheckoutInitRequestBody(request);
const userResult = await supabase.auth.getUser();
...
const payload = await request.json();
...
const paymentInsertBuilder = supabase.from("payments").insert?.({
  amount: order.totalAmount,
  currency: order.currency,
  order_id: order.id,
  provider: "isbank",
  status: "pending",
  user_id: userId,
});
```

- Impact: Endpoint cookie tabanli Supabase session ile calisiyor ve state degistiriyor. CORS/preflight pratik riski azaltabilir; ancak route seviyesinde `Origin`/`Sec-Fetch-Site`/CSRF veya content-type allowlist yok. Bu, gelecekte istemci/form veya proxy davranisi degistiginde state-changing route'u zayif bir sinirda birakir.
- Fix: `POST /api/checkout/init` icin `Content-Type: application/json` zorunlu kil; `Origin` ve `Host` degerlerini canonical site origin'e karsi dogrula veya CSRF token stratejisi ekle.
- Mitigation: SameSite cookie ve RLS yeterli kabul edilmemeli; edge/proxy tarafinda da cross-site POST deny kuralini ekle.

### SBP-2026-04-21-003 - Payment callback body limiti tam body memory'ye alindiktan sonra uygulanıyor

- Rule ID: NEXT-LIMITS-001
- Severity: Medium
- Location: `lib/payments/callback-route.ts:155`, `lib/payments/callback.ts:33-50`
- Evidence:

```ts
const rawBodyResult = readPaymentCallbackRawBody(await request.arrayBuffer());
```

```ts
const buffer = Buffer.from(arrayBuffer);
...
if (buffer.byteLength > maxBytes) {
  return { ok: false, status: 413, error: "Callback payload is too large" };
}
```

- Impact: App 16 KB limitini dogru kontrol ediyor, fakat kontrol `request.arrayBuffer()` butun body'yi bellekte okuduktan sonra calisiyor. Buyuk veya cok sayida callback istegi memory/CPU baskisi yaratabilir. Invalid signature icin her istekte Inngest rejection eventi de gonderildigi icin abuse maliyeti artabilir.
- Fix: Edge/reverse proxy seviyesinde body size ve rate limit zorunlu kil; mumkunse body stream'ini limitli okuyacak helper kullan. Invalid signature eventlerini throttle et, sample et veya yalnizca aggregate logla.
- Mitigation: Is Bankasi kaynak IP/origin allowlist'i altyapida uygulanabiliyorsa ekle; endpoint icin IP/user-agent degil request rate ve body limit esas olsun.

### SBP-2026-04-21-004 - Env dosyasi ignore kurali tum `.env*` varyantlarini kapatmiyor

- Rule ID: SECRETS-HYGIENE-001
- Severity: Medium
- Location: `.gitignore:33-35`
- Evidence:

```gitignore
# env files (can opt-in for committing if needed)
.env*.local
.env
```

- Impact: `.env.production`, `.env.staging`, `.env.test` gibi dosyalar yanlislikla track edilebilir. Bu repo service role key, DB URI, Payload secret ve payment secret kullandigi icin secret leak etkisi yuksek olur. Ayrica lokal `.env.local` icinde non-placeholder secret degerleri gorundu; dosya git tarafindan track edilmiyor, ama paylasilan ortam/log/snapshot riskinde rotate edilmeli.
- Fix: `.gitignore` kuralini `.env*` ve `!.env.example` seklinde sertlestir; CI'a secret scan veya `.env*` deny kontrolu ekle.
- Mitigation: Lokal secret'larin terminal/session loglarina dusmemesine dikkat et; supheli exposure varsa `PAYLOAD_SECRET` ve DB parolasini rotate et.

## Low

### SBP-2026-04-21-005 - DB security suite CI gate degil ve lokal dogrulama Docker'a bagimli

- Rule ID: TEST-COVERAGE-SECURITY-001
- Severity: Low
- Location: `package.json:9-12`, `.github/workflows/ci.yml:50-79`
- Evidence:

```json
"test": "npm run test:payment-callback-security && npm run typecheck && npm run lint",
"test:db-security": "bash .codex/scripts/test-db-security.sh"
```

```yaml
- name: Run test baseline
  run: npm test
...
- name: Run payment callback smoke test
  run: npm run test:payment-callback-smoke
```

- Impact: RLS, grants, `SECURITY DEFINER`, migration regression'lari PR baseline tarafinda otomatik bloklanmayabilir. Bu calismada `npm run test:db-security` Docker daemon kapali oldugu icin baslamadi.
- Fix: Migration veya SQL test degisikliklerinde CI'da `npm run test:db-security` calistir; local dev icin Docker prerequisite kontrolunu daha acik raporla.
- Mitigation: PR checklist'e DB security suite'i ekle.

### SBP-2026-04-21-006 - App metadata origin production'da localhost fallback'e dusebilir

- Rule ID: NEXT-HOST-001
- Severity: Low
- Location: `app/layout.tsx:8-13`
- Evidence:

```ts
const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
```

- Impact: Vercel disi production ortaminda canonical origin eksikse metadata ve absolute URL uretimi localhost'a duser. Bu dogrudan auth bypass degil, ancak trusted-origin/link butunlugunu zayiflatir.
- Fix: Payload server URL resolver'daki fail-closed yaklasimi metadata icin de kullan; production'da `SITE_URL` veya canonical app origin eksikse fail et.
- Mitigation: Deploy pipeline'da canonical origin env kontrolu ekle.

## Architecture / Logic Notes

- `supabase/migrations/20260421110000_18_phase3_create_checkout_rpc.sql` ve `tests/sql/phase3_task4_create_checkout.sql` su anda git tarafindan track edilmiyor. Bu dosyalar bilincli olarak hazirlik asamasindaysa sorun degil; ancak create checkout RPC'si Faz 3 cekirdek davranisi oldugu icin deploy/CI kapsaminda olmadigi surece uygulanmis kabul edilmemeli.
- Payment callback mimarisi genel olarak dogru katmanda: route handler imza ve boundary kontrollerini yapiyor, state transition DB function'da atomik ilerliyor.
- Supabase RLS ve constraint yaklasimi repo dokumanlarindaki Supabase-first kararlariyla uyumlu. Ana zayiflik daha cok Payload CMS authz ayrimi ve operasyonel gate'lerde.

## Validation Performed

- Static tarama: route handler, env, CSP, Supabase RPC/RLS, Payload collection, XSS/DOM sink, redirect, CORS, command/file access kaliplari.
- `npm test`: OK.
- `npm audit --omit=dev`: OK, `found 0 vulnerabilities`.
- `npm run test:db-security`: calismadi; Docker daemon'a baglanamadigi icin Supabase local DB baslatilamadi.

## Not Fully Verified

- Runtime edge/CDN/WAF rate limitleri repo icinden dogrulanamadi.
- Payload REST/GraphQL endpoint davranisi canli instance uzerinde denenmedi; bulgu repo config'i ve Payload v3.83 dokuman semantigine gore yazildi.
- Is Bankasi resmi banka dokumaniyla callback field listesi yeniden karsilastirilmadi; mevcut test ve kod kontrati baz alindi.
