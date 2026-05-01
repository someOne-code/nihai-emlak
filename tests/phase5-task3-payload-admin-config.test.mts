import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function setupTestEnv(t: { after: (fn: () => void) => void }): void {
  const previousEnv = {
    DATABASE_URI: process.env.DATABASE_URI,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NODE_ENV: process.env.NODE_ENV,
    PAYLOAD_SECRET: process.env.PAYLOAD_SECRET,
    SITE_URL: process.env.SITE_URL,
    VERCEL_URL: process.env.VERCEL_URL,
  };

  process.env.NODE_ENV = "test";
  delete process.env.DATABASE_URI;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.PAYLOAD_SECRET;
  delete process.env.SITE_URL;
  delete process.env.VERCEL_URL;

  t.after(() => {
    restoreEnv("DATABASE_URI", previousEnv.DATABASE_URI);
    restoreEnv("NEXT_PUBLIC_SITE_URL", previousEnv.NEXT_PUBLIC_SITE_URL);
    restoreEnv("NODE_ENV", previousEnv.NODE_ENV);
    restoreEnv("PAYLOAD_SECRET", previousEnv.PAYLOAD_SECRET);
    restoreEnv("SITE_URL", previousEnv.SITE_URL);
    restoreEnv("VERCEL_URL", previousEnv.VERCEL_URL);
  });
}

test("task 3 keeps Payload admin on the CMS route without operations custom views", async (t) => {
  setupTestEnv(t);

  const payloadConfigModule = await import("../payload.config.ts");
  const config = await payloadConfigModule.default;

  assert.equal(config.admin.importMap.baseDir.endsWith("nihaiEmlak_windows_canonical"), true);
  assert.equal(config.routes.admin, "/cms");
  assert.equal(config.admin.components?.views?.operations, undefined);
  assert.deepEqual(config.admin.components?.afterNavLinks ?? [], []);
});

test("task 3 import map does not register operations components in Payload Admin", () => {
  const importMapPath = resolve(import.meta.dirname, "..", "app", "(payload)", "cms", "importMap.ts");
  const importMapSource = readFileSync(importMapPath, "utf-8");

  assert.doesNotMatch(importMapSource, /OperationsView/);
  assert.doesNotMatch(importMapSource, /OperationsNavLink/);
  assert.doesNotMatch(importMapSource, /\.\/payload\/admin\/OperationsView\.tsx#default/);
  assert.doesNotMatch(importMapSource, /\.\/payload\/admin\/OperationsNavLink\.tsx#default/);
});

test("task 3 separates Payload CMS routing from Supabase operations routing", () => {
  const appRootLayoutPath = resolve(import.meta.dirname, "..", "app", "layout.tsx");
  const payloadAdminPagePath = resolve(
    import.meta.dirname,
    "..",
    "app",
    "(payload)",
    "admin",
    "[[...segments]]",
    "page.tsx",
  );
  const payloadCmsPagePath = resolve(
    import.meta.dirname,
    "..",
    "app",
    "(payload)",
    "cms",
    "[[...segments]]",
    "page.tsx",
  );
  const operationsPagePath = resolve(
    import.meta.dirname,
    "..",
    "app",
    "(site)",
    "admin",
    "operations",
    "page.tsx",
  );
  const siteRootLayoutPath = resolve(import.meta.dirname, "..", "app", "(site)", "layout.tsx");
  const payloadRootLayoutPath = resolve(import.meta.dirname, "..", "app", "(payload)", "layout.tsx");
  const payloadAdminImportMapPath = resolve(
    import.meta.dirname,
    "..",
    "app",
    "(payload)",
    "admin",
    "importMap.ts",
  );
  const payloadOperationsViewPath = resolve(
    import.meta.dirname,
    "..",
    "payload",
    "admin",
    "OperationsView.tsx",
  );
  const payloadOperationsNavPath = resolve(
    import.meta.dirname,
    "..",
    "payload",
    "admin",
    "OperationsNavLink.tsx",
  );

  assert.equal(
    existsSync(appRootLayoutPath),
    false,
    "app/layout.tsx would wrap Payload RootLayout and render nested html/body tags",
  );
  assert.equal(existsSync(siteRootLayoutPath), true);
  assert.equal(existsSync(payloadAdminPagePath), false);
  assert.equal(existsSync(payloadAdminImportMapPath), false);
  assert.equal(existsSync(payloadOperationsViewPath), false);
  assert.equal(existsSync(payloadOperationsNavPath), false);
  assert.equal(existsSync(payloadCmsPagePath), true);
  assert.equal(existsSync(operationsPagePath), true);

  const siteLayoutSource = readFileSync(siteRootLayoutPath, "utf-8");
  const payloadLayoutSource = readFileSync(payloadRootLayoutPath, "utf-8");
  const operationsPageSource = readFileSync(operationsPagePath, "utf-8");

  assert.match(siteLayoutSource, /<html lang="tr"/);
  assert.match(payloadLayoutSource, /<RootLayout/);
  assert.match(operationsPageSource, /requireOperationsAdminAccess/);
  assert.match(operationsPageSource, /OperationsView/);
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
