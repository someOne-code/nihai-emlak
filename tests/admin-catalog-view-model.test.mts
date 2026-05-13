import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildAdminCatalogMainItemRow,
  buildAdminCatalogServiceRow,
  upsertAdminCatalogMainItemRow,
  upsertAdminCatalogServiceRow,
} from "../lib/admin-ui/catalog-view-model.ts";

// ---------------------------------------------------------------------------
// Main item catalog view-model
// ---------------------------------------------------------------------------

test("catalog view-model: main item row maps all known fields", () => {
  const row = buildAdminCatalogMainItemRow({
    id: "1",
    code: "kira",
    label: "Kira",
    description: "Aylık kira bedeli",
    pricing_strategy: "fixed",
    default_amount: 12000,
    default_multiplier: null,
    is_active: true,
    sort_order: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  });

  assert.equal(row.id, "1");
  assert.equal(row.code, "kira");
  assert.equal(row.label, "Kira");
  assert.equal(row.description, "Aylık kira bedeli");
  assert.equal(row.pricingStrategy, "fixed");
  assert.equal(row.defaultAmount, 12000);
  assert.equal(row.defaultMultiplier, null);
  assert.equal(row.isActive, true);
  assert.equal(row.sortOrder, 0);
});

test("catalog view-model: main item pricingStrategyLabel maps DB codes to Turkish copy", () => {
  const fixedRow = buildAdminCatalogMainItemRow({
    id: "1",
    code: "k",
    label: "K",
    is_active: true,
    pricing_strategy: "fixed",
  });
  const listingMult = buildAdminCatalogMainItemRow({
    id: "2",
    code: "k2",
    label: "K2",
    is_active: true,
    pricing_strategy: "listing_price_multiplier",
  });
  const stayMult = buildAdminCatalogMainItemRow({
    id: "3",
    code: "k3",
    label: "K3",
    is_active: true,
    pricing_strategy: "stay_months_multiplier",
  });
  const unknown = buildAdminCatalogMainItemRow({
    id: "4",
    code: "k4",
    label: "K4",
    is_active: true,
    pricing_strategy: "mystery_code",
  });

  assert.equal(fixedRow.pricingStrategyLabel, "Sabit tutar");
  assert.equal(listingMult.pricingStrategyLabel, "İlan fiyatına oranlı");
  assert.equal(stayMult.pricingStrategyLabel, "Aylık (süreye bağlı)");
  // Unknown codes should fall back to the raw code so admins can still debug.
  assert.equal(unknown.pricingStrategyLabel, "mystery_code");
});

test("catalog view-model: pricingStrategyRequires reports required fields per strategy", async () => {
  const { pricingStrategyRequires } = await import(
    "../lib/admin-ui/catalog-view-model.ts"
  );

  assert.deepEqual(pricingStrategyRequires("fixed"), {
    amount: true,
    multiplier: false,
  });
  assert.deepEqual(pricingStrategyRequires("listing_price_multiplier"), {
    amount: false,
    multiplier: true,
  });
  assert.deepEqual(pricingStrategyRequires("stay_months_multiplier"), {
    amount: false,
    multiplier: true,
  });
  // Unknown strategy: conservative default — show both so admin can decide.
  assert.deepEqual(pricingStrategyRequires("mystery"), {
    amount: true,
    multiplier: true,
  });
});

test("catalog view-model: main item statusLabel uses Turkish", () => {
  const active = buildAdminCatalogMainItemRow({ id: "1", code: "k", label: "K", is_active: true });
  const passive = buildAdminCatalogMainItemRow({ id: "2", code: "k2", label: "K2", is_active: false });

  assert.equal(active.statusLabel, "Aktif");
  assert.equal(passive.statusLabel, "Pasif");
});

