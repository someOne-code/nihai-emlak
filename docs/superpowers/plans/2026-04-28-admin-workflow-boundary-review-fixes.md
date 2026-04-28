# Admin Workflow Boundary Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the admin workflow boundary review findings around optional JSON bodies and private admin origin enforcement.

**Architecture:** Keep Supabase/RPC as the authoritative state transition layer. Next.js route helpers remain a thin boundary for content type, origin, body parsing, auth, role lookup, and error mapping. The fix stays in route/helper code and route tests; no schema or RPC migration is required.

**Tech Stack:** Next.js 16 route handlers, TypeScript, Node test runner, Supabase SSR mocks, npm.

---

## Context Read

Files read before planning:

- `AGENTS.md`
- `README.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/PHASE_3_TASKS.md`
- `docs/SUPABASE_CAPABILITY_AUDIT.md`
- `docs/CHECKOUT_CONTRACT.md`
- `docs/BACKEND_PHASE_1.md`
- `docs/PHASE_1_2_TASKS.md`
- `docs/READ_MODEL_CONTRACT.md`
- `docs/WORKSPACE_HEALTH_CHECKLIST.md`
- `docs/CLOUDFLARE_SECURITY_TODO.md`
- `docs/PROJECT_PLAN.md`
- `docs/security_best_practices_report.md`
- `docs/security_best_practices_report_2026-04-18.md`
- `docs/security_best_practices_report_2026-04-21.md`

Relevant decisions:

- State-changing cookie-auth POST routes require JSON content type and trusted origin checks.
- Admin workflow state transitions must go through explicit admin workflow RPCs.
- Application route code should stay thin; detailed state and data ownership rules stay in DB/RPC/RLS.
- Production origin configuration must fail closed.
- Public checkout create/init may trust the public site origin; admin workflow mutation origin should require the private admin origin.

## Similar Finding Scan

Search targets:

- `readStateChangingJsonRequestPayload`
- `validateStateChangingJsonRequestEnvelope`
- `strategy: "first-configured"`
- `request.json`, `arrayBuffer`, `getReader`
- state-changing `POST` handlers

Findings:

- `lib/http/state-changing-json-route.ts` is shared by checkout create, checkout init, and admin workflow routes.
- Empty body is only a real behavior bug for `handleAdminConfirmReservationPost`, because confirm accepts optional `note`. Checkout create, checkout init, cancel, and reopen all require body fields.
- `strategy: "first-configured"` appears only in `lib/admin/workflow-route.ts`, so the private-origin fail-closed issue is limited to admin workflow `cancel`, `confirm`, and `reopen`.
- Checkout create and checkout init intentionally accept `NEXT_PUBLIC_SITE_URL` as a production trusted origin per `docs/CHECKOUT_CONTRACT.md`; do not change those flows in this fix.
- Admin read and snapshot routes are `GET`; they are not same-class state-changing JSON POST surfaces for this review finding.

## Files

Modify:

- `lib/http/state-changing-json-route.ts`
- `lib/admin/workflow-route.ts`
- `tests/admin-workflow-route.test.mts`

Do not modify:

- Supabase migrations
- checkout create/init behavior
- payment callback behavior
- Payload access control
- unrelated dirty files currently present in the worktree

## Task 1: Add Failing Tests For Optional Empty Confirm Body

**Files:**

- Modify: `tests/admin-workflow-route.test.mts`

- [ ] **Step 1: Add a helper for JSON requests without a body**

Add this helper near `createJsonRequest`:

```ts
function createJsonRequestWithoutBody(origin: string | null = "http://localhost:3000"): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (origin !== null) {
    headers.origin = origin;
  }

  return new Request("http://localhost:3000/api/admin/workflows/test", {
    method: "POST",
    headers,
  });
}
```

- [ ] **Step 2: Add the failing confirm test**

Add this test after the existing blank-note confirm test:

