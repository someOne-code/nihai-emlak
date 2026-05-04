import assert from "node:assert/strict";
import test from "node:test";

import { ADMIN_SIDEBAR_LINKS } from "../components/admin-shell/admin-shell-nav.ts";
import {
  ADMIN_DASHBOARD_ACTION_CARDS,
  buildAdminDashboardMetricCards,
} from "../lib/admin-ui/dashboard-view-model.ts";

test("admin dashboard exposes exactly three primary action cards", () => {
  assert.equal(ADMIN_DASHBOARD_ACTION_CARDS.length, 3);
});

test("admin dashboard action cards target the listings, operations, and CMS sections", () => {
  assert.deepEqual(
    ADMIN_DASHBOARD_ACTION_CARDS.map((card) => ({
      title: card.title,
      href: card.href,
    })),
    [
      { title: "İlan Yönetimi", href: "/admin/listings" },
      { title: "Operasyonlar", href: "/admin/operations" },
      { title: "CMS İçerik Yönetimi", href: "/cms" },
    ],
  );
});

test("admin dashboard action cards always carry a non-empty description and CTA label", () => {
  for (const card of ADMIN_DASHBOARD_ACTION_CARDS) {
    assert.ok(
      card.description.trim().length > 0,
      `${card.title} action card must include a description`,
    );
    assert.ok(
      card.ctaLabel.trim().length > 0,
      `${card.title} action card must include a CTA label`,
    );
  }
});

test("admin dashboard action card hrefs stay aligned with the shared sidebar nav contract", () => {
  const sidebarHrefs = new Set(ADMIN_SIDEBAR_LINKS.map((link) => link.href));
  for (const card of ADMIN_DASHBOARD_ACTION_CARDS) {
    assert.ok(
      sidebarHrefs.has(card.href),
      `action card target ${card.href} must also be reachable from the sidebar`,
    );
  }
});

test("dashboard metric cards map summary counts to Turkish card labels and target routes", () => {
  const cards = buildAdminDashboardMetricCards({
    listingTotal: 12,
    listingActive: 8,
    listingPassive: 4,
    listingWithoutImages: 3,
    rentListingsNotCheckoutReady: 2,
    pendingReservations: 5,
    failedOrConflictPayments: 1,
    manualResolutionRequired: 0,
    communicationItems: null,
  });

  assert.deepEqual(
    cards.map((card) => ({
      title: card.title,
      valueText: card.valueText,
      href: card.href,
    })),
    [
      { title: "Toplam İlan", valueText: "12", href: "/admin/listings" },
      { title: "Aktif İlan", valueText: "8", href: "/admin/listings" },
      { title: "Pasif İlan", valueText: "4", href: "/admin/listings" },
      { title: "Görselsiz İlan", valueText: "3", href: "/admin/listings" },
      {
        title: "Checkout Hazır Değil",
        valueText: "2",
        href: "/admin/listings",
      },
      {
        title: "Bekleyen Rezervasyon",
        valueText: "5",
        href: "/admin/operations",
      },
      {
        title: "Ödeme Sorunu",
        valueText: "1",
        href: "/admin/operations",
      },
      {
        title: "Manuel İnceleme",
        valueText: "0",
        href: "/admin/operations",
      },
    ],
  );
});

test("dashboard metric cards render null metrics as Alınamadı instead of inventing numbers", () => {
  const cards = buildAdminDashboardMetricCards({
    listingTotal: 12,
    listingActive: null,
    listingPassive: 4,
    listingWithoutImages: null,
    rentListingsNotCheckoutReady: null,
    pendingReservations: 5,
    failedOrConflictPayments: null,
    manualResolutionRequired: null,
    communicationItems: null,
  });

  assert.deepEqual(
    cards.map((card) => card.valueText),
    ["12", "Alınamadı", "4", "Alınamadı", "Alınamadı", "5", "Alınamadı", "Alınamadı"],
  );
});

test("dashboard metric cards do not render communication metric when safe backend read model is unavailable", () => {
  const cards = buildAdminDashboardMetricCards({
    listingTotal: 12,
    listingActive: 8,
    listingPassive: 4,
    listingWithoutImages: 3,
    rentListingsNotCheckoutReady: 2,
    pendingReservations: 5,
    failedOrConflictPayments: 1,
    manualResolutionRequired: 0,
    communicationItems: null,
  });

  assert.equal(cards.some((card) => card.title.includes("İletişim")), false);
});

test("dashboard metric cards expose non-empty Turkish descriptions and CTA labels", () => {
  const cards = buildAdminDashboardMetricCards({
    listingTotal: 12,
    listingActive: 8,
    listingPassive: 4,
    listingWithoutImages: 3,
    rentListingsNotCheckoutReady: 2,
    pendingReservations: 5,
    failedOrConflictPayments: 1,
    manualResolutionRequired: 0,
    communicationItems: null,
  });

  for (const card of cards) {
    assert.ok(card.title.trim().length > 0);
    assert.ok(card.description.trim().length > 0);
    assert.ok(card.ctaLabel.trim().length > 0);
    assert.ok(card.href.startsWith("/admin"));
  }
});

test("admin dashboard action and metric card contracts remain frozen", () => {
  assert.ok(Object.isFrozen(ADMIN_DASHBOARD_ACTION_CARDS));
  assert.ok(
    Object.isFrozen(
      buildAdminDashboardMetricCards({
        listingTotal: 12,
        listingActive: 8,
        listingPassive: 4,
        listingWithoutImages: 3,
        rentListingsNotCheckoutReady: 2,
        pendingReservations: 5,
        failedOrConflictPayments: 1,
        manualResolutionRequired: 0,
        communicationItems: null,
      }),
    ),
  );
});
