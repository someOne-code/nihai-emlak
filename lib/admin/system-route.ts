type SupabaseError = {
  code?: string | null;
  message?: string | null;
};

type SupabaseQueryResponse = {
  data: unknown;
  error: SupabaseError | null;
};

type SupabaseClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: SupabaseError | null;
    }>;
  };
  from: (table: string) => {
    select: (columns: string) => {
      limit?: (count: number) => Promise<SupabaseQueryResponse>;
      eq?: (column: string, value: string) => {
        maybeSingle: () => Promise<SupabaseQueryResponse>;
      };
    };
  };
  storage?: {
    getBucket?: (bucket: string) => Promise<SupabaseQueryResponse>;
  };
  rpc?: (name: string, args?: Record<string, unknown>) => Promise<SupabaseQueryResponse>;
};

export type AdminSystemRouteDependencies = {
  createServerSupabaseClient: () => Promise<unknown>;
  env?: Record<string, string | undefined>;
  runPayloadPreflight?: () => Promise<PayloadPreflightResult[]>;
};

export type AdminSystemStatus = "ready" | "missing" | "invalid" | "degraded";

export type AdminSystemServiceStatus = {
  status: AdminSystemStatus;
  checks: ReadonlyArray<{
    name: string;
    ok: boolean;
    required: boolean;
  }>;
  missing: string[];
  invalid: string[];
};

export type AdminSystemPaymentEventSummary =
  | {
      eventType: string;
      provider: string;
      createdAt: string;
    }
  | {
      status: "degraded";
    }
  | null;

export type AdminSystemPaymentStatus = AdminSystemServiceStatus & {
  lastCallbackAt: string | null;
  lastEvent: AdminSystemPaymentEventSummary;
};

type LatestPaymentEvent = Exclude<AdminSystemPaymentEventSummary, { status: "degraded" }>;

export type AdminSystemHealthDto = {
  chatwoot: AdminSystemServiceStatus;
  inngest: AdminSystemServiceStatus;
  supabaseDatabase: AdminSystemServiceStatus;
  payload: AdminSystemServiceStatus;
  storage: AdminSystemServiceStatus;
  payment: AdminSystemPaymentStatus;
};

type PayloadPreflightResult = {
  collection: string;
  ok: boolean;
  message?: string;
};

const CHATWOOT_CHECKS = [
  "CHATWOOT_BASE_URL",
  "CHATWOOT_INBOX_IDENTIFIER",
  "CHATWOOT_HMAC_TOKEN",
  "CHATWOOT_ACCOUNT_ID",
] as const;

const INNGEST_CHECKS = [
  "INNGEST_EVENT_KEY",
  "INNGEST_SIGNING_KEY",
] as const;

const PAYLOAD_CHECKS = [
  "DATABASE_URI",
  "PAYLOAD_SECRET",
  "PAYLOAD_PREFLIGHT",
] as const;

const PAYMENT_CHECKS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ISBANK_CLIENT_ID",
  "ISBANK_STORE_KEY",
] as const;

const CONTENT_MEDIA_BUCKET = "content-media";

export async function handleAdminSystemGet(
  _request: Request,
  dependencies: AdminSystemRouteDependencies,
): Promise<Response> {
  const guard = await guardAdminSystemRequest(dependencies);
  if (!guard.ok) {
    return guard.response;
  }

  const env = dependencies.env ?? process.env;
  if (isProductionEnvironment(env) && hasIncompleteProductionConfig(env)) {
    return jsonError("System health production configuration is incomplete", 500);
  }

  const [supabaseDatabase, payload, storage, paymentEvents] = await Promise.all([
    buildSupabaseDatabaseStatus(guard.supabase),
    buildPayloadStatus(env, dependencies.runPayloadPreflight),
    buildStorageStatus(guard.supabase),
    readLatestPaymentEvent(guard.supabase),
  ]);

  return jsonSuccess({
    chatwoot: buildChatwootStatus(env),
    inngest: buildInngestStatus(env),
    supabaseDatabase,
    payload,
    storage,
    payment: buildPaymentStatus(env, paymentEvents),
  });
}

function buildChatwootStatus(env: Record<string, string | undefined>): AdminSystemServiceStatus {
  const missing = CHATWOOT_CHECKS.filter((name) => !asNonEmptyString(env[name]));
  const invalid: string[] = [];
  const baseUrl = asNonEmptyString(env.CHATWOOT_BASE_URL);

  if (baseUrl && !isHttpUrl(baseUrl)) {
    invalid.push("CHATWOOT_BASE_URL");
  }

  return buildServiceStatus(CHATWOOT_CHECKS, missing, invalid);
}

