import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAdminListingCheckoutReadinessDisplay,
  buildAdminListingMainItemDisplay,
  buildAdminListingServiceDisplay,
  buildAdminListingsViewModel,
  getAvailableMainItemAddCandidates,
  getAvailableServiceAddCandidates,
  type AdminListingDetail,
  type AdminListingMainItem,
  type AdminListingService,
} from "../lib/admin-ui/listings-view-model.ts";

const LISTING_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SECOND_LISTING_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function createList() {
  return {
    items: [
      {
        id: LISTING_ID,
        type: "rent",
        status: "active",
        title: "Phase 8 Test Daire",
        slug: "phase8-test-daire",
        city: "Istanbul",
        district: "Kadikoy",
        price: 12000,
        currency: "TRY",
        is_furnished: true,
        image_count: 3,
        main_item_count: 2,
        service_option_count: 1,
        is_checkout_ready: true,
        created_at: "2026-04-30T10:00:00Z",
        updated_at: "2026-04-30T10:00:00Z",
      },
      {
        id: SECOND_LISTING_ID,
        type: "sale",
        status: "passive",
        title: "Satilik Villa",
        slug: "satilik-villa",
        city: "Antalya",
        district: null,
        price: 0,
        currency: "TRY",
        is_furnished: false,
        image_count: 0,
        main_item_count: 0,
        service_option_count: 0,
        is_checkout_ready: false,
        created_at: null,
        updated_at: null,
      },
    ],
    limit: 20,
    offset: 0,
  };
}

function createSnapshot() {
  return {
    listing: {
      id: LISTING_ID,
      type: "rent",
      status: "active",
      title: "Phase 8 Test Daire",
      slug: "phase8-test-daire",
      summary: "Ozet",
      description: "Aciklama",
      city: "Istanbul",
      district: "Kadikoy",
      price: 12000,
      currency: "TRY",
      room_count: 3,
      bathroom_count: 1,
      gross_area_m2: 110,
      is_furnished: true,
      created_at: "2026-04-30T10:00:00Z",
      updated_at: "2026-04-30T10:00:00Z",
    },
    images: [
      {
        id: "img-1",
        image_url: "https://example.com/a.jpg",
        alt_text: "alt-1",
        sort_order: 0,
        is_primary: true,
        created_at: "2026-04-30T10:00:00Z",
      },
      {
        id: "img-2",
        image_url: "https://example.com/b.jpg",
        alt_text: null,
        sort_order: 1,
        is_primary: false,
        created_at: "2026-04-30T11:00:00Z",
      },
    ],
    main_item_options: [
      {
        id: "mio-1",
        main_item_id: "mc-1",
        code: "phase8_main",
        label: "Aylik kira",
        pricing_strategy: "amount",
        default_amount: 12000,
        default_multiplier: null,
        override_label: "Custom Label",
        override_amount: null,
        override_multiplier: null,
        is_enabled: true,
        sort_order: 0,
        catalog_is_active: true,
      },
    ],
    service_options: [
      {
        id: "sso-1",
        service_id: "sc-1",
        code: "phase8_service",
        name: "Temizlik",
        base_price: 100,
        override_price: 150,
        is_enabled: true,
        catalog_is_active: true,
      },
    ],
    available_main_items: [
      {
        id: "mc-1",
        code: "phase8_main",
        label: "Aylik kira",
        pricing_strategy: "amount",
        default_amount: 12000,
        default_multiplier: null,
        is_active: true,
        sort_order: 0,
        private_note: "leak",
      },
      {
        id: "mc-2",
        code: "phase8_extra_main",
        label: "Depozito",
        pricing_strategy: "amount",
        default_amount: 24000,
        default_multiplier: null,
        is_active: true,
        sort_order: 1,
      },
    ],
    available_services: [
      {
        id: "sc-1",
        code: "phase8_service",
        name: "Temizlik",
        base_price: 100,
        is_active: true,
        private_note: "leak",
      },
      {
        id: "sc-2",
        code: "phase8_extra_service",
        name: "Karsilama",
        base_price: 200,
        is_active: true,
      },
    ],
    checkout_eligibility: {
      is_checkout_ready: true,
      missing: [] as string[],
    },
  };
}

test("admin listings view-model maps the list payload to typed rows", () => {
  const model = buildAdminListingsViewModel({
    list: createList(),
    selectedListingId: null,
    snapshot: null,
  });

  assert.equal(model.rows.length, 2);
  assert.deepEqual(model.rows[0], {
    listingId: LISTING_ID,
    title: "Phase 8 Test Daire",
    typeLabel: "Kiralik",
    statusLabel: "Aktif",
    locationLabel: "Istanbul / Kadikoy",
    priceLabel: "12.000 TRY",
    imageCount: 3,
    mainItemCount: 2,
    serviceOptionCount: 1,
    isCheckoutReady: true,
  });
  assert.equal(model.rows[1].locationLabel, "Antalya");
  assert.equal(model.rows[1].typeLabel, "Satilik");
  assert.equal(model.rows[1].statusLabel, "Pasif");
});

