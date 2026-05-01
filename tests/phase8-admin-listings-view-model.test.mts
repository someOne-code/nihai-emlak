import assert from "node:assert/strict";
import test from "node:test";

// Phase 8.0: failing skeleton for the admin listing config UI view-model
// contract.
//
// Phase 8.5 wires `/admin/listings` to typed client + controller +
// view-model helpers. Until those helpers exist, the dynamic imports
// here throw ERR_MODULE_NOT_FOUND, which is the right-reason failure
// mode for a Phase 8.0 TDD skeleton.
//
// Once Phase 8.5 lands, this file MUST be replaced with real
// view-model assertions (selected listing state, image panel state,
// pricing config panel state, admin access state, no raw debug data
// leaking into UI state) per docs/ADMIN_LISTING_CONFIG_CONTRACT.md.

type DynamicImporter = (specifier: string) => Promise<unknown>;

const dynamicImport: DynamicImporter = async (specifier) => {
  return await import(specifier);
};

async function expectModuleResolves(specifier: string, label: string): Promise<void> {
  await assert.doesNotReject(
    () => dynamicImport(specifier),
    new RegExp("ERR_MODULE_NOT_FOUND"),
    `${label}: module ${specifier} must be implemented before this test can pass`,
  );
}

test("phase 8.5 admin listings view-model module exists", async () => {
  await expectModuleResolves(
    "../lib/admin-ui/listings-view-model.ts",
    "Phase 8.5 admin listings view-model",
  );
});

test("phase 8.5 admin listings client module exists", async () => {
  await expectModuleResolves(
    "../lib/admin-ui/listings-client.ts",
    "Phase 8.5 admin listings client",
  );
});

test("phase 8.5 admin listings controller module exists", async () => {
  await expectModuleResolves(
    "../lib/admin-ui/listings-controller.ts",
    "Phase 8.5 admin listings controller",
  );
});
