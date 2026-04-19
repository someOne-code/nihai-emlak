export type BuildContentSecurityPolicyInput = {
  isbankCheckoutUrl?: string | null;
  nonce: string;
  pathname: string;
  publicSiteUrl?: string | null;
  siteUrl?: string | null;
  supabaseUrl?: string | null;
};

const STATIC_BASE_DIRECTIVES = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
] as const;

const PAYLOAD_ROOT_LAYOUT_STYLE_HASH = "'sha256-UO8+f0Vt7qym1f9lUl0nh47l5M7MX3W3qSnbWSxu6+8='";

export function buildContentSecurityPolicy(input: BuildContentSecurityPolicyInput): string {
  return buildRouteContentSecurityPolicy(input);
}

function buildRouteContentSecurityPolicy(input: BuildContentSecurityPolicyInput): string {
  const nonce = normalizeNonce(input.nonce);
  const trustedHttpOrigins = collectHttpOrigins([
    input.isbankCheckoutUrl,
    input.siteUrl,
    input.publicSiteUrl,
    input.supabaseUrl,
  ]);
  const trustedWsOrigins = collectWebSocketOrigins(trustedHttpOrigins);
  const trustedFormActionOrigins = collectHttpOrigins([input.isbankCheckoutUrl]);

  const connectSrc = ["'self'", ...trustedHttpOrigins, ...trustedWsOrigins].join(" ");
  const formAction = ["'self'", ...trustedFormActionOrigins].join(" ");
  const imgSrc = ["'self'", "data:", "blob:", ...trustedHttpOrigins].join(" ");
  const fontSrc = ["'self'", "data:", ...trustedHttpOrigins].join(" ");
  const styleSrc = ["'self'", `'nonce-${nonce}'`, PAYLOAD_ROOT_LAYOUT_STYLE_HASH].join(" ");

  return [
    ...STATIC_BASE_DIRECTIVES,
    `form-action ${formAction}`,
    `img-src ${imgSrc}`,
    `font-src ${fontSrc}`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src ${styleSrc}`,
    `connect-src ${connectSrc}`,
    "frame-src 'self'",
  ].join("; ");
}

function normalizeNonce(nonce: string): string {
  const trimmed = nonce.trim();
  if (!trimmed) {
    throw new Error("CSP nonce must not be empty");
  }

  if (!/^[A-Za-z0-9+/_=-]+$/.test(trimmed)) {
    throw new Error("CSP nonce contains unsupported characters");
  }

  return trimmed;
}

function collectHttpOrigins(values: Array<string | null | undefined>): string[] {
  const origins = values
    .map(parseHttpOrigin)
    .filter((origin): origin is string => origin !== null);
  return dedupe(origins);
}

function collectWebSocketOrigins(httpOrigins: string[]): string[] {
  const wsOrigins = httpOrigins
    .map((origin) => {
      const parsed = new URL(origin);
      if (parsed.protocol === "https:") {
        return `wss://${parsed.host}`;
      }
      if (parsed.protocol === "http:") {
        return `ws://${parsed.host}`;
      }
      return null;
    })
    .filter((origin): origin is string => origin !== null);

  return dedupe(wsOrigins);
}

function parseHttpOrigin(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}
