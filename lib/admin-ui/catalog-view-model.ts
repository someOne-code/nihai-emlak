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
  fixed: "Sabit Tutar",
  listing_price_multiplier: "İlan Fiyatı Çarpanı",
  stay_months_multiplier: "Konaklama Ayı Çarpanı",
};

// Short human explanations shown in the form help text.
export const PRICING_STRATEGY_DESCRIPTIONS: Record<string, string> = {
  fixed: "İlan fiyatından bağımsız, katalogda girilen sabit TRY tutarı tahsil edilir.",
  listing_price_multiplier:
    "İlan fiyatı × çarpan. Örn. çarpan 1.0 → kira bedeli, 0.5 → yarı tutar.",
  stay_months_multiplier:
    "Konaklama ay sayısı × çarpan. Örn. çarpan 1000 TRY, 3 ay konaklama = 3.000 TRY.",
};

// Longer human explanations used for the (i) tooltip/popover on each strategy.
export const PRICING_STRATEGY_LONG_DESCRIPTIONS: Record<string, string> = {
  fixed:
    "Sabit Tutar: Müşteriden her zaman tam olarak girdiğin TRY tutarı tahsil edilir. " +
    "İlan fiyatı, konaklama süresi ya da başka bir şey bu tutarı değiştirmez. " +
    "Örnek: 5.000 TRY depozito — müşteri 10.000 TL de 50.000 TL de ilanda konaklasa 5.000 TL öder.",
  listing_price_multiplier:
    "İlan Fiyatı Çarpanı: Müşteriden tahsil edilen tutar, ilanın kendi fiyatıyla orantılıdır. " +
    "Formül: ilan fiyatı × çarpan. " +
    "Örnek: Kira kalemi için çarpan 1.0 girersen 15.000 TL'lik ilan 15.000 TL, 25.000 TL'lik ilan 25.000 TL tahsil edilir. " +
    "Komisyon için çarpan 0.10 girersen her ilanda fiyatın %10'u alınır.",
  stay_months_multiplier:
    "Konaklama Ayı Çarpanı: Müşteriden tahsil edilen tutar, checkout'ta seçtiği ay sayısıyla orantılıdır. " +
    "Formül: kalacak ay sayısı × çarpan. " +
    "Örnek: Aylık aidat için çarpan 500 girersen 3 ay kalan 1.500 TL, 6 ay kalan 3.000 TL öder.",
};

// Generic tooltip for the "Fiyat Stratejisi" field label itself.
export const PRICING_STRATEGY_FIELD_HELP =
  "Bu kalemden müşteriye kesilecek tutarın nasıl hesaplanacağını belirler. " +
  "Her stratejinin yanındaki (i) ikonuna gelerek ayrıntıyı görebilirsin.";

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

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

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
