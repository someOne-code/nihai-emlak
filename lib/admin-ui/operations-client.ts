export type AdminOperationsFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type AdminOperationsClientOptions = {
  fetcher?: AdminOperationsFetch;
};

export type AdminOperationsListResult = {
  items: unknown[];
  limit: number;
  offset: number;
};

export type AdminOperationsOverview = {
  reservations: AdminOperationsListResult;
  orders: AdminOperationsListResult;
  payments: AdminOperationsListResult;
};

export class AdminOperationsClientError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminOperationsClientError";
    this.status = status;
  }
}

export async function loadAdminOperationsOverview(
  options: AdminOperationsClientOptions = {},
): Promise<AdminOperationsOverview> {
  const [reservations, orders, payments] = await Promise.all([
    requestAdminJson<AdminOperationsListResult>(
      "/api/admin/read/reservations?status=pending&limit=20&offset=0",
      { method: "GET" },
      options,
    ),
    requestAdminJson<AdminOperationsListResult>(
      "/api/admin/read/orders?limit=100&offset=0",
      { method: "GET" },
      options,
    ),
    requestAdminJson<AdminOperationsListResult>(
      "/api/admin/read/payments?limit=100&offset=0",
      { method: "GET" },
      options,
    ),
  ]);

  return {
    reservations,
    orders,
    payments,
  };
}

export async function fetchReservationWorkflowSnapshot(
  reservationId: string,
  options: AdminOperationsClientOptions = {},
): Promise<unknown> {
  return requestAdminJson(
    `/api/admin/workflows/reservations/${encodeURIComponent(reservationId)}/snapshot`,
    { method: "GET" },
    options,
  );
}

export async function fetchListingWorkflowSnapshot(
  listingId: string,
  options: AdminOperationsClientOptions = {},
): Promise<unknown> {
  return requestAdminJson(
    `/api/admin/workflows/listings/${encodeURIComponent(listingId)}/snapshot`,
    { method: "GET" },
    options,
  );
}

export async function cancelReservationWorkflow(
  reservationId: string,
  body: { reason: string; note?: string | null },
  options: AdminOperationsClientOptions = {},
): Promise<unknown> {
  return postAdminJson(
    `/api/admin/workflows/reservations/${encodeURIComponent(reservationId)}/cancel`,
    body,
    options,
  );
}

export async function confirmReservationWorkflow(
  reservationId: string,
  body: { note?: string | null } = {},
  options: AdminOperationsClientOptions = {},
): Promise<unknown> {
  return postAdminJson(
    `/api/admin/workflows/reservations/${encodeURIComponent(reservationId)}/confirm`,
    body,
    options,
  );
}

export async function reopenListingWorkflow(
  listingId: string,
  body: { reason: string; note?: string | null },
  options: AdminOperationsClientOptions = {},
): Promise<unknown> {
  return postAdminJson(
    `/api/admin/workflows/listings/${encodeURIComponent(listingId)}/reopen`,
    body,
    options,
  );
}

function postAdminJson(
  url: string,
  body: Record<string, unknown>,
  options: AdminOperationsClientOptions,
): Promise<unknown> {
  return requestAdminJson(
    url,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
    options,
  );
}

async function requestAdminJson<T = unknown>(
  url: string,
  init: RequestInit,
  options: AdminOperationsClientOptions,
): Promise<T> {
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  const response = await fetcher(url, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
  });
  const envelope = await readJsonEnvelope(response);

  if (!envelope.success) {
    throw new AdminOperationsClientError(envelope.error, response.status);
  }

  if (!response.ok) {
    throw new AdminOperationsClientError("Admin operation request failed", response.status);
  }

  return envelope.data as T;
}

async function readJsonEnvelope(
  response: Response,
): Promise<
  | { success: true; data: unknown }
  | { success: false; error: string }
> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return {
      success: false,
      error: "Invalid admin operation response",
    };
  }

  if (!isRecord(payload)) {
    return {
      success: false,
      error: "Invalid admin operation response",
    };
  }

  if (payload.success === true) {
    return {
      success: true,
      data: payload.data,
    };
  }

  if (payload.success === false) {
    return {
      success: false,
      error: asNonEmptyString(payload.error) ?? "Admin operation request failed",
    };
  }

  return {
    success: false,
    error: "Invalid admin operation response",
  };
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
