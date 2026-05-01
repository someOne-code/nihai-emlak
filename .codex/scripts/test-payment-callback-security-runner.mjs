import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TEST_FILES = [
  "tests/payment-callback-security.test.mts",
  "tests/checkout-init-route-helper.test.mts",
  "tests/checkout-init-route.test.mts",
  "tests/checkout-create-validator.test.mts",
  "tests/checkout-create-route.test.mts",
  "tests/admin-workflow-route.test.mts",
  "tests/read-model-route.test.mts",
  "tests/read-model-contract-doc.test.mts",
  "tests/supabase-proxy.test.mts",
  "tests/node-baseline-contract.test.mts",
  "tests/payment-callback-route.test.mts",
  "tests/csp-policy.test.mts",
  "tests/payload-security.test.mts",
];

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const result = spawnSync(
  process.execPath,
  [
    "--experimental-strip-types",
    "--experimental-specifier-resolution=node",
    "--test",
    ...TEST_FILES,
  ],
  {
    cwd: repoRoot,
    stdio: "inherit",
    windowsHide: true,
  },
);

if (result.error) {
  console.error(`node could not start: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
