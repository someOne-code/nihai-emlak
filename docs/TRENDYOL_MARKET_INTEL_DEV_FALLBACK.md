# Trendyol Market Intel Dev Fallback

## Findings

- The canonical checkout currently does not contain the Trendyol admin route, worker, or migration files referenced by older `tmp-trendyol-*` logs. Those paths appear to be from another worker branch or an unmerged change set.
- The logs show the intended production data path is Supabase: admin-authenticated reads from Trendyol market intel tables/views and worker ingestion through RPC.
- Docker/local Supabase is therefore a hard dependency for live database tests, but it does not need to be a hard dependency for demo-only UI or adapter development.

## Layer Decision

- Production and admin-authoritative data remain Supabase-native, matching `docs/SUPABASE_CAPABILITY_AUDIT.md`.
- Demo fallback is a thin local development adapter only. It must not be used as an authorization boundary, write path, or production source of truth.
- `production` always resolves to `supabase`, even if `TRENDYOL_MARKET_INTEL_DATA_MODE=json` is set.

## Usage

Use the helper in `lib/trendyol/market-intel-demo-fallback.ts` when a Trendyol demo surface needs data but local Supabase is not running:

```ts
const mode = resolveTrendyolMarketIntelDataMode({
  nodeEnv: process.env.NODE_ENV,
  explicitMode: process.env.TRENDYOL_MARKET_INTEL_DATA_MODE,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});
```

When `mode === "json"`, call `loadTrendyolMarketIntelDemoFallback()`. The default fixture path is `tmp/trendyol-market-intel-demo.json`; it is bootstrapped automatically if missing.

Run the fallback tests without Docker:

```bash
npm run test:trendyol-market-intel
```

## Guardrails

- Do not import this adapter into payment, checkout, listing ownership, or emlak production read/write paths.
- Do not use it with `service_role`.
- Keep any future route integration explicit: Supabase first, JSON fallback only outside production and only for Trendyol demo/read surfaces.
