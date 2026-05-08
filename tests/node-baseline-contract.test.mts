import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const PACKAGE_JSON_PATH = path.resolve(process.cwd(), "package.json");
const BASELINE_RUNNER_PATH = path.resolve(
  process.cwd(),
  ".codex/scripts/test-payment-callback-security-runner.mjs",
);

test("node baseline script remains wired through npm test", async () => {
  const packageJsonRaw = await readFile(PACKAGE_JSON_PATH, "utf8");
  const packageJson = JSON.parse(packageJsonRaw) as {
    scripts?: Record<string, string>;
  };

  assert.equal(
    packageJson.scripts?.test,
    "npm run test:payment-callback-security && npm run test:phase8-admin-listings && npm run test:admin-dashboard && npm run test:admin-users && npm run test:phase9a-content && npm run test:phase9b-catalog && npm run test:admin-operations && npm run test:admin-communications && npm run test:admin-system && npm run test:sale-leads && npm run test:admin-backoffice-e2e:runner && npm run typecheck && npm run lint",
  );
  assert.equal(
    packageJson.scripts?.["test:admin-system"],
    "node --experimental-strip-types --test tests/admin-system-route.test.mts tests/admin-system-view-model.test.mts",
  );
  assert.equal(
    packageJson.scripts?.["test:chatwoot-live"],
    "node --env-file-if-exists=.env.local --experimental-strip-types --test tests/chatwoot-live-smoke.test.mts",
  );
  assert.match(
    packageJson.scripts?.["test:sale-leads"] ?? "",
    /tests\/sale-leads-create-route\.test\.mts/,
  );
  assert.equal(
    packageJson.scripts?.["test:payment-callback-security"],
    "node .codex/scripts/test-payment-callback-security-runner.mjs",
  );
});

test("node baseline script includes read-model and supabase proxy regression tests", async () => {
  const baselineScript = await readFile(BASELINE_RUNNER_PATH, "utf8");

  assert.match(baselineScript, /\btests\/read-model-route\.test\.mts\b/);
  assert.match(baselineScript, /\btests\/read-model-contract-doc\.test\.mts\b/);
  assert.match(baselineScript, /\btests\/supabase-proxy\.test\.mts\b/);
});
