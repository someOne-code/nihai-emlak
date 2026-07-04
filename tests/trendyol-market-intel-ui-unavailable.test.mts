import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  getTrendyolMarketIntelFieldPresentation,
  TRENDYOL_SIGNAL_UNAVAILABLE_COPY,
} from "../components/admin-trendyol-market-intel/signal-presentation.ts";

const repoRoot = resolve(import.meta.dirname, "..");

test("Trendyol signal presentation distinguishes unavailable source fields from parsed zero values", () => {
  assert.deepEqual(getTrendyolMarketIntelFieldPresentation({ value: null }), {
    tone: "unavailable",
    label: TRENDYOL_SIGNAL_UNAVAILABLE_COPY,
    description: "Trendyol did not expose this public signal for the latest snapshot.",
  });

  assert.deepEqual(getTrendyolMarketIntelFieldPresentation({ value: undefined }), {
    tone: "unavailable",
    label: TRENDYOL_SIGNAL_UNAVAILABLE_COPY,
    description: "Trendyol did not expose this public signal for the latest snapshot.",
  });

  assert.deepEqual(getTrendyolMarketIntelFieldPresentation({ value: 0 }), {
    tone: "value",
    label: "0",
    description: null,
  });
});

test("Trendyol signal presentation preserves parsed false instead of treating it as blank", () => {
  assert.deepEqual(getTrendyolMarketIntelFieldPresentation({ value: false }), {
    tone: "value",
    label: "No",
    description: null,
  });

  assert.deepEqual(getTrendyolMarketIntelFieldPresentation({ value: true }), {
    tone: "value",
    label: "Yes",
    description: null,
  });
});

test("Trendyol signal presentation shows parser failures distinctly", () => {
  assert.deepEqual(
    getTrendyolMarketIntelFieldPresentation({
      value: null,
      parserError: "sales badge did not match known Trendyol formats",
    }),
    {
      tone: "error",
      label: "Parser failed",
      description: "sales badge did not match known Trendyol formats",
    },
  );
});

test("Trendyol signal card explains unavailable public signals without blank dash placeholders", () => {
  const source = readFileSync(
    resolve(repoRoot, "components/admin-trendyol-market-intel/TrendyolSignalCard.tsx"),
    "utf8",
  );

  assert.match(source, /Some public signals are not exposed by Trendyol/);
  assert.doesNotMatch(source, />\s*-\s*</);
  assert.match(source, /Parser failed/);
});
