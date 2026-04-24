# Faz 5.5 Admin Workflow Parallel Agent Split

Bu dosya, `2026-04-25-phase55-admin-workflow-hardening.md` planini paralel ajanlara cakismayacak sekilde dagitmak icindir.

## Genel Kurallar

- Her ajan kendi ownership alaninin disina cikmayacak.
- Ajanlar ayni dosyaya yazacaksa ayni bolgeye yazmayacak.
- Her ajan final mesajinda degistirdigi dosyalari ve calistirdigi testleri listeleyecek.
- Ana entegrasyon ajani tum sonuclari birlestirip final testleri calistiracak.
- Scope disi dosyalar commitlenmeyecek: Faz 5 read-model dokuman/RPC dosyalari ayri kalacak.

## Agent A: SQL Write-Path Hardening

**Ownership:**

- `supabase/migrations/20260423120000_25_admin_workflow_rpcs.sql`
- Sadece su bloklar:
- `internal.admin_cancel_reservation`
- `internal.admin_confirm_reservation`
- `internal.admin_reopen_listing`

**Task:**

- `admin_cancel_reservation` icin amount/currency, terminal drift ve ownership invariantlarini dogrula.
- `admin_confirm_reservation` icin amount/currency, partial terminal drift, already-finalized ve other occupant guardlarini dogrula.
- `admin_reopen_listing` lock/live-state davranisini bozmadan kontrol et.

**Do Not Touch:**

- `public.get_admin_reservation_workflow_snapshot`
- `public.get_admin_listing_workflow_snapshot`
- `tests/sql/phase4_admin_workflows.sql`
- `tests/admin-workflow-route.test.mts`
- `lib/admin/workflow-route.ts`

**Validation:**

```powershell
npm.cmd run test:db-security
```

## Agent B: SQL Test Matrix

**Ownership:**

- `tests/sql/phase4_admin_workflows.sql`

**Task:**

- Confirm already-finalized tuple testini ekle.
- Confirm partial-terminal drift testini ekle.
- Cancel partial-terminal drift testini ekle.
- Confirm/cancel amount-currency drift testini ekle.
- Other occupant confirm rejection testini ekle.
- Snapshot eligibility beklentilerini ayni testlerde sabitle.

**Do Not Touch:**

- `supabase/migrations/20260423120000_25_admin_workflow_rpcs.sql`
- `tests/admin-workflow-route.test.mts`
- `lib/admin/workflow-route.ts`

**Validation:**

```powershell
npm.cmd run test:db-security
```

Expected during red phase:

- Testler implementation tamamlanmadan fail edebilir.

## Agent C: Snapshot Eligibility

**Ownership:**

- `supabase/migrations/20260423120000_25_admin_workflow_rpcs.sql`
- Sadece su bloklar:
- `public.get_admin_reservation_workflow_snapshot`
- `public.get_admin_listing_workflow_snapshot`

**Task:**

- `can_cancel` predicate'ini cancel write path ile esitle.
- `can_confirm` predicate'ini confirm write path ile esitle.
- Drift durumlarinda snapshot aksiyonlari `true` gostermesin.
- Listing reopen snapshot mevcut write-path guardlariyla tutarli kalsin.

**Do Not Touch:**

- `internal.admin_cancel_reservation`
- `internal.admin_confirm_reservation`
- `internal.admin_reopen_listing`
- `tests/sql/phase4_admin_workflows.sql`
- `tests/admin-workflow-route.test.mts`
- `lib/admin/workflow-route.ts`

**Validation:**

```powershell
npm.cmd run test:db-security
```

## Agent D: Route Boundary Regression

**Ownership:**

- `tests/admin-workflow-route.test.mts`
- `lib/admin/workflow-route.ts`

**Task:**

- Cancel/confirm/reopen icin ortak route surface testlerini koru veya tamamla.
- Missing origin `403`, untrusted origin `403`, auth lookup failure `401`, profile lookup failure `500`.
- `P0004 -> 500 Admin workflow invariant violation`.
- `22023 -> 400 Invalid admin workflow request`.
- Hata mapping mesaj substring'ine bagli olmasin.

**Do Not Touch:**

- `supabase/migrations/20260423120000_25_admin_workflow_rpcs.sql`
- `tests/sql/phase4_admin_workflows.sql`

**Validation:**

```powershell
node --experimental-strip-types --experimental-specifier-resolution=node --test tests/admin-workflow-route.test.mts
```

## Ana Entegrasyon Ajani

**Ownership:**

- Merge/review only.
- Final staging and commit.

**Task:**

- Agent A ve Agent C ayni migration dosyasina dokunacagi icin bolge cakismasi olup olmadigini diff ile kontrol et.
- Agent B SQL testlerinin Agent A/C implementation ile yesile dondugunu dogrula.
- Agent D route testlerini dogrula.
- Scope disi Faz 5 read-model degisikliklerini stage etme.

**Final Validation:**

```powershell
npm.cmd run test:db-security
node --experimental-strip-types --experimental-specifier-resolution=node --test tests/admin-workflow-route.test.mts
npm.cmd test
git diff --check
```

**Commit:**

```powershell
git add supabase/migrations/20260423120000_25_admin_workflow_rpcs.sql tests/sql/phase4_admin_workflows.sql tests/admin-workflow-route.test.mts lib/admin/workflow-route.ts
git commit -m "fix: harden admin workflow invariants"
```
