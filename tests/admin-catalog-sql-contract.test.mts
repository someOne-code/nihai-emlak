import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminCatalogMigration = readMigration(
  "../supabase/migrations/20260503000000_36_phase9b_admin_catalog_rpcs.sql",
);
const duplicateHardeningMigration = readMigration(
  "../supabase/migrations/20260505210000_harden_main_item_catalog_duplicates.sql",
);
const combinedCatalogSql = `${adminCatalogMigration}\n${duplicateHardeningMigration}`;

const ADMIN_CATALOG_RPC_NAMES = [
  "admin_list_main_item_catalog",
  "admin_create_main_item_catalog",
  "admin_update_main_item_catalog",
  "admin_list_service_catalog",
  "admin_create_service_catalog",
  "admin_update_service_catalog",
] as const;

test("main item catalog duplicate hardening fails closed instead of deleting rows", () => {
  assert.doesNotMatch(
    duplicateHardeningMigration,
    /\bdelete\s+from\s+public\.main_item_catalog\b/i,
  );
  assert.match(duplicateHardeningMigration, /\braise\s+exception\b/i);
  assert.match(
    duplicateHardeningMigration,
    /create\s+unique\s+index\s+if\s+not\s+exists\s+main_item_catalog_active_label_unique/i,
  );
});

test("catalog hardening revokes direct authenticated write surfaces", () => {
  assert.match(
    duplicateHardeningMigration,
    /revoke\s+insert\s*,\s*update\s*,\s*delete\s+on\s+public\.main_item_catalog\s+from\s+authenticated/i,
  );
  assert.match(
    duplicateHardeningMigration,
    /revoke\s+insert\s*,\s*update\s*,\s*delete\s+on\s+public\.service_catalog\s+from\s+authenticated/i,
  );
  assert.match(
    duplicateHardeningMigration,
    /drop\s+policy\s+if\s+exists\s+main_item_catalog_admin_manage\s+on\s+public\.main_item_catalog/i,
  );
  assert.match(
    duplicateHardeningMigration,
    /drop\s+policy\s+if\s+exists\s+service_catalog_admin_manage\s+on\s+public\.service_catalog/i,
  );
});

test("admin catalog privileged implementations live in internal schema", () => {
  for (const functionName of ADMIN_CATALOG_RPC_NAMES) {
    assert.match(
      adminCatalogMigration,
      new RegExp(`create\\s+or\\s+replace\\s+function\\s+internal\\.${functionName}\\b`, "i"),
      `${functionName} must have an internal implementation`,
    );

    assert.doesNotMatch(
      combinedCatalogSql,
      new RegExp(
        [
          `create\\s+or\\s+replace\\s+function\\s+public\\.${functionName}\\b`,
          `(?:(?!as\\s+\\$\\$)[\\s\\S])*security\\s+definer`,
          `(?:(?!as\\s+\\$\\$)[\\s\\S])*set\\s+search_path\\s*=\\s*public`,
        ].join(""),
        "i",
      ),
      `${functionName} must not be a SECURITY DEFINER implementation in public with search_path=public`,
    );
  }
});

test("admin catalog public wrappers expose only authenticated RPC names", () => {
  for (const functionName of ADMIN_CATALOG_RPC_NAMES) {
    assert.match(
      adminCatalogMigration,
      new RegExp(
        [
          `create\\s+or\\s+replace\\s+function\\s+public\\.${functionName}\\b`,
          `[\\s\\S]*?as\\s+\\$\\$\\s*select\\s+internal\\.${functionName}\\(`,
        ].join(""),
        "i",
      ),
      `${functionName} public wrapper must only delegate to internal implementation`,
    );
    assert.match(
      adminCatalogMigration,
      new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${functionName}\\b`, "i"),
      `${functionName} must revoke default public execute`,
    );
    assert.match(
      adminCatalogMigration,
      new RegExp(`revoke\\s+execute\\s+on\\s+function\\s+public\\.${functionName}\\b[\\s\\S]*?from\\s+anon`, "i"),
      `${functionName} must revoke anon execute`,
    );
    assert.match(
      adminCatalogMigration,
      new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${functionName}\\b[\\s\\S]*?to\\s+authenticated`, "i"),
      `${functionName} must grant authenticated execute`,
    );
  }
});

function readMigration(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}
