import assert from "node:assert/strict";
import test from "node:test";

import {
  toAdminDashboardMetricCards,
  type AdminDashboardSummaryDto,
} from "../lib/admin-ui/dashboard-summary-view-model.ts";

test("summary DTO numbers map to metric cards in correct order", () => {
  const dto: AdminDashboardSummaryDto = {
    listingTotal: 12,
    listingActive: 8,
    listingPassive: 4,
    listingWithoutImages: 3,
    rentListingsNotCheckoutReady: 2,
    pendingReservations: 5,
    failedOrConflictPayments: 1,
    manualResolutionRequired: 0,
    communicationItems: null,
  };

  const cards = toAdminDashboardMetricCards(dto);

  assert.equal(cards.length, 8);
  assert.equal(cards[0].title, "Toplam İlan");
  assert.equal(cards[0].value, "12");
  assert.equal(cards[1].title, "Aktif İlan");
  assert.equal(cards[1].value, "8");
  assert.equal(cards[2].title, "Pasif İlan");
  assert.equal(cards[2].value, "4");
  assert.equal(cards[3].title, "Görselsiz İlan");
  assert.equal(cards[3].value, "3");
  assert.equal(cards[4].title, "Checkout Hazır Değil");
  assert.equal(cards[4].value, "2");
  assert.equal(cards[5].title, "Bekleyen Rezervasyon");
  assert.equal(cards[5].value, "5");
  assert.equal(cards[6].title, "Ödeme Sorunu");
  assert.equal(cards[6].value, "1");
  assert.equal(cards[7].title, "Manuel İnceleme");
  assert.equal(cards[7].value, "0");
});

test("null values display as Alınamadı instead of faking numbers", () => {
  const dto: AdminDashboardSummaryDto = {
    listingTotal: null,
    listingActive: null,
    listingPassive: null,
    listingWithoutImages: null,
    rentListingsNotCheckoutReady: null,
    pendingReservations: null,
    failedOrConflictPayments: null,
    manualResolutionRequired: null,
    communicationItems: null,
  };

  const cards = toAdminDashboardMetricCards(dto);

  for (const card of cards) {
    assert.equal(card.value, "Alınamadı", `${card.title} should show fallback`);
  }
});

test("listing metric cards link to /admin/listings", () => {
  const dto: AdminDashboardSummaryDto = {
    listingTotal: 1,
    listingActive: 1,
    listingPassive: 0,
    listingWithoutImages: 0,
    rentListingsNotCheckoutReady: 0,
    pendingReservations: 0,
    failedOrConflictPayments: 0,
    manualResolutionRequired: 0,
    communicationItems: null,
  };

  const cards = toAdminDashboardMetricCards(dto);

  for (const card of cards) {
    if (card.title.startsWith("Toplam") || card.title.startsWith("Aktif") || card.title.startsWith("Pasif") || card.title.startsWith("Görselsiz") || card.title.startsWith("Checkout")) {
      assert.equal(card.href, "/admin/listings", `${card.title} href`);
    }
  }
});

test("reservation payment and manual metric cards link to /admin/operations", () => {
  const dto: AdminDashboardSummaryDto = {
    listingTotal: 0,
    listingActive: 0,
    listingPassive: 0,
    listingWithoutImages: 0,
    rentListingsNotCheckoutReady: 0,
    pendingReservations: 1,
    failedOrConflictPayments: 1,
    manualResolutionRequired: 1,
    communicationItems: null,
  };

  const cards = toAdminDashboardMetricCards(dto);

  const opsCards = cards.filter(
    (c) =>
      c.title === "Bekleyen Rezervasyon" ||
      c.title === "Ödeme Sorunu" ||
      c.title === "Manuel İnceleme",
  );

  for (const card of opsCards) {
    assert.equal(card.href, "/admin/operations", `${card.title} href`);
  }
});

test("metric card titles are Turkish", () => {
  const dto: AdminDashboardSummaryDto = {
    listingTotal: 1,
    listingActive: 1,
    listingPassive: 1,
    listingWithoutImages: 1,
    rentListingsNotCheckoutReady: 1,
    pendingReservations: 1,
    failedOrConflictPayments: 1,
    manualResolutionRequired: 1,
    communicationItems: null,
  };

  const cards = toAdminDashboardMetricCards(dto);
  const titles = cards.map((c) => c.title);

  assert.ok(titles.includes("Toplam İlan"));
  assert.ok(titles.includes("Aktif İlan"));
  assert.ok(titles.includes("Pasif İlan"));
  assert.ok(titles.includes("Görselsiz İlan"));
  assert.ok(titles.includes("Checkout Hazır Değil"));
  assert.ok(titles.includes("Bekleyen Rezervasyon"));
  assert.ok(titles.includes("Ödeme Sorunu"));
  assert.ok(titles.includes("Manuel İnceleme"));
});

test("metric card array is frozen", () => {
  const dto: AdminDashboardSummaryDto = {
    listingTotal: 1,
    listingActive: 1,
    listingPassive: 1,
    listingWithoutImages: 1,
    rentListingsNotCheckoutReady: 1,
    pendingReservations: 1,
    failedOrConflictPayments: 1,
    manualResolutionRequired: 1,
    communicationItems: null,
  };

  const cards = toAdminDashboardMetricCards(dto);
  assert.ok(Object.isFrozen(cards));
});