test("catalog view-model: main item does not contain 'override' anywhere", () => {
  const row = buildAdminCatalogMainItemRow({ id: "1", code: "k", label: "K", is_active: true });
  const serialized = JSON.stringify(row);

  assert.ok(
    !serialized.toLowerCase().includes("override"),
    "catalog main item row must not contain 'override' text",
  );
});

test("catalog view-model: main item defaultAmountLabel uses admin-friendly copy", () => {
  const row = buildAdminCatalogMainItemRow({
    id: "1",
    code: "k",
    label: "K",
    is_active: true,
    default_amount: 5000,
  });

  assert.ok(
    row.defaultAmountLabel.includes("5000"),
    "defaultAmountLabel must include the value",
  );
  assert.ok(
    !row.defaultAmountLabel.toLowerCase().includes("override"),
    "defaultAmountLabel must not say override",
  );
});

test("catalog view-model: main item row never leaks unknown fields", () => {
  const row = buildAdminCatalogMainItemRow({
    id: "1",
    code: "k",
    label: "K",
    is_active: true,
    internal_secret: "leak",
    __debug: "leak",
  } as Record<string, unknown>);

  const serialized = JSON.stringify(row);
  assert.ok(!serialized.includes("leak"), "view-model must drop unknown raw fields");
});

test("catalog view-model: main item mutation snapshot replaces existing row", () => {
  const rows = [
    buildAdminCatalogMainItemRow({
      id: "1",
      code: "kira",
      label: "Kira",
      pricing_strategy: "fixed",
      default_amount: 12000,
      is_active: true,
      sort_order: 10,
      updated_at: "2026-01-01T00:00:00Z",
    }),
  ];

  const next = upsertAdminCatalogMainItemRow(rows, {
    id: "1",
    code: "kira",
    label: "Guncel Kira",
    pricing_strategy: "fixed",
    default_amount: 14000,
    is_active: false,
    sort_order: 10,
    updated_at: "2026-05-13T10:00:00Z",
  });

  assert.equal(next.length, 1);
  assert.equal(next[0].label, "Guncel Kira");
  assert.equal(next[0].defaultAmount, 14000);
  assert.equal(next[0].statusLabel, "Pasif");
  assert.equal(next[0].updatedAt, "2026-05-13T10:00:00Z");
});

test("catalog view-model: main item mutation snapshot inserts and sorts new row", () => {
  const rows = [
    buildAdminCatalogMainItemRow({
      id: "2",
      code: "komisyon",
      label: "Komisyon",
      pricing_strategy: "fixed",
      is_active: true,
      sort_order: 20,
    }),
  ];

  const next = upsertAdminCatalogMainItemRow(rows, {
    id: "1",
    code: "depozito",
    label: "Depozito",
    pricing_strategy: "fixed",
    is_active: true,
    sort_order: 5,
  });

  assert.deepEqual(
    next.map((row) => row.code),
    ["depozito", "komisyon"],
  );
});

// ---------------------------------------------------------------------------
// Service catalog view-model
// ---------------------------------------------------------------------------

test("catalog view-model: service row maps all known fields", () => {
  const row = buildAdminCatalogServiceRow({
    id: "2",
    code: "temizlik",
    name: "Temizlik",
    description: "Ev temizliği",
    base_price: 500,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  });

  assert.equal(row.id, "2");
  assert.equal(row.code, "temizlik");
  assert.equal(row.name, "Temizlik");
  assert.equal(row.description, "Ev temizliği");
  assert.equal(row.basePrice, 500);
  assert.equal(row.isActive, true);
});

test("catalog view-model: service statusLabel uses Turkish", () => {
  const active = buildAdminCatalogServiceRow({ id: "1", code: "s", name: "S", is_active: true });
  const passive = buildAdminCatalogServiceRow({ id: "2", code: "s2", name: "S2", is_active: false });

  assert.equal(active.statusLabel, "Aktif");
  assert.equal(passive.statusLabel, "Pasif");
});

