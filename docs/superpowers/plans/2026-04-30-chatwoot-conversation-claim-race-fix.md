# Chatwoot Conversation Claim Race Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the first-claim concurrency race in `claim_chatwoot_conversation` so duplicate same-user/same-listing requests cannot surface a unique-constraint 500.

**Architecture:** Keep Postgres/Supabase as the authority for claim ownership and provisioning state. Make the RPC conflict-safe with the existing `(user_id, listing_id)` unique constraint, while keeping the Next.js route as a thin caller and error boundary.

**Tech Stack:** PostgreSQL PL/pgSQL migration, Supabase RPC, Next.js route helper, Node test runner, TypeScript.

---

### Task 1: Lock the Route Fallback Contract

**Files:**
- Modify: `tests/phase7-communication-route.test.mts`

- [ ] **Step 1: Add a failing route test for duplicate key fallback**

Add this test near the existing conversation-open RPC error tests:

```ts
test("conversation open maps duplicate first-claim race to in-progress response", async (t) => {
  setupCommunicationEnv(t);

  const response = await handleListingConversationPost(
    createJsonRequest({ initial_message: "Merhaba" }),
    createDependencies({
      rpc: () => ({
        data: null,
        error: {
          code: "23505",
          message: "duplicate key value violates unique constraint chatwoot_conversations_user_listing_key",
        },
      }),
    }),
    { listingId: LISTING_ID },
  );

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Conversation provisioning is already in progress",
  });
});
```

- [ ] **Step 2: Run the narrow test and verify it fails**

Run:

```bash
node --experimental-strip-types --test tests/phase7-communication-route.test.mts
```

Expected: FAIL because SQLSTATE `23505` currently maps to the generic conversation-claim failure path.

### Task 2: Add the Route Guard

**Files:**
- Modify: `lib/communications/conversation-open-route.ts`

- [ ] **Step 1: Map duplicate-key claim races to 409**

In `mapClaimRpcError`, add `23505` handling before the generic `500` fallback:

```ts
  if (error.code === "23505") {
    return {
      status: 409,
      error: "Conversation provisioning is already in progress",
    };
  }
```

- [ ] **Step 2: Run the narrow route test**

Run:

```bash
node --experimental-strip-types --test tests/phase7-communication-route.test.mts
```

Expected: PASS.

### Task 3: Make the RPC Insert Conflict-Safe

**Files:**
- Modify: `supabase/migrations/20260430100000_32_phase7_chatwoot_conversations.sql`
- Create: `tests/phase7-chatwoot-concurrency-contract.test.mts`

- [ ] **Step 1: Add a static contract test for the migration**

Create `tests/phase7-chatwoot-concurrency-contract.test.mts`:

```ts
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("chatwoot conversation claim uses conflict-safe first insert", async () => {
  const source = await readFile(
    new URL("../supabase/migrations/20260430100000_32_phase7_chatwoot_conversations.sql", import.meta.url),
    "utf8",
  );

  assert.match(source, /on conflict\s*\(\s*user_id\s*,\s*listing_id\s*\)\s*do nothing/is);
  assert.match(source, /if v_mapping\.id is null then[\s\S]*for update/is);
});
```

- [ ] **Step 2: Run the static contract test and verify it fails**

Run:

```bash
node --experimental-strip-types --test tests/phase7-chatwoot-concurrency-contract.test.mts
```

Expected: FAIL because the migration still uses the unsafe select-then-insert gap.

- [ ] **Step 3: Replace the initial select-then-insert gap**

In `claim_chatwoot_conversation`, replace the first lookup/insert block with this conflict-safe flow:

```sql
  insert into public.chatwoot_conversations (user_id, listing_id, status)
  values (v_user_id, p_listing_id, 'provisioning')
  on conflict (user_id, listing_id) do nothing
  returning * into v_mapping;

  if v_mapping.id is not null then
    return query
    select
      'claimed'::text,
      v_mapping.id,
      v_mapping.listing_id,
      v_mapping.status,
      v_mapping.chatwoot_source_id,
      v_mapping.chatwoot_conversation_id,
      v_mapping.failure_reason;
    return;
  end if;

  select *
  into v_mapping
  from public.chatwoot_conversations c
  where c.user_id = v_user_id
    and c.listing_id = p_listing_id
  for update;

  if not found then
    raise exception 'chatwoot conversation claim invariant violated' using errcode = 'P0004';
  end if;
```

Keep the existing `ready`, fresh `provisioning`, and stale/failed reclaim logic after this block unchanged.

- [ ] **Step 4: Run the static contract test**

Run:

```bash
node --experimental-strip-types --test tests/phase7-chatwoot-concurrency-contract.test.mts
```

Expected: PASS.

### Task 4: Validate the Fix

**Files:**
- Test only.

- [ ] **Step 1: Run TypeScript validation**

Run:

```bash
npm.cmd run typecheck -- --pretty false
```

Expected: PASS.

- [ ] **Step 2: Run route and contract tests**

Run:

```bash
node --experimental-strip-types --test tests/phase7-communication-route.test.mts tests/phase7-chatwoot-concurrency-contract.test.mts
```

Expected: PASS.

- [ ] **Step 3: Run the Phase 7 SQL smoke validation**

Run the repo's established SQL harness for:

```bash
tests/sql/phase7_chatwoot_conversations.sql
```

Expected: existing scenarios remain green: first claim returns `claimed`, immediate duplicate returns `in_progress`, stale provisioning can be reclaimed, and ready mapping returns without provider provisioning.

- [ ] **Step 4: Run broader repo validation if narrow checks pass**

Run:

```bash
npm.cmd test
```

Expected: PASS.

## Assumptions

- The public API contract does not change: new claim is `201`, ready mapping is `200`, and fresh in-progress provisioning remains `409`.
- No schema change is needed because the existing unique constraint `(user_id, listing_id)` is the correct concurrency key.
- Do not introduce `service_role`, app-level locks, or external queueing; Postgres handles the race at the data layer.
