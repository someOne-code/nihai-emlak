// Phase 8.6 Task 4: admin listings product panel/tab contract.
//
// Pure helper module. Encapsulates the detail tab order so the
// ListingDetailTabs component, the AdminListingsView shell, and tests
// share a single source of truth without pulling React into node:test.

export type AdminListingDetailTabId =
  | "general"
  | "images"
  | "main-items"
  | "services"
  | "checkout";

export type AdminListingDetailTab = {
  readonly id: AdminListingDetailTabId;
  readonly label: string;
};

export const ADMIN_LISTING_DETAIL_TABS: ReadonlyArray<AdminListingDetailTab> =
  Object.freeze([
    Object.freeze({ id: "general", label: "Genel Bilgiler" }),
    Object.freeze({ id: "images", label: "Görseller" }),
    Object.freeze({ id: "main-items", label: "Ana Ödeme Kalemleri" }),
    Object.freeze({ id: "services", label: "Ek Hizmetler" }),
    Object.freeze({ id: "checkout", label: "Checkout Hazırlığı" }),
  ]);

export const DEFAULT_ADMIN_LISTING_DETAIL_TAB: AdminListingDetailTabId = "general";

export function getAdminListingDetailTabsForType(
  listingType: "rent" | "sale" | "unknown" | string | null | undefined,
): ReadonlyArray<AdminListingDetailTab> {
  if (listingType === "sale") {
    return ADMIN_LISTING_DETAIL_TABS.filter(
      (tab) => tab.id !== "main-items" && tab.id !== "services" && tab.id !== "checkout",
    );
  }
  return ADMIN_LISTING_DETAIL_TABS;
}

const KNOWN_TAB_IDS: ReadonlySet<AdminListingDetailTabId> = new Set(
  ADMIN_LISTING_DETAIL_TABS.map((tab) => tab.id),
);

export function resolveAdminListingDetailTab(
  value: AdminListingDetailTabId | string | undefined | null,
): AdminListingDetailTabId {
  if (typeof value !== "string" || value.length === 0) {
    return DEFAULT_ADMIN_LISTING_DETAIL_TAB;
  }
  if (KNOWN_TAB_IDS.has(value as AdminListingDetailTabId)) {
    return value as AdminListingDetailTabId;
  }
  return DEFAULT_ADMIN_LISTING_DETAIL_TAB;
}
