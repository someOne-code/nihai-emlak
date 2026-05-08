import type { AdminSystemHealthDto } from "../admin/system-route.ts";

export type AdminSystemFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type AdminSystemClientOptions = {
  fetcher?: AdminSystemFetch;
};

export class AdminSystemClientError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminSystemClientError";
    this.status = status;
  }
}

export async function loadAdminSystemHealth(
  options: AdminSystemClientOptions = {},
): Promise<AdminSystemHealthDto> {
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  const response = await fetcher("/api/admin/system", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });
  const envelope = await readJsonEnvelope(response);

  if (!envelope.success) {
    throw new AdminSystemClientError(envelope.error, response.status);
  }
  if (!response.ok) {
    throw new AdminSystemClientError("Sistem sağlığı isteği başarısız oldu", response.status);
  }

  return envelope.data as AdminSystemHealthDto;
}

async function readJsonEnvelope(
  response: Response,
): Promise<{ success: true; data: unknown } | { success: false; error: string }> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { success: false, error: "Geçersiz sistem sağlığı yanıtı" };
  }

  if (!isRecord(payload)) {
    return { success: false, error: "Geçersiz sistem sağlığı yanıtı" };
  }
  if (payload.success === true) {
    return { success: true, data: payload.data };
  }
  if (payload.success === false) {
    return {
      success: false,
      error: asNonEmptyString(payload.error) ?? "Sistem sağlığı isteği başarısız oldu",
    };
  }

  return { success: false, error: "Geçersiz sistem sağlığı yanıtı" };
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