function buildInngestStatus(env: Record<string, string | undefined>): AdminSystemServiceStatus {
  const missing = INNGEST_CHECKS.filter((name) => !asNonEmptyString(env[name]));
  return buildServiceStatus(INNGEST_CHECKS, missing, []);
}

async function buildSupabaseDatabaseStatus(supabase: SupabaseClient): Promise<AdminSystemServiceStatus> {
  try {
    const readinessSelect = supabase.from("profiles").select("id");
    if (!readinessSelect.limit) {
      return buildDegradedStatus(["SUPABASE_DB_READINESS"]);
    }

    const result = await readinessSelect.limit(1);
    if (result.error) {
      return buildDegradedStatus(["SUPABASE_DB_READINESS"]);
    }
  } catch {
    return buildDegradedStatus(["SUPABASE_DB_READINESS"]);
  }

  return buildServiceStatus(["SUPABASE_DB_READINESS"], [], []);
}

async function buildPayloadStatus(
  env: Record<string, string | undefined>,
  runPayloadPreflight = runDefaultPayloadPreflight,
): Promise<AdminSystemServiceStatus> {
  const missing = PAYLOAD_CHECKS
    .filter((name) => name !== "PAYLOAD_PREFLIGHT")
    .filter((name) => !asNonEmptyString(env[name]));

  let preflightOk = true;
  try {
    const results = await runPayloadPreflight();
    preflightOk = results.every((result) => result.ok);
  } catch {
    preflightOk = false;
  }

  if (!preflightOk) {
    return buildServiceStatusWithStatus(PAYLOAD_CHECKS, missing, [], "degraded", [
      "PAYLOAD_PREFLIGHT",
    ]);
  }

  return buildServiceStatus(PAYLOAD_CHECKS, missing, []);
}

async function buildStorageStatus(supabase: SupabaseClient): Promise<AdminSystemServiceStatus> {
  try {
    if (!supabase.storage?.getBucket) {
      return buildDegradedStatus([CONTENT_MEDIA_BUCKET]);
    }

    const result = await supabase.storage.getBucket(CONTENT_MEDIA_BUCKET);
    if (result.error) {
      return buildServiceStatus([CONTENT_MEDIA_BUCKET], [CONTENT_MEDIA_BUCKET], []);
    }
  } catch {
    return buildDegradedStatus([CONTENT_MEDIA_BUCKET]);
  }

  return buildServiceStatus([CONTENT_MEDIA_BUCKET], [], []);
}

