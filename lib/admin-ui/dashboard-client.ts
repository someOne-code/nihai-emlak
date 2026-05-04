import type { AdminDashboardSummaryDto } from "./dashboard-summary-view-model";

export class AdminDashboardClientError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminDashboardClientError";
    this.status = status;
  }
}

export type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type FetchAdminDashboardSummaryOptions = {
  fetcher?: Fetcher;
};

export async function fetchAdminDashboardSummary(
  options: FetchAdminDashboardSummaryOptions = {},
): Promise<AdminDashboardSummaryDto> {
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);

  const response = await fetcher("/api/admin/dashboard/summary", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new AdminDashboardClientError(
      "Invalid admin dashboard response",
      response.status,
    );
  }

  const envelope = readEnvelope(payload);

  if (!response.ok && envelope.success === false) {
    throw new AdminDashboardClientError(envelope.error, response.status);
  }

  if (!response.ok) {
    throw new AdminDashboardClientError(
      "Admin dashboard request failed",
      response.status,
    );
  }

  if (!envelope.success) {
    throw new AdminDashboardClientError(
      envelope.error,
      response.status,
    );
  }

  if (!isValidSummaryDto(envelope.data)) {
    throw new AdminDashboardClientError(
      "Invalid admin dashboard response",
      response.status,
    );
  }

  return envelope.data;
}

function readEnvelope(
  value: unknown,
): { success: true; data: unknown } | { success: false; error: string } {
  if (typeof value !== "object" || value === null) {
    return {
      success: false,
      error: "Invalid admin dashboard response",
    };
  }

  if ("success" in value && value.success === true && "data" in value) {
    return {
      success: true,
      data: value.data,
    };
  }

  if ("success" in value && value.success === false) {
    return {
      success: false,
      error:
        "error" in value && typeof value.error === "string" && value.error.trim().length > 0
          ? value.error
          : "Admin dashboard request failed",
    };
  }

  return {
    success: false,
    error: "Invalid admin dashboard response",
  };
}

function isValidSummaryDto(value: unknown): value is AdminDashboardSummaryDto {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const dto = value as Record<string, unknown>;
  const keys = [
    "listingTotal",
    "listingActive",
    "listingPassive",
    "listingWithoutImages",
    "rentListingsNotCheckoutReady",
    "pendingReservations",
    "failedOrConflictPayments",
    "manualResolutionRequired",
    "communicationItems",
  ];

  for (const key of keys) {
    if (!(key in dto)) {
      return false;
    }
    const v = dto[key];
    if (v !== null && typeof v !== "number") {
      return false;
    }
  }

  return true;
}
