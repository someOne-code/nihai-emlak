export type ResolvePayloadServerURLInput = {
  nodeEnv: string | null | undefined;
  publicSiteUrl: string | null | undefined;
  siteUrl: string | null | undefined;
};

export function resolvePayloadServerURL(input: ResolvePayloadServerURLInput): string {
  const nodeEnv = typeof input.nodeEnv === "string" ? input.nodeEnv.toLowerCase() : "";
  const configuredURL = asNonEmptyString(input.siteUrl) ?? asNonEmptyString(input.publicSiteUrl);
  const isDevOrTest = nodeEnv === "development" || nodeEnv === "test";

  if (!configuredURL) {
    if (isDevOrTest) {
      return "http://localhost:3000";
    }

    throw new Error("SITE_URL or NEXT_PUBLIC_SITE_URL must be configured outside development/test");
  }

  return normalizeHttpOrigin(configuredURL);
}

function normalizeHttpOrigin(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("SITE_URL or NEXT_PUBLIC_SITE_URL must be an absolute URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("SITE_URL or NEXT_PUBLIC_SITE_URL must use http or https");
  }

  if (parsed.username || parsed.password) {
    throw new Error("SITE_URL or NEXT_PUBLIC_SITE_URL must not include credentials");
  }

  return parsed.origin;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return value.trim();
}