test("admin listings view-model selects the first row when selection is null", () => {
  const model = buildAdminListingsViewModel({
    list: createList(),
    selectedListingId: null,
    snapshot: null,
  });

  assert.equal(model.selectedListingId, LISTING_ID);
});

test("admin listings view-model keeps existing selection if it is still in the list", () => {
  const model = buildAdminListingsViewModel({
    list: createList(),
    selectedListingId: SECOND_LISTING_ID,
    snapshot: null,
  });

  assert.equal(model.selectedListingId, SECOND_LISTING_ID);
});

test("admin listings view-model returns null selection when list is empty", () => {
  const model = buildAdminListingsViewModel({
    list: { items: [], limit: 20, offset: 0 },
    selectedListingId: LISTING_ID,
    snapshot: null,
  });

  assert.equal(model.selectedListingId, null);
  assert.equal(model.detail, null);
});

test("admin listings view-model returns sanitized detail when snapshot is provided", () => {
  const model = buildAdminListingsViewModel({
    list: createList(),
    selectedListingId: LISTING_ID,
    snapshot: createSnapshot(),
  });

  assert.ok(model.detail);
  assert.equal(model.detail.listing.id, LISTING_ID);
  assert.equal(model.detail.listing.title, "Phase 8 Test Daire");
  assert.equal(model.detail.images.length, 2);
  assert.equal(model.detail.images[0].isPrimary, true);
  assert.equal(model.detail.mainItems.length, 1);
  assert.equal(model.detail.mainItems[0].code, "phase8_main");
  assert.equal(model.detail.services.length, 1);
  assert.equal(model.detail.services[0].overridePrice, 150);
  assert.equal(model.detail.availableMainItems.length, 2);
  assert.equal(model.detail.availableMainItems[1].code, "phase8_extra_main");
  assert.equal(model.detail.availableServices.length, 2);
  assert.equal(model.detail.availableServices[1].code, "phase8_extra_service");
  assert.deepEqual(model.detail.checkoutEligibility, {
    isCheckoutReady: true,
    missing: [],
  });
});

test("admin listings view-model returns add candidates excluding already attached catalog codes", () => {
  const model = buildAdminListingsViewModel({
    list: createList(),
    selectedListingId: LISTING_ID,
    snapshot: createSnapshot(),
  });

  assert.ok(model.detail);
  assert.deepEqual(
    getAvailableMainItemAddCandidates(model.detail).map((item) => item.code),
    ["phase8_extra_main"],
  );
  assert.deepEqual(
    getAvailableServiceAddCandidates(model.detail).map((service) => service.code),
    ["phase8_extra_service"],
  );
});

test("admin listings view-model exposes missing reasons for non-ready rent listings", () => {
  const snapshot = createSnapshot();
  snapshot.checkout_eligibility = {
    is_checkout_ready: false,
    missing: ["enabled_service_option"],
  };

  const model = buildAdminListingsViewModel({
    list: createList(),
    selectedListingId: LISTING_ID,
    snapshot,
  });

  assert.ok(model.detail);
  assert.deepEqual(model.detail.checkoutEligibility, {
    isCheckoutReady: false,
    missing: ["enabled_service_option"],
  });
});

test("admin listings view-model returns null detail when snapshot listing id mismatches selection", () => {
  const snapshot = createSnapshot();
  snapshot.listing.id = SECOND_LISTING_ID;

  const model = buildAdminListingsViewModel({
    list: createList(),
    selectedListingId: LISTING_ID,
    snapshot,
  });

  assert.equal(model.detail, null);
});

test("admin listings view-model never leaks unknown fields from raw RPC payload", () => {
  const snapshot = createSnapshot() as Record<string, unknown> & { listing: Record<string, unknown> };
  snapshot.debug = { secret: "leak" };
  snapshot.listing.private_token = "leak";

  const model = buildAdminListingsViewModel({
    list: createList(),
    selectedListingId: LISTING_ID,
    snapshot,
  });

  assert.ok(model.detail);
  const serialized = JSON.stringify(model);
  assert.ok(!serialized.includes("leak"), "view-model must drop unknown raw fields");
});

function createMainItem(overrides: Partial<AdminListingMainItem> = {}): AdminListingMainItem {
  return {
    id: "mio-1",
    mainItemId: "mc-1",
    code: "phase8_main",
    label: "Aylik kira",
    pricingStrategy: "amount",
    defaultAmount: 12000,
    defaultMultiplier: null,
    overrideLabel: null,
    overrideAmount: null,
    overrideMultiplier: null,
    isEnabled: true,
    sortOrder: 0,
    catalogIsActive: true,
    ...overrides,
  };
}