```ts
test("admin confirm route treats an empty JSON body as an empty object", async (t) => {
  setupAdminWorkflowEnv(t);

  const calls: Array<{ functionName: string; args: Record<string, unknown> }> = [];
  const response = await handleAdminConfirmReservationPost(
    createJsonRequestWithoutBody(),
    createDependencies({
      rpc: (functionName, args) => {
        calls.push({ functionName, args });
        return {
          data: {
            result: "confirmed",
            event_id: "99999999-9999-4999-8999-999999999999",
            reservation_id: "11111111-1111-4111-8111-111111111111",
            order_id: "33333333-3333-4333-8333-333333333333",
            payment_id: "44444444-4444-4444-8444-444444444444",
            listing_id: "55555555-5555-4555-8555-555555555555",
            reservation_status: "confirmed",
            order_status: "completed",
            payment_status: "succeeded",
            listing_status: "passive",
          },
          error: null,
        };
      },
    }),
    { reservationId: "11111111-1111-4111-8111-111111111111" },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [
    {
      functionName: "admin_confirm_reservation",
      args: {
        p_reservation_id: "11111111-1111-4111-8111-111111111111",
        p_note: null,
      },
    },
  ]);
});
```

- [ ] **Step 3: Prove the test fails**

Run:

```powershell
node --experimental-strip-types --experimental-specifier-resolution=node --test tests/admin-workflow-route.test.mts
```

Expected before implementation:

```text
not ok ... admin confirm route treats an empty JSON body as an empty object
```

Failure reason should show status `400` or `Invalid JSON request body`.

## Task 2: Implement Optional Empty Body Parsing Only For Admin Confirm

**Files:**

- Modify: `lib/http/state-changing-json-route.ts`
- Modify: `lib/admin/workflow-route.ts`

- [ ] **Step 1: Extend the shared body reader with an explicit option**

Change the exported result type area in `lib/http/state-changing-json-route.ts` to include options:

```ts
export type ReadStateChangingJsonRequestPayloadOptions = {
  emptyBodyValue?: unknown;
};
```

Change the function signature:

```ts
export async function readStateChangingJsonRequestPayload(
  request: Request,
  config: StateChangingJsonRouteConfig,
  options: ReadStateChangingJsonRequestPayloadOptions = {},
): Promise<StateChangingJsonRouteResult<unknown>> {
```

Add this branch before `JSON.parse`:

```ts
  if (rawBodyResult.value.trim().length === 0 && "emptyBodyValue" in options) {
    return {
      ok: true,
      value: options.emptyBodyValue,
    };
  }
```

Rationale:

- The default remains strict, so checkout create/init, cancel, and reopen still reject empty bodies.
- Only callers that opt in get empty body normalization.

- [ ] **Step 2: Opt in only from `parseAdminNoteOnlyBody`**

Change the call in `lib/admin/workflow-route.ts`:

```ts
  const payloadResult = await readStateChangingJsonRequestPayload(
    request,
    ADMIN_WORKFLOW_JSON_ROUTE_CONFIG,
    { emptyBodyValue: {} },
  );
```

Do not change `parseAdminReasonBody`.

- [ ] **Step 3: Verify narrow test passes**

Run:

```powershell
node --experimental-strip-types --experimental-specifier-resolution=node --test tests/admin-workflow-route.test.mts
```

Expected:

```text
# pass
```

## Task 3: Add Failing Tests For Private Admin Origin Enforcement

**Files:**

- Modify: `tests/admin-workflow-route.test.mts`

- [ ] **Step 1: Add a production fallback rejection test**

Add this test after the existing private/public origin test:

