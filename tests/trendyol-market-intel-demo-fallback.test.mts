import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  loadTrendyolMarketIntelDemoFallback,
  resolveTrendyolMarketIntelDataMode,
} from "../lib/trendyol/market-intel-demo-fallback.ts";

test("Trendyol demo data mode keeps Supabase as production default", () => {
  assert.equal(
    resolveTrendyolMarketIntelDataMode({
      nodeEnv: "production",
      explicitMode: undefined,
      supabaseUrl: undefined,
      supabasePublishableKey: undefined,
    }),
    "supabase",
  );

  assert.equal(
    resolveTrendyolMarketIntelDataMode({
      nodeEnv: "production",
      explicitMode: "json",
      supabaseUrl: undefined,
      supabasePublishableKey: undefined,
    }),
    "supabase",
  );
});

test("Trendyol demo data mode uses json fallback outside production when Supabase env is absent", () => {
  assert.equal(
    resolveTrendyolMarketIntelDataMode({
      nodeEnv: "development",
      explicitMode: undefined,
      supabaseUrl: undefined,
      supabasePublishableKey: undefined,
    }),
    "json",
  );

  assert.equal(
    resolveTrendyolMarketIntelDataMode({
      nodeEnv: "test",
      explicitMode: "supabase",
      supabaseUrl: undefined,
      supabasePublishableKey: undefined,
    }),
    "supabase",
  );
});

test("Trendyol JSON demo fallback reads sanitized product rows without Docker or Supabase", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "trendyol-demo-"));
  const fixturePath = path.join(tmpDir, "market-intel.json");

  await writeFile(
    fixturePath,
    JSON.stringify({
      products: [
        {
          id: "snap-1",
          title: "  Kadife Koltuk  ",
          sellerName: "Ada Mobilya",
          productUrl: "https://www.trendyol.com/ada/kadife-koltuk-p-1",
          price: 12999.9,
          currency: "TRY",
          inStock: true,
          observedAt: "2026-05-20T10:00:00.000Z",
          rawPayload: { ignored: true },
        },
        {
          title: "",
          productUrl: "https://not-trendyol.example/product",
        },
      ],
    }),
    "utf8",
  );

  try {
    const result = await loadTrendyolMarketIntelDemoFallback({ fixturePath });

    assert.deepEqual(result.products, [
      {
        id: "snap-1",
        title: "Kadife Koltuk",
        sellerName: "Ada Mobilya",
        productUrl: "https://www.trendyol.com/ada/kadife-koltuk-p-1",
        price: 12999.9,
        currency: "TRY",
        inStock: true,
        observedAt: "2026-05-20T10:00:00.000Z",
      },
    ]);
    assert.equal(result.source, fixturePath);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("Trendyol JSON demo fallback bootstraps the default fixture when missing", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "trendyol-demo-bootstrap-"));
  const fixturePath = path.join(tmpDir, "nested", "market-intel.json");

  try {
    const result = await loadTrendyolMarketIntelDemoFallback({ fixturePath });
    const fixture = JSON.parse(await readFile(fixturePath, "utf8")) as { products: unknown[] };

    assert.ok(result.products.length >= 1);
    assert.ok(fixture.products.length >= 1);
    assert.match(result.products[0]?.productUrl ?? "", /^https:\/\/www\.trendyol\.com\//);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});