test("main item display helper uses override label as the primary label when present", () => {
  const display = buildAdminListingMainItemDisplay(
    createMainItem({ overrideLabel: "Custom Label" }),
  );

  assert.equal(display.primaryLabel, "Custom Label");
  assert.equal(display.catalogLabel, "Aylik kira");
  assert.equal(display.codeLabel, "phase8_main");
});

test("main item display helper falls back to catalog label when override is missing", () => {
  const display = buildAdminListingMainItemDisplay(createMainItem());

  assert.equal(display.primaryLabel, "Aylik kira");
});

test("main item display helper falls back to code when both labels are empty", () => {
  const display = buildAdminListingMainItemDisplay(
    createMainItem({ label: "", overrideLabel: null }),
  );

  assert.equal(display.primaryLabel, "phase8_main");
});

test("main item display helper formats enabled and catalog status with Turkish labels", () => {
  const enabled = buildAdminListingMainItemDisplay(
    createMainItem({ isEnabled: true, catalogIsActive: true }),
  );
  const disabled = buildAdminListingMainItemDisplay(
    createMainItem({ isEnabled: false, catalogIsActive: false }),
  );

  assert.equal(enabled.enabledLabel, "Aktif");
  assert.equal(enabled.catalogStatusLabel, "Katalog aktif");
  assert.equal(disabled.enabledLabel, "Pasif");
  assert.equal(disabled.catalogStatusLabel, "Katalog pasif");
});

test("main item display helper renders Turkish amount and multiplier labels with raw numbers", () => {
  const display = buildAdminListingMainItemDisplay(
    createMainItem({
      defaultAmount: 12000,
      overrideAmount: 1500,
      defaultMultiplier: 1.5,
      overrideMultiplier: 1.2,
    }),
  );

  assert.equal(display.defaultAmountLabel, "Varsayılan tutar: 12000");
  assert.equal(display.overrideAmountLabel, "Override tutar: 1500");
  assert.equal(display.defaultMultiplierLabel, "Varsayılan çarpan: 1.5");
  assert.equal(display.overrideMultiplierLabel, "Override çarpan: 1.2");
});

test("main item display helper returns Yok for missing amount or multiplier values", () => {
  const display = buildAdminListingMainItemDisplay(
    createMainItem({
      defaultAmount: null,
      overrideAmount: null,
      defaultMultiplier: null,
      overrideMultiplier: null,
    }),
  );

  assert.equal(display.defaultAmountLabel, "Varsayılan tutar: Yok");
  assert.equal(display.overrideAmountLabel, "Override tutar: Yok");
  assert.equal(display.defaultMultiplierLabel, "Varsayılan çarpan: Yok");
  assert.equal(display.overrideMultiplierLabel, "Override çarpan: Yok");
});

test("main item display helper never invents a currency when formatting amounts", () => {
  const display = buildAdminListingMainItemDisplay(
    createMainItem({ defaultAmount: 12000, overrideAmount: 1500 }),
  );

  assert.ok(!display.defaultAmountLabel.includes("TRY"));
  assert.ok(!display.overrideAmountLabel.includes("TRY"));
});

function createService(overrides: Partial<AdminListingService> = {}): AdminListingService {
  return {
    id: "sso-1",
    serviceId: "sc-1",
    code: "phase8_service",
    name: "Temizlik",
    basePrice: 100,
    overridePrice: null,
    isEnabled: true,
    catalogIsActive: true,
    ...overrides,
  };
}

test("service display helper uses the catalog name as the primary label", () => {
  const display = buildAdminListingServiceDisplay(createService());

  assert.equal(display.primaryLabel, "Temizlik");
  assert.equal(display.codeLabel, "phase8_service");
});

test("service display helper falls back to code when the catalog name is empty", () => {
  const display = buildAdminListingServiceDisplay(
    createService({ name: "" }),
  );

  assert.equal(display.primaryLabel, "phase8_service");
});

test("service display helper formats enabled and catalog status with Turkish labels", () => {
  const enabled = buildAdminListingServiceDisplay(
    createService({ isEnabled: true, catalogIsActive: true }),
  );
  const disabled = buildAdminListingServiceDisplay(
    createService({ isEnabled: false, catalogIsActive: false }),
  );

  assert.equal(enabled.enabledLabel, "Aktif");
  assert.equal(enabled.catalogStatusLabel, "Katalog aktif");
  assert.equal(disabled.enabledLabel, "Pasif");
  assert.equal(disabled.catalogStatusLabel, "Katalog pasif");
});

