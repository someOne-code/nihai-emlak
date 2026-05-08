import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { buildSystemHealthViewModel } from "../lib/admin-ui/system-view-model.ts";

const repoRoot = resolve(import.meta.dirname, "..");

test("system health view model uses Turkish admin-facing copy", () => {
  const viewModel = buildSystemHealthViewModel({
    chatwoot: {
      status: "ready",
      missing: [],
      invalid: [],
      checks: [
        { name: "CHATWOOT_BASE_URL", ok: true },
        { name: "CHATWOOT_ACCOUNT_ID", ok: true },
      ],
    },
    inngest: {
      status: "missing",
      missing: ["INNGEST_EVENT_KEY"],
      invalid: [],
      checks: [{ name: "INNGEST_EVENT_KEY", ok: false }],
    },
    supabaseDatabase: {
      status: "degraded",
      missing: [],
      invalid: [],
      checks: [{ name: "SUPABASE_DB_READINESS", ok: false }],
    },
    payload: {
      status: "ready",
      missing: [],
      invalid: [],
      checks: [{ name: "PAYLOAD_PREFLIGHT", ok: true }],
    },
    storage: {
      status: "ready",
      missing: [],
      invalid: [],
      checks: [{ name: "content-media", ok: true }],
    },
    payment: {
      status: "ready",
      missing: [],
      invalid: [],
      checks: [
        { name: "ISBANK_CLIENT_ID", ok: true },
        { name: "ISBANK_STORE_KEY", ok: true },
      ],
      lastCallbackAt: "2026-05-08T08:15:00.000Z",
      lastEvent: {
        eventType: "isbank_callback_failed",
        provider: "isbank",
        createdAt: "2026-05-08T08:15:00.000Z",
      },
    },
  });

  assert.equal(viewModel.services.length, 6);
  assert.equal(viewModel.services[0]?.description, "Müşteri iletişimi hazırlığı");
  assert.equal(viewModel.services[0]?.statusLabel, "Hazır");
  assert.equal(viewModel.services[0]?.checks[0]?.label, "Temel URL");
  assert.equal(viewModel.services[0]?.checks[1]?.label, "Hesap ID");
  assert.equal(viewModel.services[1]?.description, "Arka plan olayları hazırlığı");
  assert.equal(viewModel.services[1]?.statusLabel, "Eksik");
  assert.equal(viewModel.services[1]?.checks[0]?.label, "Olay anahtarı");
  assert.equal(viewModel.services[2]?.title, "Supabase DB");
  assert.equal(viewModel.services[2]?.statusLabel, "Sınırlı");
  assert.equal(viewModel.services[2]?.checks[0]?.label, "Veritabanı erişimi");
  assert.equal(viewModel.services[3]?.title, "Payload CMS");
  assert.equal(viewModel.services[3]?.checks[0]?.label, "Koleksiyon preflight");
  assert.equal(viewModel.services[4]?.title, "Supabase Storage");
  assert.equal(viewModel.services[4]?.checks[0]?.label, "content-media bucket");
  assert.equal(viewModel.services[5]?.title, "İş Bankası");
  assert.equal(viewModel.services[5]?.checks[0]?.label, "Mağaza istemci ID");
  assert.equal(viewModel.services[5]?.lastEventLabel, "isbank_callback_failed");
  assert.equal(viewModel.services[5]?.lastCallbackLabel, "2026-05-08T08:15:00.000Z");
});

test("system health page source keeps visible admin copy Turkish", () => {
  const source = readFileSync(
    resolve(repoRoot, "components/admin-system/SystemHealthView.tsx"),
    "utf8",
  );

  assert.match(source, /Sistem Sağlığı/);
  assert.match(source, /Servisler/);
  assert.match(source, /Yenile/);
  assert.match(source, /Yapılandırıldı/);
  assert.match(source, /Kurulum gerekli/);
  assert.doesNotMatch(
    source,
    /"System Health"|"Services"|"Refresh"|"Configured"|"Needs setup"|"Health check failed"|>Loading</,
  );
});
