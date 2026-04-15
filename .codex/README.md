# Codex Local Environment

This project uses a shared Codex local environment file at `.codex/environments/environment.toml`.

What it provides:
- automatic setup for new worktrees
- cleanup before worktree deletion
- reusable top-bar actions for install, test, typecheck, and app-specific helpers

Canonical workspace:
- `C:\Users\umut\MetaGPT\workspace\nihaiEmlak_windows_canonical`

Reference-only old copies:
- `C:\Users\umut\MetaGPT\workspace\nihaiEmlak_1775004324`
- `/home/umut/code/nihaiEmlak_1775004324__ARCHIVE_DO_NOT_USE`

Recommended workflow in this repo:
- open the canonical Windows workspace above
- read `AGENTS.md` before touching code or docs
- check `package.json` scripts before running commands
- keep daily development in the canonical workspace unless the user explicitly asks for an archive copy

Useful commands:
- `npm install`
- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run test:db-security`
- `bash .codex/scripts/test.sh`

Important:
- `npm test` is the default narrow baseline in this workspace.
- Use `bash .codex/scripts/test.sh` only when broader validation is warranted.
