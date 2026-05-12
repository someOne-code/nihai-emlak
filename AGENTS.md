# Repository Instructions

## Purpose

- This repo is the **backend and infrastructure workspace** for the emlak platform.
- Frontend and admin UI are owned by a separate team unless the task explicitly says otherwise.
- Prefer repository-specific instructions here over generic assumptions.

## Canonical Workspace

- Canonical workspace: `C:\Users\umut\MetaGPT\workspace\nihaiEmlak_windows_canonical`.
- Older WSL copy under `/home/umut/code/nihaiEmlak_1775004324__ARCHIVE_DO_NOT_USE` is now reference-only unless the user explicitly asks to work there.
- Do not treat any older Windows mirror as source of truth for this repo.

## Stack

- Next.js 16
- React 19
- TypeScript
- Supabase
- Payload CMS
- Inngest
- Package manager: `npm`

## Read This First

- Check `package.json` scripts before running commands or changing behavior.
- Use these docs as the repo map:
  - `README.md`: quick orientation
  - `IMPLEMENTATION_PLAN.md`: phase order
  - `BACKEND_PHASE_1.md`: backend engineering blueprint and phase limitations
  - `SUPABASE_CAPABILITY_AUDIT.md`: Supabase-first decision matrix (pre-implementation layer check)
  - `PROJECT_PLAN.md`: business/domain context
- Do not reopen architecture debates that are already settled in these docs unless the user asks to revise them.
- Execution order for daily work is:
  2. run a quick layer decision check in `SUPABASE_CAPABILITY_AUDIT.md`
  3. write or revise the test first
  4. implement the minimum code to satisfy the test
  5. run validation and only then continue

## Architecture Boundaries

- Supabase = operational backend
- Payload = content backend
- Is Bankasi = payment layer
- Chatwoot = communication layer
- `proxy.ts` is only for network-boundary/session refresh behavior, not detailed authorization.
- Detailed authorization and data ownership belong in RLS and database-side logic.

### CORS Policy

- **Current state:** Frontend, API routes, and Payload CMS admin all run within the same Next.js application on the same origin. CORS headers are **not needed** in this configuration.
- **If the architecture changes** to separate domains (e.g., `nihaiemlak.com`, `api.nihaiemlak.com`, `admin.nihaiemlak.com`):
  1. Add explicit CORS allowlist in `next.config.ts` headers or proxy middleware.
  2. Allowed origins (production): `https://nihaiemlak.com`, `https://www.nihaiemlak.com`.
  3. Allowed origins (development): `http://localhost:3000`.
  4. **Never use wildcard `*`** in production CORS configuration.
  5. Credentials (`Access-Control-Allow-Credentials: true`) must be set if cookies/auth headers are sent cross-origin.

## Supabase-First Rules

- Prefer Supabase native features before writing custom application code.
- Decision order for every task:
  1. Auth/session → Supabase Auth
  2. Row-level authorization & ownership → RLS policies
  3. Data state/transactions → Postgres functions / RPC
  4. List/read models → Views / RPC + RLS
  5. File/image storage → Supabase Storage (buckets + storage policies)
  6. Realtime (if needed) → Supabase Realtime
  7. Scheduled/background DB jobs → pg_cron / Supabase Cron, or existing Inngest decision
  8. Privileged operations → Never expose `service_role` to client
- Use Next.js route/controller only as a thin boundary for: auth check, validation, origin/body guards, and external-system orchestration.
- Do not use `service_role` as the default access model.
- Do not use `db_pre_request` as the general authorization strategy.
- Keep source of truth in versioned migration files; `supabase db diff` is only a helper.

### Media & Image Assets

- Do not treat manual image URL entry as final UX. Current `coverImageUrl` text input is a Phase 9A placeholder.
- Target: admin uploads via custom UI → Supabase Storage bucket → post stores path/URL.
- Access policy managed via Storage RLS/policies, not application-layer guards.
- Payload CMS remains content engine; visual asset storage belongs to Supabase Storage.
- Applies to all content types (posts, consultants, categories) needing image assets.

## Security & Data Integrity

- **Defense in Depth:** Security belongs in the database via RLS and Constraints, not just the application layer.
- **Input Validation:** Enforce business logic (e.g., `price >= 0`, `stay_months BETWEEN 1 AND 12`) using database `CHECK` constraints to ensure data integrity at the lowest level.
- **Private Schemas:** Keep sensitive internal logic and `SECURITY DEFINER` functions in private schemas (e.g., `private`, `internal`, or `vault`) rather than the `public` schema to prevent accidental API exposure.
- **Principle of Least Privilege:** Never use `service_role` for client-side requests. Limit its use to necessary server-side orchestration (e.g., Inngest, Edge Functions) where RLS bypass is explicitly required.
- **Audit Trails:** Critical state changes and external callbacks (e.g., payments) must be logged in dedicated event tables for auditability.

## Payload Local API Rules

- When calling the Payload Local API from server-side code (Server Components, Route Handlers, Inngest workers):
  - **Public/user-facing data:** Always pass `overrideAccess: false` so that collection-level access control is enforced.
  - **Admin-only internal operations:** `overrideAccess: true` is allowed only when the caller is a trusted server-side context (e.g., migration, seed script, Inngest worker) and the bypass is explicitly documented in the calling code.
