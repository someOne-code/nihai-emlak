export type StateChangingJsonRouteConfig = {
  maxBodyBytes: number;
  routeLabel: string;
};

export type StateChangingJsonRouteResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; error: string };

export type TrustedOriginsStrategy = "all-configured" | "first-configured";

export type ResolveTrustedOriginsFromEnvironmentOptions = {
  invalidConfigError: string;
  strategy?: TrustedOriginsStrategy;
};

export function validateStateChangingJsonRequestEnvelope(
  request: Request,
  config: StateChangingJsonRouteConfig,
  options: ResolveTrustedOriginsFromEnvironmentOptions = {
    invalidConfigError: "Checkout trusted origin configuration is invalid",
  },
): { ok: true } | { ok: false; status: number; error: string } {
  if (!isJsonContentType(request.headers.get("content-type"))) {
    return {
      ok: false,
      status: 415,
      error: `${config.routeLabel} requires application/json`,
    };
  }

  const trustedOriginsResult = resolveTrustedOriginsFromEnvironment(options);
  if (!trustedOriginsResult.ok) {
    return trustedOriginsResult;
  }

  const originHeader = request.headers.get("origin");
  if (!originHeader || originHeader.trim().length === 0) {
    return {
      ok: false,
      status: 403,
      error: `${config.routeLabel} Origin header is required`,
    };
  }

  const requestOrigin = normalizeHttpOrigin(originHeader);
  if (!requestOrigin || !trustedOriginsResult.origins.includes(requestOrigin)) {
    return {
      ok: false,
      status: 403,
      error: `${config.routeLabel} Origin is not trusted`,
    };
  }

  return { ok: true };
}

export async function readStateChangingJsonRequestPayload(
  request: Request,
  config: StateChangingJsonRouteConfig,
): Promise<StateChangingJsonRouteResult<unknown>> {
  const rawBodyResult = await readStateChangingJsonRawBody(request, config);
  if (!rawBodyResult.ok) {
    return rawBodyResult;
  }

  try {
    return {
      ok: true,
      value: JSON.parse(rawBodyResult.value) as unknown,
    };
  } catch {
    return {
      ok: false,
      status: 400,
      error: "Invalid JSON request body",
    };
  }
}

async function readStateChangingJsonRawBody(
  request: Request,
  config: StateChangingJsonRouteConfig,
): Promise<StateChangingJsonRouteResult<string>> {
  if (!request.body) {
    return {
      ok: true,
      value: "",
    };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  try {
    while (true) {
      const readResult = await reader.read();
      if (readResult.done) {
        break;
      }

      byteLength += readResult.value.byteLength;
      if (byteLength > config.maxBodyBytes) {
        await reader.cancel();
        return {
          ok: false,
          status: 413,
          error: `${config.routeLabel} payload is too large`,
        };
      }

      chunks.push(readResult.value);
    }
  } catch {
    return {
      ok: false,
      status: 400,
      error: "Invalid JSON request body",
    };
  } finally {
    reader.releaseLock();
  }

  return {
    ok: true,
    value: new TextDecoder().decode(concatUint8Arrays(chunks, byteLength)),
  };
}

export function resolveTrustedOriginsFromEnvironment(
  options: ResolveTrustedOriginsFromEnvironmentOptions,
):
  | { ok: true; origins: string[] }
  | { ok: false; status: number; error: string } {
  const nodeEnv = typeof process.env.NODE_ENV === "string" ? process.env.NODE_ENV.toLowerCase() : "";
  const isDevOrTest = nodeEnv === "development" || nodeEnv === "test";
  const configuredOrigins = resolveConfiguredOrigins({
    isDevOrTest,
    strategy: options.strategy ?? "all-configured",
  });

  if (configuredOrigins.length === 0) {
    if (!isDevOrTest) {
      return {
        ok: false,
        status: 500,
        error: "SITE_URL or NEXT_PUBLIC_SITE_URL must be configured outside development/test",
      };
    }

    return {
      ok: true,
      origins: ["http://localhost:3000"],
    };
  }

  const trustedOrigins: string[] = [];
  for (const configuredOrigin of configuredOrigins) {
    const normalizedOrigin = normalizeHttpOrigin(configuredOrigin);
    if (!normalizedOrigin) {
      return {
        ok: false,
        status: 500,
        error: options.invalidConfigError,
      };
    }

    if (!trustedOrigins.includes(normalizedOrigin)) {
      trustedOrigins.push(normalizedOrigin);
    }
  }

  return {
    ok: true,
    origins: trustedOrigins,
  };
}

function resolveConfiguredOrigins(input: {
  isDevOrTest: boolean;
  strategy: TrustedOriginsStrategy;
}): string[] {
  const configuredOrigins = [
    asNonEmptyString(process.env.SITE_URL),
    asNonEmptyString(process.env.NEXT_PUBLIC_SITE_URL),
    ...(input.isDevOrTest ? [normalizeVercelUrl(process.env.VERCEL_URL)] : []),
  ].filter((value): value is string => value !== null);

  if (input.strategy === "first-configured") {
    return configuredOrigins.length > 0 ? [configuredOrigins[0]] : [];
  }

  return configuredOrigins;
}

function concatUint8Arrays(chunks: Uint8Array[], byteLength: number): Uint8Array {
  const combined = new Uint8Array(byteLength);
  let offset = 0;

  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return combined;
}

function isJsonContentType(value: string | null): boolean {
  return value?.toLowerCase().split(";")[0]?.trim() === "application/json";
}

function normalizeHttpOrigin(value: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
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

function normalizeVercelUrl(value: string | null | undefined): string | null {
  const normalized = asNonEmptyString(value);
  if (!normalized) {
    return null;
  }

  return normalized.includes("://") ? normalized : `https://${normalized}`;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return value.trim();
}
