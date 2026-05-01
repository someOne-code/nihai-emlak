// Phase 8.5: typed view-model for /admin/listings.
//
// Translates raw `admin_list_listings` and `admin_get_listing` payloads
// into a UI-friendly shape. The view-model never carries unknown fields
// from the RPC response, so debug or private information cannot leak
// into the rendered DOM through this layer.

export type AdminListingType = "rent" | "sale" | "unknown";
export type AdminListingStatus = "active" | "passive" | "unknown";

export type AdminListingsListInput = {
  items: unknown[];
  limit: number;
  offset: number;
};

export type AdminListingsViewModelInput = {
  list: AdminListingsListInput;
  selectedListingId: string | null;
  snapshot: unknown;
};

export type AdminListingRow = {
  listingId: string;
  title: string;
  typeLabel: string;
  statusLabel: string;
  locationLabel: string;
  priceLabel: string;
  imageCount: number;
  mainItemCount: number;
  serviceOptionCount: number;
  isCheckoutReady: boolean;
};

export type AdminListingDetailListing = {
  id: string;
  type: AdminListingType;
  status: AdminListingStatus;
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  city: string | null;
  district: string | null;
  price: number | null;
  currency: string | null;
  roomCount: number | null;
  bathroomCount: number | null;
  grossAreaM2: number | null;
  isFurnished: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AdminListingImage = {
  id: string;
  imageUrl: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
  createdAt: string | null;
};

export type AdminListingMainItem = {
  id: string;
  mainItemId: string;
  code: string;
  label: string;
  pricingStrategy: string;
  defaultAmount: number | null;
  defaultMultiplier: number | null;
  overrideLabel: string | null;
  overrideAmount: number | null;
  overrideMultiplier: number | null;
  isEnabled: boolean;
  sortOrder: number;
  catalogIsActive: boolean;
};

export type AdminListingService = {
  id: string;
  serviceId: string;
  code: string;
  name: string;
  basePrice: number | null;
  overridePrice: number | null;
  isEnabled: boolean;
  catalogIsActive: boolean;
};

export type AdminListingAvailableMainItem = {
  id: string;
  code: string;
  label: string;
  pricingStrategy: string;
  defaultAmount: number | null;
  defaultMultiplier: number | null;
  isActive: boolean;
  sortOrder: number;
};

export type AdminListingAvailableService = {
  id: string;
  code: string;
  name: string;
  basePrice: number | null;
  isActive: boolean;
};

export type AdminListingDetail = {
  listing: AdminListingDetailListing;
  images: AdminListingImage[];
  mainItems: AdminListingMainItem[];
  services: AdminListingService[];
  availableMainItems: AdminListingAvailableMainItem[];
  availableServices: AdminListingAvailableService[];
  checkoutEligibility: {
    isCheckoutReady: boolean;
    missing: string[];
  };
};

export type AdminListingsViewModel = {
  rows: AdminListingRow[];
  selectedListingId: string | null;
  detail: AdminListingDetail | null;
};

const TYPE_LABELS: Record<AdminListingType, string> = {
  rent: "Kiralik",
  sale: "Satilik",
  unknown: "Bilinmiyor",
};

const STATUS_LABELS: Record<AdminListingStatus, string> = {
  active: "Aktif",
  passive: "Pasif",
  unknown: "Bilinmiyor",
};

export function buildAdminListingsViewModel(
  input: AdminListingsViewModelInput,
): AdminListingsViewModel {
  const rows = input.list.items.filter(isRecord).map(buildRow);
  const requested = asString(input.selectedListingId);
  const matchedRequested = requested
    ? rows.find((row) => row.listingId === requested)
    : null;
  const selectedListingId = matchedRequested?.listingId ?? rows[0]?.listingId ?? null;
  const detail = buildDetail(input.snapshot, selectedListingId);

  return {
    rows,
    selectedListingId,
    detail,
  };
}

function buildRow(raw: Record<string, unknown>): AdminListingRow {
  const type = normalizeType(asString(raw.type));
  const status = normalizeStatus(asString(raw.status));
  const city = asString(raw.city);
  const district = asString(raw.district);

  return {
    listingId: asString(raw.id) ?? "",
    title: asString(raw.title) ?? "Isimsiz ilan",
    typeLabel: TYPE_LABELS[type],
    statusLabel: STATUS_LABELS[status],
    locationLabel: [city, district].filter((part): part is string => Boolean(part)).join(" / "),
    priceLabel: formatAmount(asNumber(raw.price), asString(raw.currency)),
    imageCount: asNumber(raw.image_count) ?? 0,
    mainItemCount: asNumber(raw.main_item_count) ?? 0,
    serviceOptionCount: asNumber(raw.service_option_count) ?? 0,
    isCheckoutReady: asBoolean(raw.is_checkout_ready),
  };
}

function buildDetail(
  snapshot: unknown,
  selectedListingId: string | null,
): AdminListingDetail | null {
  if (!isRecord(snapshot) || !selectedListingId) {
    return null;
  }

  const listingRaw = isRecord(snapshot.listing) ? snapshot.listing : null;
  if (!listingRaw) {
    return null;
  }

  const listingId = asString(listingRaw.id);
  if (!listingId || listingId !== selectedListingId) {
    return null;
  }

  return {
    listing: buildDetailListing(listingRaw, listingId),
    images: pickArray(snapshot.images).map(buildImage),
    mainItems: pickArray(snapshot.main_item_options).map(buildMainItem),
    services: pickArray(snapshot.service_options).map(buildService),
    availableMainItems: pickArray(snapshot.available_main_items).map(buildAvailableMainItem),
    availableServices: pickArray(snapshot.available_services).map(buildAvailableService),
    checkoutEligibility: buildEligibility(snapshot.checkout_eligibility),
  };
}

export function getAvailableMainItemAddCandidates(
  detail: AdminListingDetail,
): AdminListingAvailableMainItem[] {
  const attachedCodes = new Set(detail.mainItems.map((item) => item.code));
  return detail.availableMainItems.filter((item) => !attachedCodes.has(item.code));
}

export type AdminListingMainItemDisplay = {
  primaryLabel: string;
  catalogLabel: string;
  codeLabel: string;
  enabledLabel: string;
  catalogStatusLabel: string;
  defaultAmountLabel: string;
  overrideAmountLabel: string;
  defaultMultiplierLabel: string;
  overrideMultiplierLabel: string;
};

// Phase 8.6 Task 5: admin-facing display helper for a single main item
// option. Keeps the primary label, raw code, enabled/catalog status,
// and amount/multiplier copy in one place so the panel and tests share
// the same Turkish labels. Amount and multiplier values are rendered
// raw; currency is never invented here.
export function buildAdminListingMainItemDisplay(
  item: AdminListingMainItem,
): AdminListingMainItemDisplay {
  const overrideLabel = trimOrNull(item.overrideLabel);
  const catalogLabel = trimOrNull(item.label);
  const code = trimOrNull(item.code) ?? "";

  const primaryLabel = overrideLabel ?? catalogLabel ?? code;

  return {
    primaryLabel,
    catalogLabel: catalogLabel ?? "",
    codeLabel: code,
    enabledLabel: item.isEnabled ? "Aktif" : "Pasif",
    catalogStatusLabel: item.catalogIsActive ? "Katalog aktif" : "Katalog pasif",
    defaultAmountLabel: formatRawNumberLabel("Varsayılan tutar", item.defaultAmount),
    overrideAmountLabel: formatRawNumberLabel("Override tutar", item.overrideAmount),
    defaultMultiplierLabel: formatRawNumberLabel(
      "Varsayılan çarpan",
      item.defaultMultiplier,
    ),
    overrideMultiplierLabel: formatRawNumberLabel(
      "Override çarpan",
      item.overrideMultiplier,
    ),
  };
}

function trimOrNull(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function formatRawNumberLabel(prefix: string, value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return `${prefix}: Yok`;
  }
  return `${prefix}: ${String(value)}`;
}

export function getAvailableServiceAddCandidates(
  detail: AdminListingDetail,
): AdminListingAvailableService[] {
  const attachedCodes = new Set(detail.services.map((service) => service.code));
  return detail.availableServices.filter((service) => !attachedCodes.has(service.code));
}

export type AdminListingServiceDisplay = {
  primaryLabel: string;
  catalogName: string;
  codeLabel: string;
  enabledLabel: string;
  catalogStatusLabel: string;
  basePriceLabel: string;
  overridePriceLabel: string;
};

export type AdminListingCheckoutReadinessStatus =
  | "ready"
  | "not-ready"
  | "not-applicable"
  | "unknown";

export type AdminListingCheckoutReadinessMissingItem = {
  rawKey: string;
  message: string;
  isKnown: boolean;
};

export type AdminListingCheckoutReadinessDisplay = {
  status: AdminListingCheckoutReadinessStatus;
  badgeLabel: string;
  summary: string | null;
  missing: AdminListingCheckoutReadinessMissingItem[];
  isApplicable: boolean;
};

// Phase 8.6 Task 7: admin-facing display helper for the checkout
// readiness side panel and tab. The view never invents readiness; it
// reads `checkoutEligibility` from the DB/RPC snapshot and only maps
// raw missing reason keys into admin-friendly Turkish copy. Sale
// listings short-circuit with a not-applicable summary.
const READINESS_MISSING_KEY_LABELS: Record<string, string> = {
  enabled_main_item: "Aktif ana ödeme kalemi eksik",
  enabled_service_option: "Aktif ek hizmet eksik",
  image: "Görsel eksik",
  price: "Fiyat eksik",
};

export function buildAdminListingCheckoutReadinessDisplay(
  detail: AdminListingDetail | null,
): AdminListingCheckoutReadinessDisplay {
  if (!detail) {
    return {
      status: "unknown",
      badgeLabel: "Hazırlık durumu alınamadı",
      summary:
        "Bir ilan seçtiğinde checkout hazırlık durumu burada görünür.",
      missing: [],
      isApplicable: false,
    };
  }

  if (detail.listing.type === "sale") {
    return {
      status: "not-applicable",
      badgeLabel: "Checkout uygulanmaz",
      summary: "Satılık ilanlarda checkout yapılandırması beklenmez.",
      missing: [],
      isApplicable: false,
    };
  }

  const isReady = detail.checkoutEligibility.isCheckoutReady;
  const missing = detail.checkoutEligibility.missing.map(mapMissingReason);

  if (isReady) {
    return {
      status: "ready",
      badgeLabel: "Checkout hazır",
      summary: "Bu ilan checkout için hazır.",
      missing,
      isApplicable: true,
    };
  }

  return {
    status: "not-ready",
    badgeLabel: "Hazır değil",
    summary: "Checkout için bazı konfigürasyon kalemleri eksik.",
    missing,
    isApplicable: true,
  };
}

function mapMissingReason(rawKey: string): AdminListingCheckoutReadinessMissingItem {
  const known = READINESS_MISSING_KEY_LABELS[rawKey];
  if (known) {
    return { rawKey, message: known, isKnown: true };
  }
  return {
    rawKey,
    message: "Bilinmeyen eksik kalem",
    isKnown: false,
  };
}

// Phase 8.6 Task 6: admin-facing display helper for a single service
// option attached to a listing. Keeps the primary label, raw code,
// enabled/catalog status, and base/override price copy in one place so
// the services panel and tests share the same Turkish labels. Prices
// are rendered raw; currency is never invented here.
export function buildAdminListingServiceDisplay(
  service: AdminListingService,
): AdminListingServiceDisplay {
  const catalogName = trimOrNull(service.name);
  const code = trimOrNull(service.code) ?? "";

  const primaryLabel = catalogName ?? code;

  return {
    primaryLabel,
    catalogName: catalogName ?? "",
    codeLabel: code,
    enabledLabel: service.isEnabled ? "Aktif" : "Pasif",
    catalogStatusLabel: service.catalogIsActive ? "Katalog aktif" : "Katalog pasif",
    basePriceLabel: formatRawNumberLabel("Varsayılan fiyat", service.basePrice),
    overridePriceLabel: formatRawNumberLabel("Override fiyat", service.overridePrice),
  };
}

function buildDetailListing(
  raw: Record<string, unknown>,
  listingId: string,
): AdminListingDetailListing {
  return {
    id: listingId,
    type: normalizeType(asString(raw.type)),
    status: normalizeStatus(asString(raw.status)),
    title: asString(raw.title) ?? "",
    slug: asString(raw.slug) ?? "",
    summary: asString(raw.summary),
    description: asString(raw.description),
    city: asString(raw.city),
    district: asString(raw.district),
    price: asNumber(raw.price),
    currency: asString(raw.currency),
    roomCount: asNumber(raw.room_count),
    bathroomCount: asNumber(raw.bathroom_count),
    grossAreaM2: asNumber(raw.gross_area_m2),
    isFurnished: asBoolean(raw.is_furnished),
    createdAt: asString(raw.created_at),
    updatedAt: asString(raw.updated_at),
  };
}

function buildImage(raw: Record<string, unknown>): AdminListingImage {
  return {
    id: asString(raw.id) ?? "",
    imageUrl: asString(raw.image_url) ?? "",
    altText: asString(raw.alt_text),
    sortOrder: asNumber(raw.sort_order) ?? 0,
    isPrimary: asBoolean(raw.is_primary),
    createdAt: asString(raw.created_at),
  };
}

function buildMainItem(raw: Record<string, unknown>): AdminListingMainItem {
  return {
    id: asString(raw.id) ?? "",
    mainItemId: asString(raw.main_item_id) ?? "",
    code: asString(raw.code) ?? "",
    label: asString(raw.label) ?? "",
    pricingStrategy: asString(raw.pricing_strategy) ?? "amount",
    defaultAmount: asNumber(raw.default_amount),
    defaultMultiplier: asNumber(raw.default_multiplier),
    overrideLabel: asString(raw.override_label),
    overrideAmount: asNumber(raw.override_amount),
    overrideMultiplier: asNumber(raw.override_multiplier),
    isEnabled: asBoolean(raw.is_enabled),
    sortOrder: asNumber(raw.sort_order) ?? 0,
    catalogIsActive: asBoolean(raw.catalog_is_active),
  };
}

function buildService(raw: Record<string, unknown>): AdminListingService {
  return {
    id: asString(raw.id) ?? "",
    serviceId: asString(raw.service_id) ?? "",
    code: asString(raw.code) ?? "",
    name: asString(raw.name) ?? "",
    basePrice: asNumber(raw.base_price),
    overridePrice: asNumber(raw.override_price),
    isEnabled: asBoolean(raw.is_enabled),
    catalogIsActive: asBoolean(raw.catalog_is_active),
  };
}

function buildAvailableMainItem(raw: Record<string, unknown>): AdminListingAvailableMainItem {
  return {
    id: asString(raw.id) ?? "",
    code: asString(raw.code) ?? "",
    label: asString(raw.label) ?? "",
    pricingStrategy: asString(raw.pricing_strategy) ?? "amount",
    defaultAmount: asNumber(raw.default_amount),
    defaultMultiplier: asNumber(raw.default_multiplier),
    isActive: asBoolean(raw.is_active),
    sortOrder: asNumber(raw.sort_order) ?? 0,
  };
}

function buildAvailableService(raw: Record<string, unknown>): AdminListingAvailableService {
  return {
    id: asString(raw.id) ?? "",
    code: asString(raw.code) ?? "",
    name: asString(raw.name) ?? "",
    basePrice: asNumber(raw.base_price),
    isActive: asBoolean(raw.is_active),
  };
}

function buildEligibility(value: unknown): AdminListingDetail["checkoutEligibility"] {
  if (!isRecord(value)) {
    return { isCheckoutReady: false, missing: [] };
  }

  const missing = Array.isArray(value.missing)
    ? value.missing
        .map((entry) => asString(entry))
        .filter((entry): entry is string => Boolean(entry))
    : [];

  return {
    isCheckoutReady: asBoolean(value.is_checkout_ready),
    missing,
  };
}

function pickArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord);
}

function normalizeType(value: string | null): AdminListingType {
  if (value === "rent" || value === "sale") {
    return value;
  }
  return "unknown";
}

function normalizeStatus(value: string | null): AdminListingStatus {
  if (value === "active" || value === "passive") {
    return value;
  }
  return "unknown";
}

function formatAmount(amount: number | null, currency: string | null): string {
  if (amount === null) {
    return "Belirtilmedi";
  }

  const formatted = amount.toLocaleString("tr-TR");
  return currency ? `${formatted} ${currency}` : formatted;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return value.trim();
}

function asNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}