- Default assumption: if `overrideAccess` is not specified, treat it as a review flag — every Payload Local API call should have an explicit `overrideAccess` value.
- Example (public read):
  ```ts
  await payload.find({
    collection: "blog_posts",
    overrideAccess: false,
  });
  ```
- Example (admin-only migration):
  ```ts
  // overrideAccess: true — intentional bypass for backfill migration
  await payload.update({
    collection: "users",
    where: { role: { equals: null } },
    data: { role: "admin" },
    overrideAccess: true,
  });
  ```

## Production Readiness

- Before launch, remove or explicitly justify any compatibility path that silently repairs bad state instead of rejecting it. Missing rows, amount drift, ownership drift, partial terminal states, and other invariant violations must fail closed and be audited.
- Before launch, remove or disable test-only hooks and sentinels from production migrations, RPCs, and route logic. Do not leave special error triggers or rollback probes in the live schema.
- Before launch, fail closed on missing production configuration. Required auth, URL, payment, and origin env vars must stop startup or return a hard error in production; do not skip auth/session protection because setup is incomplete.
- Before launch, keep production origin policy canonical. `localhost`, preview hosts, and non-canonical fallbacks are development conveniences and must not become implicit production defaults for absolute URLs, payment return URLs, or trusted origins unless the deploy strategy explicitly requires them.
- Before launch, do not leave privileged write surfaces duplicated. If a Next.js route is the authoritative boundary for a state-changing flow, direct client-executable RPC or table-write paths that bypass route-level guards must be revoked or explicitly documented as intentional.
- For Phase 3 checkout create, the intentional model is: `POST /api/checkout` is a thin boundary for auth, origin, body parsing, and validator behavior; the authenticated user-context DB/RPC remains the authoritative create path for pricing, eligibility, ownership, and atomic writes. Do not replace this with default `service_role` route orchestration unless the architecture docs are explicitly revised.
- Before launch, remove oversell tolerance from checkout flows. The system must prevent multiple concurrent pending checkout/payment attempts for the same inventory unit, not merely detect conflict after a later callback.

## Change Discipline

- Prefer small, localized changes over sweeping rewrites.
- Do not revert user changes unless explicitly asked.
- Keep client/server boundaries explicit when touching Next.js, Supabase, Payload, or payment flows.
- Preserve the current backend scope; do not drift into frontend redesign unless requested.

## Engineering Law

- This repo follows **test-driven development (TDD)** as a working law.
- Standard loop is: `Red -> Green -> Refactor`.
- Do not start implementation by writing production code first when the behavior can be specified by a test.
- Before changing business logic, schema behavior, RLS behavior, callback behavior, or helper logic:
  1. define the expected behavior
  2. add or update the smallest relevant failing test
  3. implement the minimal change
  4. rerun the relevant test set
  5. refactor only after green
- Favor behavior tests over broad speculative coding.
- Keep tests close to the layer they verify:
  - SQL/RLS/DB function behavior -> SQL smoke/security tests
  - route/helper behavior -> Node/TypeScript tests
  - repo health -> `npm test`, `bash .codex/scripts/test.sh`, and `npm run build` when warranted

## Software Lifecycle

- Work must follow a lightweight software development lifecycle:
  1. clarify task and boundary
  2. perform Supabase-first layer decision
  3. specify expected behavior with tests
  4. implement minimal code
  5. validate against the repo test schema
  6. document the result and residual risk
- Do not treat implementation as complete until the relevant validation layer has passed or the verification gap is explicitly stated.

## Validation

- Smallest relevant validation first.
- Baseline in this Windows canonical workspace: `npm test`
- Full local baseline when the task warrants it: `bash .codex/scripts/test.sh`
- Run `npm run build` only when the task warrants it.
- If something could not be verified, state exactly what was and was not checked.
- Repo test schema:
  - first run the narrowest task-specific test that should fail before the change
  - then run the task-specific green test after the change
  - then run broader repo validation only as needed

## Output Discipline

- Default to quiet or summary output.
- Hide successful test and check output by default.
- Show only warnings or errors for successful runs.
- Cap warning and error excerpts to about 20 lines.
- If 20 lines are not enough, increase the excerpt gradually until the root cause is clear.
- Start diffs and searches with narrow or aggregate views.

Examples:

```bash
cargo test -q > /tmp/cargo-test.log 2>&1; status=$?; rg -n "warning:error\[" /tmp/cargo-test.log | sed -n '1,20p'; exit $status
npm test -- --silent > /tmp/npm-test.log 2>&1; status=$?; rg -n "warning|error" /tmp/npm-test.log | sed -n '1,20p'; exit $status
git diff --stat
git diff -U1 -- src-tauri/src/lib.rs
git diff --unified=1 -- src-tauri/src/quick_read_portal.rs | sed -n '1,20p'
rg -n "quick_read|portal" src-tauri/src
```

## Current Execution Mode

- Before implementing a selected task, use `SUPABASE_CAPABILITY_AUDIT.md` for a quick layer decision check (Supabase native vs thin custom vs external system).