```ts
test("admin workflow route fails closed when private SITE_URL is missing in production", async (t) => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousSiteUrl = process.env.SITE_URL;
  const previousPublicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const previousVercelUrl = process.env.VERCEL_URL;

  process.env.NODE_ENV = "production";
  delete process.env.SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.example.com";
  delete process.env.VERCEL_URL;

  t.after(() => {
    restoreEnv("NODE_ENV", previousNodeEnv);
    restoreEnv("SITE_URL", previousSiteUrl);
    restoreEnv("NEXT_PUBLIC_SITE_URL", previousPublicSiteUrl);
    restoreEnv("VERCEL_URL", previousVercelUrl);
  });

  const response = await handleAdminCancelReservationPost(
    createJsonRequest(
      { reason: "customer_withdrew" },
      "https://www.example.com",
    ),
    createFailingDependencies(),
    { reservationId: "11111111-1111-4111-8111-111111111111" },
  );

  assert.equal(response.status, 500);
  assert.equal(
    (await response.json()).error,
    "Admin workflow private SITE_URL must be configured outside development/test",
  );
});
```

- [ ] **Step 2: Add a dev/test fallback preservation test**

Add this test after the production fallback rejection test:

```ts
test("admin workflow route keeps localhost fallback in test when admin origin is unset", async (t) => {
  setupAdminWorkflowEnv(t);

  const response = await handleAdminCancelReservationPost(
    createJsonRequest({ reason: "customer_withdrew" }),
    createDependencies({
      userId: null,
      getProfileRole: () => {
        throw new Error("profile lookup should not run without auth");
      },
      rpc: () => {
        throw new Error("rpc should not run without auth");
      },
    }),
    { reservationId: "11111111-1111-4111-8111-111111111111" },
  );

  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "Authentication required");
});
```

- [ ] **Step 3: Prove the production test fails**

Run:

```powershell
node --experimental-strip-types --experimental-specifier-resolution=node --test tests/admin-workflow-route.test.mts
```

Expected before implementation:

```text
not ok ... admin workflow route fails closed when private SITE_URL is missing in production
```

Failure reason should show request proceeding to auth or returning `401`.

## Task 4: Implement Admin-Only Private Origin Strategy

**Files:**

- Modify: `lib/http/state-changing-json-route.ts`
- Modify: `lib/admin/workflow-route.ts`

- [ ] **Step 1: Add a private admin strategy to the shared origin resolver**

Change the strategy type:

```ts
export type TrustedOriginsStrategy = "all-configured" | "first-configured" | "private-site-url";
```

Add an optional error field:

```ts
export type ResolveTrustedOriginsFromEnvironmentOptions = {
  invalidConfigError: string;
  missingPrivateSiteUrlError?: string;
  strategy?: TrustedOriginsStrategy;
};
```

Update `resolveConfiguredOrigins` to support the new strategy:

```ts
function resolveConfiguredOrigins(input: {
  isDevOrTest: boolean;
  strategy: TrustedOriginsStrategy;
}): string[] {
  if (input.strategy === "private-site-url") {
    const privateSiteUrl = asNonEmptyString(process.env.SITE_URL);
    if (privateSiteUrl) {
      return [privateSiteUrl];
    }

    return input.isDevOrTest ? [] : [];
  }

  const configuredOrigins = [
    asNonEmptyString(process.env.SITE_URL),
    asNonEmptyString(process.env.NEXT_PUBLIC_SITE_URL),
    ...(input.isDevOrTest ? [normalizeVercelUrl(process.env.VERCEL_URL)] : []),
  ].filter((value): value is string => value !== null);

  if (input.strategy === "first-configured") {
    return configuredOrigins.length > 0 ? [configuredOrigins[0]] : [];
  }

  return configuredOrigins;
}
```

Then adjust the empty configured origin branch in `resolveTrustedOriginsFromEnvironment`:

```ts
  if (configuredOrigins.length === 0) {
    if (!isDevOrTest) {
      return {
        ok: false,
        status: 500,
        error: options.strategy === "private-site-url"
          ? options.missingPrivateSiteUrlError ?? options.invalidConfigError
          : "SITE_URL or NEXT_PUBLIC_SITE_URL must be configured outside development/test",
      };
    }

    return {
      ok: true,
      origins: ["http://localhost:3000"],
    };
  }
```

Rationale:

