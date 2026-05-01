# Review Findings Payload Clean Checkout Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the review findings that make a clean checkout of `codex/phase-3-checkout-contract` fail because referenced Payload/CMS files are missing from the patch.

**Architecture:** Keep the current branch direction: Payload admin has moved to `/cms`, and Payload content collections are now part of the backend workspace. The fix is to include the missing source files in the branch rather than reverting imports.

**Tech Stack:** Next.js 16, TypeScript, Payload CMS, npm.

---

## Summary

- Add the missing Payload collection/access source files referenced by `payload.config.ts`.
- Add the missing Payload CMS admin route/import map source files referenced by `app/(payload)/layout.tsx`.
- Do not commit generated `app/(payload)/cms/importMap.js`; keep the source `importMap.ts` as the tracked import target.
- Validate with typecheck and a focused diff check against merge base `867a7befdce0db91a07e0b2f9c5f1a3a6eacb061`.

## Key Changes

- Track these Payload content files:
  - `payload/access/content.ts`
  - `payload/collections/BlogCategories.ts`
  - `payload/collections/BlogPosts.ts`
  - `payload/collections/Consultants.ts`
- Track these CMS admin route files:
  - `app/(payload)/cms/importMap.ts`
  - `app/(payload)/cms/[[...segments]]/page.tsx`
- Leave these existing imports unchanged:
  - `payload.config.ts` imports for `BlogCategories`, `BlogPosts`, and `Consultants`
  - `app/(payload)/layout.tsx` import from `./cms/importMap`
- Keep `app/(payload)/cms/importMap.js` unstaged unless a separate Payload build/codegen policy says generated import maps must be versioned.

## Implementation Steps

- [ ] Confirm the missing files are still untracked:

```powershell
git status --short -- payload/access payload/collections 'app/(payload)/cms' payload.config.ts 'app/(payload)/layout.tsx'
```

Expected: the required `.ts`/`.tsx` files are untracked or staged, and `importMap.js` is not staged.

- [ ] Stage only the source files needed to close the findings:

```powershell
git add -- payload/access/content.ts payload/collections/BlogCategories.ts payload/collections/BlogPosts.ts payload/collections/Consultants.ts 'app/(payload)/cms/importMap.ts' 'app/(payload)/cms/[[...segments]]/page.tsx'
```

- [ ] Verify `importMap.js` remains unstaged:

```powershell
git status --short -- 'app/(payload)/cms/importMap.js'
```

Expected: either `?? app/(payload)/cms/importMap.js` or no output if it has been removed/ignored separately; it must not show as staged.

- [ ] Run the narrow validation:

```powershell
npm.cmd run typecheck -- --pretty false
```

Expected: TypeScript passes without missing-module errors.

- [ ] Confirm the clean-checkout diff now contains the missing files:

```powershell
git diff --name-status 867a7befdce0db91a07e0b2f9c5f1a3a6eacb061 -- payload/access payload/collections 'app/(payload)/cms' payload.config.ts 'app/(payload)/layout.tsx'
```

Expected: the new access, collection, and CMS route source files appear with `A` status.

- [ ] If the branch is being prepared for CI, run the repo baseline:

```powershell
npm.cmd test
```

Expected: test baseline passes. If it fails, report only the relevant error excerpt and do not claim the review findings are closed until the missing-file/typecheck failure is gone.

## Assumptions

- `/cms` is the intended Payload admin route for this branch; do not restore the old `/admin` import map to fix the review.
- The Blog Category, Blog Post, and Consultant collections are intentional Payload content backend additions.
- `app/(payload)/cms/importMap.js` is generated output and should not be tracked for this review-finding fix.
