import { buildIsbankSha1Input, sha1Upper } from "./isbank.ts";

export type BuildIsbankCheckoutPayloadInput = {
  amount: number;
  clientId: string;
  currency: string;
  failUrl: string;
  okUrl: string;
  paymentId: string;
  rnd: string;
  storeKey: string;
};

export type IsbankHostedCheckoutPayload = {
  HASH: string;
  amount: string;
  clientid: string;
  currency: string;
  failurl: string;
  instalment: string;
  oid: string;
  okurl: string;
  rnd: string;
  txnType: string;
};

export type CheckoutInitRequestBody = {
  orderId: string;
};

export function buildIsbankHostedCheckoutPayload(
  input: BuildIsbankCheckoutPayloadInput,
): IsbankHostedCheckoutPayload {
  const payload = {
    amount: normalizeAmount(input.amount),
    clientid: input.clientId,
    currency: input.currency.toUpperCase(),
    failurl: input.failUrl,
    instalment: "0",
    oid: input.paymentId,
    okurl: input.okUrl,
    rnd: input.rnd,
    txnType: "Auth",
  };

  return {
    ...payload,
    HASH: sha1Upper(buildIsbankSha1Input(payload, normalizeStoreKey(input.storeKey))),
  };
}

export function parseCheckoutInitRequestBody(
  payload: unknown,
): { ok: true; body: CheckoutInitRequestBody } | { ok: false; status: number; error: string } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      ok: false,
      status: 400,
      error: "Invalid checkout init request body",
    };
  }

  const orderId = asNonEmptyString((payload as Record<string, unknown>).orderId);
  if (!orderId || !isUuid(orderId)) {
    return {
      ok: false,
      status: 400,
      error: "orderId must be a UUID",
    };
  }

  return {
    ok: true,
    body: { orderId },
  };
}

export function buildCheckoutReturnUrls(
  siteUrl: string | null | undefined,
): { okUrl: string; failUrl: string } {
  const origin = normalizeCheckoutSiteUrl(siteUrl);
  return {
    okUrl: `${origin}/checkout/success`,
    failUrl: `${origin}/checkout/fail`,
  };
}

export function resolveCheckoutInitReturnUrlsFromEnvironment(input: {
  nodeEnv: string | null | undefined;
  preferredOrigin?: string | null | undefined;
  siteUrl: string | null | undefined;
  publicSiteUrl: string | null | undefined;
  vercelUrl?: string | null | undefined;
}): 
  | { ok: true; returnUrls: { okUrl: string; failUrl: string } }
  | { ok: false; status: number; error: string } {
  const nodeEnv = typeof input.nodeEnv === "string" ? input.nodeEnv.toLowerCase() : "";
  const isDevOrTest = nodeEnv === "development" || nodeEnv === "test";
  const hasPrivateSiteUrl = Boolean(asNonEmptyString(input.siteUrl));
  const hasPublicSiteUrl = Boolean(asNonEmptyString(input.publicSiteUrl));
  const normalizedVercelUrl = normalizeVercelUrl(input.vercelUrl);
  const normalizedPreferredOrigin = normalizeHttpOrigin(input.preferredOrigin);

  if (!isDevOrTest && !hasPrivateSiteUrl && !hasPublicSiteUrl) {
    return {
      ok: false,
      status: 500,
      error: "SITE_URL or NEXT_PUBLIC_SITE_URL must be configured outside development/test",
    };
  }

  const configuredSiteUrl = (
    hasPrivateSiteUrl
      ? input.siteUrl
      : hasPublicSiteUrl
        ? input.publicSiteUrl
        : normalizedVercelUrl ?? "http://localhost:3000"
  ) as string;
  const configuredOrigins = [
    normalizeHttpOrigin(input.siteUrl),
    normalizeHttpOrigin(input.publicSiteUrl),
    ...(isDevOrTest ? [normalizeHttpOrigin(normalizedVercelUrl)] : []),
  ].filter((value): value is string => value !== null);
  const selectedSiteUrl = normalizedPreferredOrigin && (
    configuredOrigins.includes(normalizedPreferredOrigin)
    || (isDevOrTest && configuredOrigins.length === 0)
  )
    ? applyTrustedOriginToConfiguredSiteUrl(configuredSiteUrl, normalizedPreferredOrigin)
    : configuredSiteUrl;

  try {
    return {
      ok: true,
      returnUrls: buildCheckoutReturnUrls(selectedSiteUrl),
    };
  } catch {
    return {
      ok: false,
      status: 500,
      error: "Checkout return URL configuration is invalid",
    };
  }
}

function normalizeAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("amount must be a non-negative finite number");
  }

  return amount.toFixed(2);
}

function normalizeStoreKey(storeKey: string): string {
  if (typeof storeKey !== "string" || storeKey.trim().length === 0) {
    throw new Error("storeKey must be a non-empty string");
  }

  return storeKey.trim();
}

function normalizeCheckoutSiteUrl(siteUrl: string | null | undefined): string {
  const trimmed = typeof siteUrl === "string" ? siteUrl.trim() : "";
  if (trimmed.length === 0) {
    throw new Error("SITE_URL or NEXT_PUBLIC_SITE_URL must be configured");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("SITE_URL/NEXT_PUBLIC_SITE_URL must be an absolute URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("SITE_URL/NEXT_PUBLIC_SITE_URL must use http or https");
  }

  const normalizedPath = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, "");
  return `${parsed.origin}${normalizedPath}`;
}

function normalizeVercelUrl(value: string | null | undefined): string | null {
  const normalized = asNonEmptyString(value);
  if (!normalized) {
    return null;
  }

  return normalized.includes("://") ? normalized : `https://${normalized}`;
}

function normalizeHttpOrigin(value: string | null | undefined): string | null {
  const normalized = asNonEmptyString(value);
  if (!normalized) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  if (parsed.username || parsed.password) {
    return null;
  }

  return parsed.origin;
}

function applyTrustedOriginToConfiguredSiteUrl(
  configuredSiteUrl: string,
  trustedOrigin: string,
): string {
  const configured = new URL(normalizeCheckoutSiteUrl(configuredSiteUrl));
  const trusted = new URL(trustedOrigin);
  configured.protocol = trusted.protocol;
  configured.host = trusted.host;
  return configured.toString();
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return value.trim();
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
