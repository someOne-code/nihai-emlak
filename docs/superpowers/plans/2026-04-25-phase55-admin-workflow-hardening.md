# Faz 5.5 Admin Workflow Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin workflow RPC ve route davranislarini fail-closed invariant kurallariyla sabitlemek.

**Architecture:** Supabase authoritative boundary korunur. State transition ve eligibility kararlari DB/RPC icinde kalir; Next route sadece auth, origin, body parse ve hata mapping siniridir.

**Tech Stack:** PostgreSQL/Supabase migrations, SQL smoke tests, Next.js route helper tests, Node test runner, npm.

---

## Summary

Bu plan `admin_cancel_reservation`, `admin_confirm_reservation`, `admin_reopen_listing` ve snapshot read modellerini launch oncesi fail-closed kurallarla ayni hizaya getirir.

Mevcut calisma agaci kirli olabilir. Bu plan sadece admin workflow kapsamini hedefler:

- `supabase/migrations/20260423120000_25_admin_workflow_rpcs.sql`
- `tests/sql/phase4_admin_workflows.sql`
- `tests/admin-workflow-route.test.mts`
- `lib/admin/workflow-route.ts`

Faz 5 read-model dokumani/RPC degisiklikleri ayri is ve ayri commit olarak kalmalidir.

## Task 0: Scope ve Calisma Agaci Kapisi

**Files:**
- Inspect only: `git status --short`
- Inspect only: admin workflow diff

- [ ] **Step 1: Calisma agacini kontrol et**

Run:

```powershell
git status --short
```

Expected:

- Admin workflow dosyalari disinda degisiklikler olabilir.
- Scope disi dosyalar stage edilmez.

- [ ] **Step 2: Admin workflow diff'ini oku**

Run:

```powershell
git diff -- supabase/migrations/20260423120000_25_admin_workflow_rpcs.sql tests/sql/phase4_admin_workflows.sql tests/admin-workflow-route.test.mts lib/admin/workflow-route.ts
```

Expected:

- Sadece Faz 5.5 admin workflow davranisi icin gerekli degisiklikler gorulur.
- Scope disi Faz 5 read-model degisiklikleri bu plana dahil edilmez.

## Task 1: SQL Fail-Closed Testlerini Sabitle

**Files:**
- Modify: `tests/sql/phase4_admin_workflows.sql`

- [ ] **Step 1: Confirm already-finalized testini ekle veya dogrula**

Behavior:

- Full final tuple (`reservation=confirmed`, `order=completed`, `payment=succeeded`, `listing=passive`) icin snapshot `can_confirm=false` doner.
- `public.admin_confirm_reservation(...)` ayni durumda `P0001` doner.

- [ ] **Step 2: Confirm partial-terminal drift testini ekle veya dogrula**

Behavior:

- `order=completed`, `reservation=pending`, `listing=active`, `payment=pending` gibi partial-terminal drift icin snapshot `can_confirm=false` doner.
- Confirm RPC `P0004` ile fail-closed olur.

- [ ] **Step 3: Cancel partial-terminal drift testini ekle veya dogrula**

Behavior:

- `payment=succeeded` veya `order=completed` terminal sinyali var ama full success tuple yoksa snapshot `can_cancel=false` doner.
- Cancel RPC `P0004` ile fail-closed olur.

- [ ] **Step 4: Amount/currency drift testini ekle veya dogrula**

Behavior:

- `payment.amount != order.total_amount` veya `payment.currency != order.currency` icin snapshot `can_confirm=false` ve `can_cancel=false` doner.
- Confirm ve cancel RPC `P0004` ile fail-closed olur.

- [ ] **Step 5: Other occupant confirm rejection testini ekle veya dogrula**

Behavior:

- Ayni listing icin baska `confirmed/completed/succeeded` occupant varsa stale reservation confirm edilemez.
- Snapshot `can_confirm=false`; confirm RPC `P0001` doner.

- [ ] **Step 6: Red dogrulama**

Run:

```powershell
npm.cmd run test:db-security
```

Expected:

- Yeni testlerden biri mevcut implementation ile fail eder.
- Testler zaten pass ediyorsa mevcut uncommitted implementation bu davranisi zaten kapatmistir; Task 2 statik dogrulama olarak ilerler.

## Task 2: Admin Workflow RPC Guardlarini Minimal Uygula

**Files:**
- Modify: `supabase/migrations/20260423120000_25_admin_workflow_rpcs.sql`

- [ ] **Step 1: `internal.admin_cancel_reservation` invariantlarini uygula**

Required checks after locks:

- `order.user_id = reservation.user_id`
- `payment.user_id = reservation.user_id`
- `payment.order_id = order.id`
- `listing.status in ('active', 'passive')`
- `payment.amount = order.total_amount`
- `payment.currency = order.currency`

- [ ] **Step 2: Cancel terminal drift kuralini uygula**

Rule:

