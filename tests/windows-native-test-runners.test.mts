import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  buildSqlLogPath,
  resolveSupabaseDbContainerName,
} from "../.codex/scripts/test-db-security-runner.mjs";

test("db security runner prefers the exact Supabase DB container name", () => {
  const container = resolveSupabaseDbContainerName({
    repoRoot: "C:\\Users\\umut\\MetaGPT\\workspace\\nihaiEmlak_windows_canonical",
    names: [
      "supabase_db_other_project",
      "supabase_db_nihaiEmlak_windows_canonical",
    ],
  });

  assert.equal(container, "supabase_db_nihaiEmlak_windows_canonical");
});

test("db security runner falls back to the first Supabase DB container", () => {
  const container = resolveSupabaseDbContainerName({
    repoRoot: "C:\\repo\\missing_exact",
    names: ["redis", "supabase_db_available"],
  });

  assert.equal(container, "supabase_db_available");
});

test("db security runner writes SQL logs under repo-local .codex/logs", () => {
  const logPath = buildSqlLogPath({
    repoRoot: "C:\\repo\\project",
    sqlPath: "C:\\repo\\project\\tests\\sql\\phase8_admin_listing_config.sql",
  });

  assert.equal(
    logPath,
    path.join("C:\\repo\\project", ".codex", "logs", "phase8_admin_listing_config.sql.log"),
  );
});

test("npm test scripts do not require bash entrypoints", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
    scripts: Record<string, string>;
  };

  assert.match(packageJson.scripts["test:db-security"], /^node /);
  assert.match(packageJson.scripts["test:payment-callback-security"], /^node /);
  assert.match(packageJson.scripts["test:phase8-admin-listings"], /^node /);
  assert.doesNotMatch(packageJson.scripts.test, /\bbash\b/);
  assert.match(packageJson.scripts.test, /test:phase8-admin-listings/);
});