function buildPaymentStatus(
  env: Record<string, string | undefined>,
  eventResult: PaymentEventReadiness,
): AdminSystemPaymentStatus {
  const missing = PAYMENT_CHECKS.filter((name) => !asNonEmptyString(env[name]));
  const invalid: string[] = [];
  const supabaseUrl = asNonEmptyString(env.NEXT_PUBLIC_SUPABASE_URL);

  if (supabaseUrl && !isHttpUrl(supabaseUrl)) {
    invalid.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  const base = buildServiceStatus(PAYMENT_CHECKS, missing, invalid);
  return {
    ...base,
    lastCallbackAt: eventResult.ok ? eventResult.event?.createdAt ?? null : null,
    lastEvent: eventResult.ok ? eventResult.event : { status: "degraded" },
  };
}

function isProductionEnvironment(env: Record<string, string | undefined>): boolean {
  return env.NODE_ENV === "production";
}

function hasIncompleteProductionConfig(env: Record<string, string | undefined>): boolean {
  return [
    buildChatwootStatus(env),
    buildInngestStatus(env),
    buildRequiredPayloadConfigStatus(env),
    buildPaymentConfigStatus(env),
  ].some((status) => status.status === "missing" || status.status === "invalid");
}

function buildRequiredPayloadConfigStatus(
  env: Record<string, string | undefined>,
): AdminSystemServiceStatus {
  const payloadConfigChecks = PAYLOAD_CHECKS.filter((name) => name !== "PAYLOAD_PREFLIGHT");
  const missing = payloadConfigChecks.filter((name) => !asNonEmptyString(env[name]));

  return buildServiceStatus(payloadConfigChecks, missing, []);
}

function buildPaymentConfigStatus(
  env: Record<string, string | undefined>,
): AdminSystemServiceStatus {
  const missing = PAYMENT_CHECKS.filter((name) => !asNonEmptyString(env[name]));
  const invalid: string[] = [];
  const supabaseUrl = asNonEmptyString(env.NEXT_PUBLIC_SUPABASE_URL);

  if (supabaseUrl && !isHttpUrl(supabaseUrl)) {
    invalid.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  return buildServiceStatus(PAYMENT_CHECKS, missing, invalid);
}

function buildServiceStatus(
  names: ReadonlyArray<string>,
  missing: ReadonlyArray<string>,
  invalid: ReadonlyArray<string>,
): AdminSystemServiceStatus {
  const status: AdminSystemStatus =
    invalid.length > 0 ? "invalid" : missing.length > 0 ? "missing" : "ready";
  const failed = new Set([...missing, ...invalid]);

  return {
    status,
    checks: names.map((name) => ({
      name,
      ok: !failed.has(name),
      required: true,
    })),
    missing: [...missing],
    invalid: [...invalid],
  };
}

function buildServiceStatusWithStatus(
  names: ReadonlyArray<string>,
  missing: ReadonlyArray<string>,
  invalid: ReadonlyArray<string>,
  status: AdminSystemStatus,
  degraded: ReadonlyArray<string>,
): AdminSystemServiceStatus {
  const failed = new Set([...missing, ...invalid, ...degraded]);

  return {
    status,
    checks: names.map((name) => ({
      name,
      ok: !failed.has(name),
      required: true,
    })),
    missing: [...missing],
    invalid: [...invalid],
  };
}

function buildDegradedStatus(names: ReadonlyArray<string>): AdminSystemServiceStatus {
  return buildServiceStatusWithStatus(names, [], [], "degraded", names);
}

type PaymentEventReadiness =
  | {
      ok: true;
      event: LatestPaymentEvent;
    }
  | { ok: false };

async function readLatestPaymentEvent(supabase: SupabaseClient): Promise<PaymentEventReadiness> {
  try {
    if (!supabase.rpc) {
      return { ok: false };
    }

    const result = await supabase.rpc("list_admin_payment_events", {
      p_payment_id: null,
      p_limit: 1,
      p_offset: 0,
    });
    if (result.error) {
      return { ok: false };
    }

    const event = parseLatestPaymentEvent(result.data);
    return { ok: true, event };
  } catch {
    return { ok: false };
  }
}

function parseLatestPaymentEvent(data: unknown): LatestPaymentEvent {
  const items = Array.isArray((data as Record<string, unknown> | null)?.items)
    ? ((data as Record<string, unknown>).items as unknown[])
    : [];
  const row = items[0] as Record<string, unknown> | undefined;
  if (!row) {
    return null;
  }

  const eventType = asNonEmptyString(row.event_type);
  const provider = asNonEmptyString(row.provider);
  const createdAt = asNonEmptyString(row.created_at);
  if (!eventType || !provider || !createdAt) {
    return null;
  }

  return { eventType, provider, createdAt };
}

async function runDefaultPayloadPreflight(): Promise<PayloadPreflightResult[]> {
  const payloadPreflightModule = await import("../../scripts/verify-payload-production-ready.mts");
  return payloadPreflightModule.runPayloadProductionPreflight();
}

async function guardAdminSystemRequest(
  dependencies: AdminSystemRouteDependencies,
): Promise<
  | { ok: true; supabase: SupabaseClient }
  | { ok: false; response: Response }
> {
  const supabase = (await dependencies.createServerSupabaseClient()) as SupabaseClient;
  const userResult = await supabase.auth.getUser();
  if (userResult.error || !userResult.data.user) {
    return {
      ok: false,
      response: jsonError("Oturum gerekli", 401),
    };
  }

  const profileSelect = supabase.from("profiles").select("role");
  if (!profileSelect.eq) {
    return {
      ok: false,
      response: jsonError("Admin profili okunamadı", 500),
    };
  }

  const profileResult = await profileSelect
    .eq("id", userResult.data.user.id)
    .maybeSingle();

  if (profileResult.error) {
    return {
      ok: false,
      response: jsonError("Admin profili okunamadı", 500),
    };
  }

  const role = asNonEmptyString((profileResult.data as Record<string, unknown> | null)?.role);
  if (role !== "admin") {
    return {
      ok: false,
      response: jsonError("Admin yetkisi gerekli", 403),
    };
  }

  return { ok: true, supabase };
}

function jsonSuccess(data: AdminSystemHealthDto): Response {
  return jsonResponse({ success: true, data }, 200);
}

function jsonError(error: string, status: number): Response {
  return jsonResponse({ success: false, error }, status);
}

function jsonResponse(payload: unknown, status: number): Response {
  return Response.json(payload, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  return value.trim();
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