- Admin mutation routes require `SITE_URL` in production.
- Development/test still use `http://localhost:3000` fallback for local tests.
- Public checkout routes keep the existing all-configured behavior.

- [ ] **Step 2: Use the private strategy in admin workflow routes**

Change `validateAdminWorkflowRequestEnvelope` in `lib/admin/workflow-route.ts`:

```ts
  return validateStateChangingJsonRequestEnvelope(request, config, {
    invalidConfigError: "Admin workflow trusted origin configuration is invalid",
    missingPrivateSiteUrlError: "Admin workflow private SITE_URL must be configured outside development/test",
    strategy: "private-site-url",
  });
```

- [ ] **Step 3: Confirm checkout route behavior remains unchanged**

Do not pass the new strategy from:

- `lib/payments/checkout-create-route.ts`
- `lib/payments/checkout-init-route.ts`

Those should keep using public site origin config per `docs/CHECKOUT_CONTRACT.md`.

- [ ] **Step 4: Verify narrow tests pass**

Run:

```powershell
node --experimental-strip-types --experimental-specifier-resolution=node --test tests/admin-workflow-route.test.mts
```

Expected:

```text
# pass
```

## Task 5: Regression Check The Other State-Changing JSON Routes

**Files:**

- Test only; no production code unless a regression appears.

- [ ] **Step 1: Run checkout create route tests**

Run:

```powershell
node --experimental-strip-types --experimental-specifier-resolution=node --test tests/checkout-create-route.test.mts
```

Expected:

```text
# pass
```

- [ ] **Step 2: Run checkout init route tests**

Run:

```powershell
node --experimental-strip-types --experimental-specifier-resolution=node --test tests/checkout-init-route.test.mts
```

Expected:

```text
# pass
```

- [ ] **Step 3: Confirm empty body remains invalid where body is required**

If either suite fails because an empty body is now accepted by checkout create/init, revert the default behavior and ensure only `parseAdminNoteOnlyBody` passes `{ emptyBodyValue: {} }`.

## Task 6: Focused Baseline

**Files:**

- No additional edits expected.

- [ ] **Step 1: Run the route/security baseline**

Run:

```powershell
npm run test:payment-callback-security
```

Expected:

```text
all included node tests pass
```

- [ ] **Step 2: Run TypeScript and lint baseline through repo test**

Run:

```powershell
npm test
```

Expected:

```text
npm run test:payment-callback-security
npm run typecheck
npm run lint
```

All commands pass.

- [ ] **Step 3: Decide whether DB security is needed**

Do not run DB security by default for this fix, because no SQL/RLS/RPC migration changes are planned. Run it only if implementation unexpectedly touches `supabase/migrations/**` or `tests/sql/**`:

```powershell
npm run test:db-security
```

Expected if run:

```text
SQL security suite passes
```

## Task 7: Documentation Check

**Files:**

- Modify only if behavior docs become inaccurate.

- [ ] **Step 1: Check `docs/CHECKOUT_CONTRACT.md`**

No change expected for checkout create/init, because public checkout routes still trust `SITE_URL` and/or `NEXT_PUBLIC_SITE_URL`.

- [ ] **Step 2: Check admin workflow docs/plans**

If an admin workflow contract document exists by implementation time, update it to say:

```text
Production admin workflow mutation routes require SITE_URL as the private admin origin. NEXT_PUBLIC_SITE_URL is not used as a fallback for admin workflow mutations.
```

If no such contract document exists, do not create one for this narrow fix.

## Review Checklist

- Empty body accepted only for confirm note-only body.
- Empty body still rejected for checkout create, checkout init, cancel, and reopen.
- Production admin workflow origin requires `SITE_URL`.
- Production `NEXT_PUBLIC_SITE_URL` alone no longer authorizes admin workflow mutation origins.
- Development/test localhost fallback remains for admin workflow tests.
- Checkout public/user origin behavior remains unchanged.
- No Supabase migration or DB authorization behavior changed.
