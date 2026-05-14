// Phase 9B: typed view-model for the global catalog admin surface.
//
// Translates raw admin_list_main_item_catalog / admin_list_service_catalog
// RPC payloads into a UI-friendly shape. Never carries unknown fields.
// All copy is admin-friendly Turkish with no "override" jargon.

export type AdminCatalogMainItemRow = {
  id: string;
  code: string;
  label: string;
  description: string | null;
  pricingStrategy: string;
  pricingStrategyLabel: string;
  defaultAmount: number | null;
  defaultMultiplier: number | null;
  isActive: boolean;
  sortOrder: number;
  statusLabel: string;
  defaultAmountLabel: string;
  defaultMultiplierLabel: string;
  createdAt: string | null;
  updatedAt: string | null;
};

// Admin-friendly labels for pricing strategy DB codes. Unknown codes fall back
// to the raw code so admins can still identify configuration drift.
export const PRICING_STRATEGY_LABELS: Record<string, string> = {
  fixed: "Sabit tutar",
  listing_price_multiplier: "İlan fiyatına oranlı",
  stay_months_multiplier: "Aylık (süreye bağlı)",
};

// Short human explanations shown in the form help text.
export const PRICING_STRATEGY_DESCRIPTIONS: Record<string, string> = {
  fixed: "Depozito, kapora gibi sabit kalemler için. Her müşteriden aynı tutar alınır.",
  listing_price_multiplier:
    "İlan fiyatı × oran. Örn: oran 1.0 → tam kira, oran 0.5 → yarısı.",
  stay_months_multiplier:
    "Aylık tekrarlayan ödeme. Toplam = aylık tutar × kalma süresi (ay).",
};

// Longer human explanations used for the (i) tooltip/popover on each strategy.
export const PRICING_STRATEGY_LONG_DESCRIPTIONS: Record<string, string> = {
  fixed:
    "Sabit tutar: Müşteriden her zaman tam olarak girdiğin tutarı tahsil edilir. " +
    "İlan fiyatı veya kalma süresi bu tutarı etkilemez. " +
    "Örnek: 5.000 ₺ depozito — 10.000 ₺'lık ilanda da 50.000 ₺'lık ilanda da 5.000 ₺ ödenir.",
  listing_price_multiplier:
    "İlan fiyatına oranlı: Tahsil edilen tutar, ilanın kendi fiyatıyla orantılıdır. " +
    "Formül: ilan fiyatı × oran. " +
    "Örnek: Oran 1.0 ise 15.000 ₺'lık ilanda 15.000 ₺ alınır. " +
    "Komisyon için oran 0.10 girerseniz fiyatın %10'u alınır.",
  stay_months_multiplier:
    "Aylık (süreye bağlı): Toplam tutar, müşterinin kalma süresiyle orantılıdır. " +
    "Formül: aylık tutar × ay sayısı. " +
    "Örnek: Aylık 500 ₺ aidat girerseniz, 3 ay kalan 1.500 ₺, 6 ay kalan 3.000 ₺ öder.",
};

// Generic tooltip for the "Fiyat Stratejisi" field label itself.
export const PRICING_STRATEGY_FIELD_HELP =
  "Bu ödeme kaleminin tutarının nasıl hesaplanacağını belirler. " +
  "Her seçeneğin açıklamasını okuyarak kendinize uygun olanı seçin.";

// Which pricing strategy requires which input field. UI hides/disables the
// irrelevant field so the DB check constraint can never fail from the admin UI.
export function pricingStrategyRequires(strategy: string): {
  amount: boolean;
  multiplier: boolean;
} {
  if (strategy === "fixed") {
    return { amount: true, multiplier: false };
  }
  if (
    strategy === "listing_price_multiplier" ||
    strategy === "stay_months_multiplier"
  ) {
    return { amount: false, multiplier: true };
  }
  // Unknown strategy: show both fields so admin can supply whatever is needed.
  return { amount: true, multiplier: true };
}

export type AdminCatalogServiceRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  basePrice: number | null;
  isActive: boolean;
  statusLabel: string;
  basePriceLabel: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export function buildAdminCatalogMainItemRow(raw: Record<string, unknown>): AdminCatalogMainItemRow {
  const isActive = asBoolean(raw.is_active);
  const defaultAmount = asNumber(raw.default_amount);
  const defaultMultiplier = asNumber(raw.default_multiplier);
  const pricingStrategy = asString(raw.pricing_strategy) ?? "fixed";

  return {
    id: asString(raw.id) ?? "",
    code: asString(raw.code) ?? "",
    label: asString(raw.label) ?? "",
    description: asString(raw.description),
    pricingStrategy,
    pricingStrategyLabel: PRICING_STRATEGY_LABELS[pricingStrategy] ?? pricingStrategy,
    defaultAmount,
    defaultMultiplier,
    isActive,
    sortOrder: asNumber(raw.sort_order) ?? 0,
    statusLabel: isActive ? "Aktif" : "Pasif",
    defaultAmountLabel: formatNumberLabel("Varsayılan tutar", defaultAmount),
    defaultMultiplierLabel: formatNumberLabel("Varsayılan çarpan", defaultMultiplier),
    createdAt: asString(raw.created_at),
    updatedAt: asString(raw.updated_at),
  };
}

export function upsertAdminCatalogMainItemRow(
  rows: AdminCatalogMainItemRow[],
  raw: unknown,
): AdminCatalogMainItemRow[] {
  const nextRow = buildAdminCatalogMainItemRow(isRecord(raw) ? raw : {});
  return upsertByIdentity(rows, nextRow).sort(compareMainItems);
}

export function buildAdminCatalogServiceRow(raw: Record<string, unknown>): AdminCatalogServiceRow {
  const isActive = asBoolean(raw.is_active);
  const basePrice = asNumber(raw.base_price);

  return {
    id: asString(raw.id) ?? "",
    code: asString(raw.code) ?? "",
    name: asString(raw.name) ?? "",
    description: asString(raw.description),
    basePrice,
    isActive,
    statusLabel: isActive ? "Aktif" : "Pasif",
    basePriceLabel: formatNumberLabel("Varsayılan fiyat", basePrice),
    createdAt: asString(raw.created_at),
    updatedAt: asString(raw.updated_at),
  };
}

export function upsertAdminCatalogServiceRow(
  rows: AdminCatalogServiceRow[],
  raw: unknown,
): AdminCatalogServiceRow[] {
  const nextRow = buildAdminCatalogServiceRow(isRecord(raw) ? raw : {});
  return upsertByIdentity(rows, nextRow).sort(compareServices);
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function upsertByIdentity<T extends { id: string; code: string }>(
  rows: T[],
  nextRow: T,
): T[] {
  let replaced = false;
  const nextRows = rows.map((row) => {
    if (row.id === nextRow.id || row.code === nextRow.code) {
      replaced = true;
      return nextRow;
    }
    return row;
  });

  if (!replaced) {
    nextRows.push(nextRow);
  }

  return nextRows;
}

function compareMainItems(
  left: AdminCatalogMainItemRow,
  right: AdminCatalogMainItemRow,
): number {
  const orderDiff = left.sortOrder - right.sortOrder;
  if (orderDiff !== 0) {
    return orderDiff;
  }
  return left.code.localeCompare(right.code);
}

function compareServices(
  left: AdminCatalogServiceRow,
  right: AdminCatalogServiceRow,
): number {
  return left.code.localeCompare(right.code);
}

function formatNumberLabel(prefix: string, value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return `${prefix}: Belirtilmedi`;
  }
  return `${prefix}: ${String(value)}`;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