test("service display helper renders Turkish base and override price labels with raw numbers", () => {
  const display = buildAdminListingServiceDisplay(
    createService({ basePrice: 12000, overridePrice: 1500 }),
  );

  assert.equal(display.basePriceLabel, "Varsayılan fiyat: 12000");
  assert.equal(display.overridePriceLabel, "Override fiyat: 1500");
});

test("service display helper returns Yok for missing base or override price values", () => {
  const display = buildAdminListingServiceDisplay(
    createService({ basePrice: null, overridePrice: null }),
  );

  assert.equal(display.basePriceLabel, "Varsayılan fiyat: Yok");
  assert.equal(display.overridePriceLabel, "Override fiyat: Yok");
});

test("service display helper never invents a currency when formatting prices", () => {
  const display = buildAdminListingServiceDisplay(
    createService({ basePrice: 12000, overridePrice: 1500 }),
  );

  assert.ok(!display.basePriceLabel.includes("TRY"));
  assert.ok(!display.overridePriceLabel.includes("TRY"));
});

function createReadinessDetail(overrides: {
  type?: "rent" | "sale";
  isReady?: boolean;
  missing?: string[];
}): AdminListingDetail {
  return {
    listing: {
      id: LISTING_ID,
      type: overrides.type ?? "rent",
      status: "active",
      title: "Phase 8 Test Daire",
      slug: "phase8-test-daire",
      summary: null,
      description: null,
      city: null,
      district: null,
      price: 0,
      currency: null,
      roomCount: null,
      bathroomCount: null,
      grossAreaM2: null,
      isFurnished: false,
      createdAt: null,
      updatedAt: null,
    },
    images: [],
    mainItems: [],
    services: [],
    availableMainItems: [],
    availableServices: [],
    checkoutEligibility: {
      isCheckoutReady: overrides.isReady ?? false,
      missing: overrides.missing ?? [],
    },
  };
}

test("readiness display helper returns unknown status when no detail is selected", () => {
  const display = buildAdminListingCheckoutReadinessDisplay(null);

  assert.equal(display.status, "unknown");
  assert.equal(display.badgeLabel, "Hazırlık durumu alınamadı");
  assert.equal(display.isApplicable, false);
  assert.deepEqual(display.missing, []);
});

test("readiness display helper marks sale listings as not-applicable with admin copy", () => {
  const display = buildAdminListingCheckoutReadinessDisplay(
    createReadinessDetail({ type: "sale", isReady: false, missing: ["enabled_main_item"] }),
  );

  assert.equal(display.status, "not-applicable");
  assert.equal(display.isApplicable, false);
  assert.equal(
    display.summary,
    "Satılık ilanlarda checkout yapılandırması beklenmez.",
  );
  assert.deepEqual(display.missing, []);
});

test("readiness display helper returns ready badge for rent listings that are checkout ready", () => {
  const display = buildAdminListingCheckoutReadinessDisplay(
    createReadinessDetail({ type: "rent", isReady: true, missing: [] }),
  );

  assert.equal(display.status, "ready");
  assert.equal(display.badgeLabel, "Checkout hazır");
  assert.equal(display.isApplicable, true);
  assert.deepEqual(display.missing, []);
});

test("readiness display helper maps known missing keys to admin-friendly Turkish messages", () => {
  const display = buildAdminListingCheckoutReadinessDisplay(
    createReadinessDetail({
      type: "rent",
      isReady: false,
      missing: ["enabled_main_item", "enabled_service_option", "image", "price"],
    }),
  );

  assert.equal(display.status, "not-ready");
  assert.equal(display.badgeLabel, "Hazır değil");
  assert.equal(display.isApplicable, true);
  assert.deepEqual(display.missing, [
    {
      rawKey: "enabled_main_item",
      message: "Aktif ana ödeme kalemi eksik",
      isKnown: true,
    },
    {
      rawKey: "enabled_service_option",
      message: "Aktif ek hizmet eksik",
      isKnown: true,
    },
    {
      rawKey: "image",
      message: "Görsel eksik",
      isKnown: true,
    },
    {
      rawKey: "price",
      message: "Fiyat eksik",
      isKnown: true,
    },
  ]);
});

test("readiness display helper falls back safely for unknown missing keys", () => {
  const display = buildAdminListingCheckoutReadinessDisplay(
    createReadinessDetail({
      type: "rent",
      isReady: false,
      missing: ["weird_future_reason"],
    }),
  );

  assert.equal(display.status, "not-ready");
  assert.equal(display.missing.length, 1);
  assert.equal(display.missing[0].rawKey, "weird_future_reason");
  assert.equal(display.missing[0].isKnown, false);
  assert.equal(display.missing[0].message, "Bilinmeyen eksik kalem");
});
