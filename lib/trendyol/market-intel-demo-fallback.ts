import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type TrendyolMarketIntelDataMode = "supabase" | "json";

export type TrendyolMarketIntelDemoProduct = {
  id: string;
  title: string;
  sellerName: string | null;
  productUrl: string;
  price: number | null;
  currency: string;
  inStock: boolean | null;
  observedAt: string;
};

export type TrendyolMarketIntelDemoFallback = {
  source: string;
  products: TrendyolMarketIntelDemoProduct[];
};

type ResolveDataModeInput = {
  nodeEnv?: string;
  explicitMode?: string;
  supabaseUrl?: string;
  supabasePublishableKey?: string;
};

type LoadDemoFallbackInput = {
  fixturePath?: string;
};

const DEFAULT_FIXTURE_PATH = path.join(
  process.cwd(),
  "tmp",
  "trendyol-market-intel-demo.json",
);

const DEFAULT_FIXTURE = {
  products: [
    {
      id: "demo-trendyol-sofa",
      title: "Demo Kadife Koltuk",
      sellerName: "Demo Mobilya",
      productUrl: "https://www.trendyol.com/demo/kadife-koltuk-p-1",
      price: 12999.9,
      currency: "TRY",
      inStock: true,
      observedAt: "2026-05-20T10:00:00.000Z",
    },
  ],
};

export function resolveTrendyolMarketIntelDataMode(
  input: ResolveDataModeInput = {},
): TrendyolMarketIntelDataMode {
  if (input.nodeEnv === "production") {
    return "supabase";
  }

  if (input.explicitMode === "supabase" || input.explicitMode === "json") {
    return input.explicitMode;
  }

  if (hasText(input.supabaseUrl) && hasText(input.supabasePublishableKey)) {
    return "supabase";
  }

  return "json";
}

export async function loadTrendyolMarketIntelDemoFallback(
  input: LoadDemoFallbackInput = {},
): Promise<TrendyolMarketIntelDemoFallback> {
  const fixturePath = input.fixturePath ?? DEFAULT_FIXTURE_PATH;
  const payload = await readFixtureOrBootstrap(fixturePath);

  return {
    source: fixturePath,
    products: normalizeProducts(payload),
  };
}

async function readFixtureOrBootstrap(fixturePath: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(fixturePath, "utf8"));
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error;
    }

    await mkdir(path.dirname(fixturePath), { recursive: true });
    await writeFile(fixturePath, `${JSON.stringify(DEFAULT_FIXTURE, null, 2)}\n`, "utf8");
    return DEFAULT_FIXTURE;
  }
}

function normalizeProducts(payload: unknown): TrendyolMarketIntelDemoProduct[] {
  if (!isRecord(payload) || !Array.isArray(payload.products)) {
    return [];
  }

  return payload.products
    .map(normalizeProduct)
    .filter((product): product is TrendyolMarketIntelDemoProduct => product !== null);
}

function normalizeProduct(input: unknown): TrendyolMarketIntelDemoProduct | null {
  if (!isRecord(input)) {
    return null;
  }

  const title = normalizeText(input.title);
  const productUrl = normalizeText(input.productUrl);

  if (!title || !isAllowedTrendyolUrl(productUrl)) {
    return null;
  }

  return {
    id: normalizeText(input.id) || stableDemoId(productUrl),
    title,
    sellerName: normalizeText(input.sellerName) || null,
    productUrl,
    price: normalizePrice(input.price),
    currency: normalizeText(input.currency) || "TRY",
    inStock: typeof input.inStock === "boolean" ? input.inStock : null,
    observedAt: normalizeIsoDate(input.observedAt) ?? new Date(0).toISOString(),
  };
}

function normalizeText(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}

function normalizePrice(input: unknown): number | null {
  if (typeof input !== "number" || !Number.isFinite(input) || input < 0) {
    return null;
  }

  return input;
}

function normalizeIsoDate(input: unknown): string | null {
  const text = normalizeText(input);
  const date = new Date(text);

  return text && Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function isAllowedTrendyolUrl(input: string): boolean {
  try {
    const url = new URL(input);
    return url.protocol === "https:" && /(^|\.)trendyol\.com$/i.test(url.hostname);
  } catch {
    return false;
  }
}

function stableDemoId(input: string): string {
  return `demo-${Buffer.from(input).toString("base64url").slice(0, 24)}`;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function isMissingFileError(error: unknown): boolean {
  return isRecord(error) && error.code === "ENOENT";
}

function hasText(input: unknown): boolean {
  return typeof input === "string" && input.trim().length > 0;
}
