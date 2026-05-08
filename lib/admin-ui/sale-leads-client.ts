import type {
  RawSaleLead,
  SaleLeadStatus,
} from "./sale-leads-view-model.ts";

export type AdminSaleLeadsFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type AdminSaleLeadsClientOptions = {
  fetcher?: AdminSaleLeadsFetch;
  filters?: {
    status?: "actionable" | "all" | SaleLeadStatus;
    search?: string;
    limit?: number;
    offset?: number;
  };
};

export type AdminSaleLeadsOverview = {
  leads: RawSaleLead[];
};

export class AdminSaleLeadsClientError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminSaleLeadsClientError";
    this.status = status;
  }
}

export async function loadAdminSaleLeadsOverview(
  options: AdminSaleLeadsClientOptions = {},
): Promise<AdminSaleLeadsOverview> {
  const data = await requestAdminJson<{ leads?: unknown }>(
    buildSaleLeadsUrl(options.filters),
    { method: "GET" },
    options,
  );

  return {
    leads: Array.isArray(data?.leads) ? (data.leads as RawSaleLead[]) : [],
  };
}

function buildSaleLeadsUrl(filters: AdminSaleLeadsClientOptions["filters"]): string {
  const params = new URLSearchParams();
  if (filters?.status && filters.status !== "all") {
    params.set("status", filters.status);
  }
  if (filters?.search && filters.search.trim().length > 0) {
    params.set("search", filters.search.trim());
  }
  if (typeof filters?.limit === "number") {
    params.set("limit", String(filters.limit));
  }
  if (typeof filters?.offset === "number") {
    params.set("offset", String(filters.offset));
  }
  const query = params.toString();
  return query ? `/api/admin/sale-leads?${query}` : "/api/admin/sale-leads";
}

export async function updateSaleLeadStatus(
  leadId: string,
  status: SaleLeadStatus,
  note: string | null,
  options: AdminSaleLeadsClientOptions = {},
): Promise<unknown> {
  return requestAdminJson(
    "/api/admin/sale-leads",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lead_id: leadId,
        status,
        note,
      }),
    },
    options,
  );
}

async function requestAdminJson<T = unknown>(
  url: string,
  init: RequestInit,
  options: AdminSaleLeadsClientOptions,
): Promise<T> {
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  const response = await fetcher(url, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
  });
  const envelope = await readJsonEnvelope(response);

  if (!envelope.success) {
    throw new AdminSaleLeadsClientError(envelope.error, response.status);
  }

  if (!response.ok) {
    throw new AdminSaleLeadsClientError(
      "Admin sale leads request failed",
      response.status,
    );
  }

  return envelope.data as T;
}

async function readJsonEnvelope(
  response: Response,
): Promise<{ success: true; data: unknown } | { success: false; error: string }> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { success: false, error: "Invalid admin sale leads response" };
  }

  if (!isRecord(payload)) {
    return { success: false, error: "Invalid admin sale leads response" };
  }

  if (payload.success === true) {
    return { success: true, data: payload.data };
  }

  if (payload.success === false) {
    return {
      success: false,
      error: asNonEmptyString(payload.error) ?? "Admin sale leads request failed",
    };
  }

  return { success: false, error: "Invalid admin sale leads response" };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  return value.trim();
}