- Terminal signal varsa (`payment=succeeded` veya `reservation=confirmed` veya `order=completed` veya `listing=passive`), sadece full success tuple cancel edilebilir.
- Full success tuple: `payment=succeeded`, `reservation=confirmed`, `order=completed`, `listing=passive`.
- Diger terminal kombinasyonlari `P0004` doner.

- [ ] **Step 3: `internal.admin_confirm_reservation` invariantlarini uygula**

Required checks before payment status business check:

- `payment.amount = order.total_amount`
- `payment.currency = order.currency`
- Already-finalized full tuple `P0001`
- Partial confirm terminal signal `P0004`

- [ ] **Step 4: Occupancy guardini koru**

Rule:

- Baska `confirmed/completed/succeeded` occupant count `> 0` ise confirm RPC `P0001` doner.

- [ ] **Step 5: Green dogrulama**

Run:

```powershell
npm.cmd run test:db-security
```

Expected:

- `test-db-security: ok`

## Task 3: Snapshot Eligibility ile Write Path'i Esitle

**Files:**
- Modify: `supabase/migrations/20260423120000_25_admin_workflow_rpcs.sql`

- [ ] **Step 1: `can_cancel` predicate'ini cancel write path ile esitle**

Predicate must include:

- ownership consistency
- payment-order link consistency
- valid listing status
- matching amount/currency
- cancelable reservation/order states
- terminal drift rule

- [ ] **Step 2: `can_confirm` predicate'ini confirm write path ile esitle**

Predicate must include:

- ownership consistency
- payment-order link consistency
- valid listing status
- matching amount/currency
- `payment.status = 'succeeded'`
- allowed reservation/order statuses
- no other occupant
- no confirm terminal signal

- [ ] **Step 3: Snapshot drift davranisini dogrula**

Rule:

- Write RPC'nin reddedecegi drift durumlari snapshot'ta aksiyon `true` gostermemelidir.

- [ ] **Step 4: SQL dogrulama**

Run:

```powershell
npm.cmd run test:db-security
```

Expected:

- `test-db-security: ok`

## Task 4: Route Boundary Regression

**Files:**
- Modify: `tests/admin-workflow-route.test.mts`
- Modify only if needed: `lib/admin/workflow-route.ts`

- [ ] **Step 1: Route surface matrix testlerini koru veya tamamla**

Surfaces:

- cancel
- confirm
- reopen

Expected behavior:

- Missing origin: `403`
- Untrusted origin: `403`
- Auth lookup failure: `401`
- Profile lookup failure: `500`

- [ ] **Step 2: SQLSTATE mapping testlerini koru veya tamamla**

Expected behavior:

- `P0004 -> 500 Admin workflow invariant violation`
- `22023 -> 400 Invalid admin workflow request`
- Mapping mesaj substring'ine bagli olmamalidir.

- [ ] **Step 3: Dar route testi calistir**

Run:

```powershell
node --experimental-strip-types --experimental-specifier-resolution=node --test tests/admin-workflow-route.test.mts
```

Expected:

- Admin workflow route testleri pass.

## Task 5: Final Validation ve Commit Hazirligi

**Files:**
- Stage only admin workflow files.

- [ ] **Step 1: SQL baseline**

Run:

```powershell
npm.cmd run test:db-security
```

Expected:

- `test-db-security: ok`

- [ ] **Step 2: Route baseline**

Run:

```powershell
node --experimental-strip-types --experimental-specifier-resolution=node --test tests/admin-workflow-route.test.mts
```

Expected:

- Pass.

- [ ] **Step 3: Repo baseline**

Run:

```powershell
npm.cmd test
```

Expected:

- payment callback security, typecheck, lint pass.

- [ ] **Step 4: Whitespace kontrolu**

Run:

```powershell
git diff --check
```

Expected:

- Whitespace error yok.

- [ ] **Step 5: Stage ve commit**

Run:

```powershell
git add supabase/migrations/20260423120000_25_admin_workflow_rpcs.sql tests/sql/phase4_admin_workflows.sql tests/admin-workflow-route.test.mts lib/admin/workflow-route.ts
git commit -m "fix: harden admin workflow invariants"
```

Expected:

- Sadece admin workflow kapsami commitlenir.
- Faz 5 read-model dokuman/RPC degisiklikleri bu committe yer almaz.

## Public Interface Changes

- HTTP route shape degismez.
- RPC isimleri degismez: `admin_cancel_reservation`, `admin_confirm_reservation`, `admin_reopen_listing`, `get_admin_reservation_workflow_snapshot`.
- Drift ve invariant ihlalleri admin aksiyonuyla onarilmaz; `P0004`/HTTP `500` ile fail-closed olur.
- Snapshot eligibility write RPC'nin reddedecegi aksiyonlari `true` gostermez.

## Assumptions

- Refund/iade akisi bu taskin disinda.
- Admin UI eklenmez.
- `P0004` invariant drift olarak kalir ve HTTP tarafinda `500` doner.
- `P0001` business conflict olarak kalir ve HTTP tarafinda `409` doner.