test("catalog view-model: service does not contain 'override' anywhere", () => {
  const row = buildAdminCatalogServiceRow({ id: "1", code: "s", name: "S", is_active: true });
  const serialized = JSON.stringify(row);

  assert.ok(
    !serialized.toLowerCase().includes("override"),
    "catalog service row must not contain 'override' text",
  );
});

test("catalog view-model: service basePriceLabel uses admin-friendly copy", () => {
  const row = buildAdminCatalogServiceRow({
    id: "1",
    code: "s",
    name: "S",
    is_active: true,
    base_price: 750,
  });

  assert.ok(row.basePriceLabel.includes("750"));
  assert.ok(!row.basePriceLabel.toLowerCase().includes("override"));
});

test("catalog view-model: service row never leaks unknown fields", () => {
  const row = buildAdminCatalogServiceRow({
    id: "1",
    code: "s",
    name: "S",
    is_active: true,
    internal_note: "leak",
  } as Record<string, unknown>);

  const serialized = JSON.stringify(row);
  assert.ok(!serialized.includes("leak"), "view-model must drop unknown raw fields");
});

test("catalog view-model: service mutation snapshot replaces existing row", () => {
  const rows = [
    buildAdminCatalogServiceRow({
      id: "1",
      code: "temizlik",
      name: "Temizlik",
      base_price: 500,
      is_active: true,
      updated_at: "2026-01-01T00:00:00Z",
    }),
  ];

  const next = upsertAdminCatalogServiceRow(rows, {
    id: "1",
    code: "temizlik",
    name: "Detayli Temizlik",
    base_price: 650,
    is_active: false,
    updated_at: "2026-05-13T10:00:00Z",
  });

  assert.equal(next.length, 1);
  assert.equal(next[0].name, "Detayli Temizlik");
  assert.equal(next[0].basePrice, 650);
  assert.equal(next[0].statusLabel, "Pasif");
  assert.equal(next[0].updatedAt, "2026-05-13T10:00:00Z");
});

test("catalog view-model: service mutation snapshot inserts and sorts new row", () => {
  const rows = [
    buildAdminCatalogServiceRow({
      id: "2",
      code: "transfer",
      name: "Transfer",
      base_price: 900,
      is_active: true,
    }),
  ];

  const next = upsertAdminCatalogServiceRow(rows, {
    id: "1",
    code: "temizlik",
    name: "Temizlik",
    base_price: 500,
    is_active: true,
  });

  assert.deepEqual(
    next.map((row) => row.code),
    ["temizlik", "transfer"],
  );
});

test("catalog admin page applies mutation snapshots without reloading both tables", () => {
  const source = readFileSync(
    resolve(import.meta.dirname, "..", "components/admin-catalog/AdminCatalogView.tsx"),
    "utf-8",
  );

  assert.match(source, /upsertAdminCatalogMainItemRow/);
  assert.match(source, /upsertAdminCatalogServiceRow/);
  assert.match(source, /const item = await updateAdminCatalogMainItem/);
  assert.match(source, /item = await createAdminCatalogMainItem/);
  assert.match(source, /service = await updateAdminCatalogService/);
  assert.match(source, /service = await createAdminCatalogService/);
  assert.doesNotMatch(source, /await reload\(\);/);
});

test("catalog admin page ignores stale reload responses", () => {
  const source = readFileSync(
    resolve(import.meta.dirname, "..", "components/admin-catalog/AdminCatalogView.tsx"),
    "utf-8",
  );

  assert.match(
    source,
    /mountedRef = useRef\(true\)/,
    "Catalog reloads must avoid setting state after unmount.",
  );
  assert.match(
    source,
    /loadRequestSeqRef = useRef\(0\)/,
    "Catalog reloads must keep a monotonic request sequence.",
  );
  assert.match(
    source,
    /const requestSeq = loadRequestSeqRef\.current \+ 1;/,
    "Each catalog reload must capture its own request sequence.",
  );
  assert.match(
    source,
    /loadRequestSeqRef\.current !== requestSeq/,
    "Older catalog reload responses must be ignored before mutating state.",
  );
});

