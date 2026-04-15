# Workspace Health Checklist

Use this checklist whenever you open the repo or before starting a new backend task.

## 1. Confirm the correct repo

Working directory must be:

```powershell
C:\Users\umut\MetaGPT\workspace\nihaiEmlak_windows_canonical
```

Quick checks:

```powershell
pwd
dir AGENTS.md, package.json, supabase, tests
```

## 2. Read the repo map

Read in this order:

1. `AGENTS.md`
2. `PHASE_1_2_TASKS.md`
3. `SUPABASE_CAPABILITY_AUDIT.md`
4. relevant task docs referenced from those files

## 3. Verify runtime health

Run the smallest useful baseline first:

```powershell
npm test
```

If the task touches DB, RLS, migrations, or RPC:

```powershell
npm run test:db-security
```

If the task touches broader app behavior:

```powershell
bash .codex/scripts/test.sh
```

## 4. Follow the implementation loop

For every task:

1. pick the task from `PHASE_1_2_TASKS.md`
2. do a quick Supabase-first layer check in `SUPABASE_CAPABILITY_AUDIT.md`
3. write or update the smallest failing test first
4. implement the minimum code
5. rerun the relevant tests

## 5. Treat old copies as read-only

Do not use these as active workspaces:

- `C:\Users\umut\MetaGPT\workspace\nihaiEmlak_1775004324`
- `/home/umut/code/nihaiEmlak_1775004324__ARCHIVE_DO_NOT_USE`

If you need historical comparison, read them only. Do not develop there.
