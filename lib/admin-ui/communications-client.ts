// Phase D: Admin Communication API client.
// Mirrors the operations-client envelope/error pattern.

import type { CommunicationsStatusFilter } from "./communications-filters.ts";
import type { RawChatwootConversation } from "./communications-view-model.ts";

export type AdminCommunicationsFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type AdminCommunicationsClientOptions = {
  fetcher?: AdminCommunicationsFetch;
  filters?: {
    status?: CommunicationsStatusFilter;
    search?: string;
    limit?: number;
    offset?: number;
  };
};

export type AdminCommunicationsOverview = {
  conversations: RawChatwootConversation[];
  chatwoot?: {
    web_base_url?: string | null;
    account_id?: string | null;
  } | null;
};

export class AdminCommunicationsClientError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminCommunicationsClientError";
    this.status = status;
  }
}

export async function loadAdminCommunicationsOverview(
  options: AdminCommunicationsClientOptions = {},
): Promise<AdminCommunicationsOverview> {
  const data = await requestAdminJson<{
    conversations?: unknown;
    chatwoot?: unknown;
  }>(
    buildCommunicationsUrl(options.filters),
    { method: "GET" },
    options,
  );

  const conversations = Array.isArray(data?.conversations)
    ? (data.conversations as RawChatwootConversation[])
    : [];
  const chatwoot = isRecord(data?.chatwoot)
    ? {
        web_base_url: asNonEmptyString(data.chatwoot.web_base_url),
        account_id: asNonEmptyString(data.chatwoot.account_id),
      }
    : null;

  return { conversations, chatwoot };
}

function buildCommunicationsUrl(filters: AdminCommunicationsClientOptions["filters"]): string {
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
  return query ? `/api/admin/communications?${query}` : "/api/admin/communications";
}

export async function retryAdminCommunicationsConversation(
  conversationId: string,
  options: AdminCommunicationsClientOptions = {},
): Promise<unknown> {
  return requestAdminJson(
    "/api/admin/communications",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversation_id: conversationId }),
    },
    options,
  );
}

async function requestAdminJson<T = unknown>(
  url: string,
  init: RequestInit,
  options: AdminCommunicationsClientOptions,
): Promise<T> {
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  const response = await fetcher(url, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
  });
  const envelope = await readJsonEnvelope(response);

  if (!envelope.success) {
    throw new AdminCommunicationsClientError(envelope.error, response.status);
  }

  if (!response.ok) {
    throw new AdminCommunicationsClientError(
      "İletişim isteği başarısız oldu",
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
    return { success: false, error: "Geçersiz iletişim yanıtı" };
  }

  if (!isRecord(payload)) {
    return { success: false, error: "Geçersiz iletişim yanıtı" };
  }

  if (payload.success === true) {
    return { success: true, data: payload.data };
  }

  if (payload.success === false) {
    return {
      success: false,
      error: asNonEmptyString(payload.error) ?? "İletişim isteği başarısız oldu",
    };
  }

  return { success: false, error: "Geçersiz iletişim yanıtı" };
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
