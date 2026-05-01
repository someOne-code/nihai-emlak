import assert from "node:assert/strict";
import test from "node:test";

import { ADMIN_SIDEBAR_LINKS } from "../components/admin-shell/admin-shell-nav.ts";
import {
  ADMIN_DASHBOARD_ACTION_CARDS,
  ADMIN_DASHBOARD_STATUS_CARDS,
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

test("admin dashboard exposes between three and four status cards", () => {
  const length = ADMIN_DASHBOARD_STATUS_CARDS.length;
  assert.ok(
    length >= 3 && length <= 4,
    `expected 3-4 status cards, got ${length}`,
  );
});

test("admin dashboard status cards cover listing config, checkout readiness, operations, and content", () => {
  const titles = ADMIN_DASHBOARD_STATUS_CARDS.map((card) => card.title);
  assert.ok(titles.includes("İlan yapılandırması"));
  assert.ok(titles.includes("Checkout hazırlığı"));
  assert.ok(titles.includes("Ödeme ve rezervasyon operasyonu"));
  assert.ok(titles.includes("İçerik yönetimi"));
});

test("admin dashboard status cards never expose numeric metrics; they describe the surface and link to it", () => {
  const numberPattern = /\d/;
  for (const card of ADMIN_DASHBOARD_STATUS_CARDS) {
    assert.ok(
      card.description.trim().length > 0,
      `${card.title} status card must include a description`,
    );
    assert.ok(
      !numberPattern.test(card.description),
      `${card.title} status card description must not include numeric metrics`,
    );
    assert.ok(
      card.cta.label.trim().length > 0,
      `${card.title} status card must include a CTA label`,
    );
    assert.ok(
      card.cta.href.startsWith("/"),
      `${card.title} status card CTA must be an absolute in-app path`,
    );
  }
});

test("admin dashboard status card CTA targets stay within the documented admin and content surfaces", () => {
  const allowedPrefixes = ["/admin", "/cms"];
  for (const card of ADMIN_DASHBOARD_STATUS_CARDS) {
    assert.ok(
      allowedPrefixes.some((prefix) => card.cta.href.startsWith(prefix)),
      `${card.title} CTA href ${card.cta.href} must point at /admin or /cms`,
    );
  }
});

test("admin dashboard view-model arrays are frozen so callers cannot mutate the dashboard contract", () => {
  assert.ok(Object.isFrozen(ADMIN_DASHBOARD_ACTION_CARDS));
  assert.ok(Object.isFrozen(ADMIN_DASHBOARD_STATUS_CARDS));
});
