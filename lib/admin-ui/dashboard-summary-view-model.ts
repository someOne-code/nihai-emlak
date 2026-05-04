// Phase A: admin dashboard metrics view-model.
//
// Pure, framework-free helper module. Maps the admin dashboard summary
// DTO into metric cards the UI can render without knowing backend
// table names or query shapes.

export type AdminDashboardSummaryDto = {
  readonly listingTotal: number | null;
  readonly listingActive: number | null;
  readonly listingPassive: number | null;
  readonly listingWithoutImages: number | null;
  readonly rentListingsNotCheckoutReady: number | null;
  readonly pendingReservations: number | null;
  readonly failedOrConflictPayments: number | null;
  readonly manualResolutionRequired: number | null;
  readonly communicationItems: number | null;
};

export type AdminDashboardMetricCard = {
  readonly title: string;
  readonly value: string;
  readonly description: string;
  readonly href: string;
};

function formatMetricValue(value: number | null): string {
  if (value === null || typeof value !== "number") {
    return "Alınamadı";
  }
  return String(value);
}

export function toAdminDashboardMetricCards(
  dto: AdminDashboardSummaryDto,
): ReadonlyArray<AdminDashboardMetricCard> {
  return Object.freeze([
    Object.freeze({
      title: "Toplam İlan",
      value: formatMetricValue(dto.listingTotal),
      description: "Sistemdeki toplam ilan sayısı",
      href: "/admin/listings",
    }),
    Object.freeze({
      title: "Aktif İlan",
      value: formatMetricValue(dto.listingActive),
      description: "Yayında olan aktif ilan sayısı",
      href: "/admin/listings",
    }),
    Object.freeze({
      title: "Pasif İlan",
      value: formatMetricValue(dto.listingPassive),
      description: "Yayında olmayan pasif ilan sayısı",
      href: "/admin/listings",
    }),
    Object.freeze({
      title: "Görselsiz İlan",
      value: formatMetricValue(dto.listingWithoutImages),
      description: "Hiç görseli olmayan ilan sayısı",
      href: "/admin/listings",
    }),
    Object.freeze({
      title: "Checkout Hazır Değil",
      value: formatMetricValue(dto.rentListingsNotCheckoutReady),
      description: "Kiralık ilanlardan checkout hazır olmayanlar",
      href: "/admin/listings",
    }),
    Object.freeze({
      title: "Bekleyen Rezervasyon",
      value: formatMetricValue(dto.pendingReservations),
      description: "Onay bekleyen rezervasyon sayısı",
      href: "/admin/operations",
    }),
    Object.freeze({
      title: "Ödeme Sorunu",
      value: formatMetricValue(dto.failedOrConflictPayments),
      description: "Başarısız veya çakışmalı ödeme sayısı",
      href: "/admin/operations",
    }),
    Object.freeze({
      title: "Manuel İnceleme",
      value: formatMetricValue(dto.manualResolutionRequired),
      description: "Manuel operasyon incelemesi gereken durumlar",
      href: "/admin/operations",
    }),
  ]);
}
