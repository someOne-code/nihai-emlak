import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { ADMIN_SIDEBAR_ITEMS } from "../components/admin-shell/admin-shell-nav.ts";

const repoRoot = resolve(import.meta.dirname, "..");

test("admin sidebar exposes clear visual hierarchy groups", () => {
  const groups = ADMIN_SIDEBAR_ITEMS.map((item) => ({
    kind: item.kind,
    label: item.label,
    children: item.kind === "section" ? item.children.map((child) => child.label) : [],
  }));

  assert.deepEqual(groups, [
    {
      kind: "section",
      label: "Genel",
      children: ["Kontrol Paneli", "İlanlar", "Operasyonlar"],
    },
    {
      kind: "section",
      label: "İçerik",
      children: ["Blog Yazıları", "Blog Kategorileri", "Danışmanlar"],
    },
    {
      kind: "section",
      label: "Yönetim",
      children: [
        "Adminler",
        "İletişim",
        "Satış Leadleri",
        "Fiyat Kataloğu",
        "Sistem Sağlığı",
      ],
    },
  ]);
});

test("admin sidebar links and sections carry icon names for visual scanning", () => {
  for (const item of ADMIN_SIDEBAR_ITEMS) {
    assert.equal(item.kind, "section");
    assert.equal(typeof item.icon, "string");
    assert.ok(item.icon.length > 0);

    if (item.kind === "section") {
      for (const child of item.children) {
        assert.equal(typeof child.icon, "string");
        assert.ok(child.icon.length > 0);
      }
    }
  }
});

test("admin sidebar component renders hierarchy affordances and shadcn mobile close button", () => {
  const source = readFileSync(
    resolve(repoRoot, "components/admin-shell/AdminSidebar.tsx"),
    "utf8",
  );

  assert.match(source, /from "@\/components\/ui\/button"/);
  assert.match(source, /from "@\/components\/ui\/separator"/);
  assert.match(source, /data-icon="inline-start"/);
  assert.match(source, /renderSidebarSection/);
  assert.match(source, /border-l/);
  assert.match(source, /aria-label="Aktif sayfa"/);
});