// ---------------------------------------------------------------------------
// Per-listing display: "override" word must not appear in labels
// ---------------------------------------------------------------------------

test("listings view-model: override labels must be replaced with admin-friendly copy", async () => {
  // We import the existing listings-view-model and check its display helper output.
  // These tests will FAIL until we fix the override labels.
  const { buildAdminListingMainItemDisplay, buildAdminListingServiceDisplay } = await import(
    "../lib/admin-ui/listings-view-model.ts"
  );

  const mainDisplay = buildAdminListingMainItemDisplay({
    id: "1",
    mainItemId: "m1",
    code: "kira",
    label: "Kira",
    pricingStrategy: "fixed",
    defaultAmount: 12000,
    defaultMultiplier: null,
    overrideLabel: null,
    overrideAmount: 1500,
    overrideMultiplier: null,
    isEnabled: true,
    sortOrder: 0,
    catalogIsActive: true,
  });

  const serialized = JSON.stringify(mainDisplay);
  assert.ok(
    !serialized.toLowerCase().includes("override"),
    `Main item display must not contain 'override': ${serialized}`,
  );
  assert.ok(
    mainDisplay.customAmountLabel.includes("Bu ilana özel tutar"),
    `overrideAmountLabel must say 'Bu ilana özel tutar', got: ${mainDisplay.customAmountLabel}`,
  );
  assert.ok(
    mainDisplay.customMultiplierLabel.includes("Bu ilana özel çarpan"),
    `overrideMultiplierLabel must say 'Bu ilana özel çarpan', got: ${mainDisplay.customMultiplierLabel}`,
  );

  const serviceDisplay = buildAdminListingServiceDisplay({
    id: "2",
    serviceId: "s1",
    code: "temizlik",
    name: "Temizlik",
    basePrice: 500,
    overridePrice: 600,
    isEnabled: true,
    catalogIsActive: true,
  });

  const serviceSerialized = JSON.stringify(serviceDisplay);
  assert.ok(
    !serviceSerialized.toLowerCase().includes("override"),
    `Service display must not contain 'override': ${serviceSerialized}`,
  );
  assert.ok(
    serviceDisplay.customPriceLabel.includes("Bu ilana özel fiyat"),
    `overridePriceLabel must say 'Bu ilana özel fiyat', got: ${serviceDisplay.customPriceLabel}`,
  );
});

test("listings view-model: null custom value is represented as katalog fallback", async () => {
  const { buildAdminListingMainItemDisplay, buildAdminListingServiceDisplay } = await import(
    "../lib/admin-ui/listings-view-model.ts"
  );

  const mainDisplay = buildAdminListingMainItemDisplay({
    id: "1",
    mainItemId: "m1",
    code: "kira",
    label: "Kira",
    pricingStrategy: "fixed",
    defaultAmount: 12000,
    defaultMultiplier: null,
    overrideLabel: null,
    overrideAmount: null,
    overrideMultiplier: null,
    isEnabled: true,
    sortOrder: 0,
    catalogIsActive: true,
  });

  assert.ok(
    mainDisplay.customAmountLabel.includes("katalog varsayılanı"),
    `null overrideAmount must show katalog fallback, got: ${mainDisplay.customAmountLabel}`,
  );

  const serviceDisplay = buildAdminListingServiceDisplay({
    id: "2",
    serviceId: "s1",
    code: "temizlik",
    name: "Temizlik",
    basePrice: 500,
    overridePrice: null,
    isEnabled: true,
    catalogIsActive: true,
  });

  assert.ok(
    serviceDisplay.customPriceLabel.includes("katalog varsayılanı"),
    `null overridePrice must show katalog fallback, got: ${serviceDisplay.customPriceLabel}`,
  );
});
