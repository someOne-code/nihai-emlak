import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const PACKAGE_JSON_PATH = path.resolve(process.cwd(), "package.json");
const BASELINE_LINUX_SCRIPT_PATH = path.resolve(
  process.cwd(),
  ".codex/scripts/test-payment-callback-security-linux.sh",
);

test("node baseline script remains wired through npm test", async () => {
  const packageJsonRaw = await readFile(PACKAGE_JSON_PATH, "utf8");
  const packageJson = JSON.parse(packageJsonRaw) as {
    scripts?: Record<string, string>;
  };

  assert.equal(
    packageJson.scripts?.test,
    "npm run test:payment-callback-security && npm run typecheck && npm run lint",
  );
  assert.equal(
    packageJson.scripts?.["test:payment-callback-security"],
    "bash .codex/scripts/test-payment-callback-security.sh",
  );
});

test("node baseline script includes read-model and supabase proxy regression tests", async () => {
  const baselineScript = await readFile(BASELINE_LINUX_SCRIPT_PATH, "utf8");

  assert.match(baselineScript, /\btests\/read-model-route\.test\.mts\b/);
  assert.match(baselineScript, /\btests\/read-model-contract-doc\.test\.mts\b/);
  assert.match(baselineScript, /\btests\/supabase-proxy\.test\.mts\b/);
});
