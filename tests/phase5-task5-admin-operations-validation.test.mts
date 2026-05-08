import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const projectRoot = resolve(import.meta.dirname, "..");

test("task 5 keeps Phase 5 admin operations validation commands documented", () => {
  const plan = readFileSync(
    resolve(projectRoot, "docs", "superpowers", "plans", "2026-04-28-phase5-admin-ui-implementation.md"),
    "utf-8",
  );

  assert.match(plan, /tests\/admin-operations-client\.test\.mts/);
  assert.match(plan, /tests\/admin-operations-view-model\.test\.mts/);
  assert.match(plan, /tests\/payload-admin-operations-config\.test\.mts|tests\/phase5-task3-payload-admin-config\.test\.mts/);
  assert.match(plan, /tests\/admin-workflow-snapshot-route\.test\.mts/);
  assert.match(plan, /npm\.cmd run typecheck/);
  assert.match(plan, /npm\.cmd run lint/);
  assert.match(plan, /npm\.cmd test/);
  assert.match(plan, /npm\.cmd run build/);
});

test("task 5 keeps generated Payload artifacts out of the Phase 5 commit scope", () => {
  const payloadConfig = readFileSync(resolve(projectRoot, "payload.config.ts"), "utf-8");

  assert.match(payloadConfig, /typescript:\s*\{[\s\S]*?autoGenerate:\s*false/);
  assert.equal(existsSync(resolve(projectRoot, "app", "(payload)", "admin", "importMap.js")), false);
  assert.equal(existsSync(resolve(projectRoot, "payload-types.ts")), false);
});

test("task 5 keeps package-level validation scripts available", () => {
  const packageJson = JSON.parse(readFileSync(resolve(projectRoot, "package.json"), "utf-8")) as {
    scripts?: Record<string, string>;
  };

  assert.equal(packageJson.scripts?.typecheck, "tsc --noEmit");
  assert.equal(packageJson.scripts?.lint, "eslint .");
  assert.equal(packageJson.scripts?.test, "npm run test:payment-callback-security && npm run test:phase8-admin-listings && npm run test:admin-dashboard && npm run test:admin-users && npm run test:phase9a-content && npm run test:phase9b-catalog && npm run test:admin-operations && npm run typecheck && npm run lint");
  assert.equal(packageJson.scripts?.["test:db-security"], "node .codex/scripts/test-db-security-runner.mjs");
  assert.equal(packageJson.scripts?.build, "next build");
});
