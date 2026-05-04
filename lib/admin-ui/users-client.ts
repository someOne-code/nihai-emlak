import type { AdminUsersDto } from "./users-view-model";

export class AdminUsersClientError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminUsersClientError";
    this.status = status;
  }
}

export type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type AdminInviteResult = {
  email: string;
  role: "admin";
};

export async function fetchAdminUsers(options: { fetcher?: Fetcher } = {}) {
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  const response = await fetcher("/api/admin/users", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });

  const payload = await readPayload(response);
  const envelope = readEnvelope(payload);
  if (!response.ok || !envelope.success) {
    throw new AdminUsersClientError(
      envelope.success ? "Admin users request failed" : envelope.error,
      response.status,
    );
  }

  if (!isAdminUsersDto(envelope.data)) {
    throw new AdminUsersClientError("Invalid admin users response", response.status);
  }

  return envelope.data;
}

export async function inviteAdminUser(
  email: string,
  options: { fetcher?: Fetcher } = {},
): Promise<AdminInviteResult> {
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  const response = await fetcher("/api/admin/users/invite", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  const payload = await readPayload(response);
  const envelope = readEnvelope(payload);
  if (!response.ok || !envelope.success) {
    throw new AdminUsersClientError(
      envelope.success ? "Admin invite request failed" : envelope.error,
      response.status,
    );
  }

  if (!isAdminInviteResult(envelope.data)) {
    throw new AdminUsersClientError("Invalid admin invite response", response.status);
  }

  return envelope.data;
}

async function readPayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new AdminUsersClientError("Invalid admin users response", response.status);
  }
}

function readEnvelope(
  value: unknown,
): { success: true; data: unknown } | { success: false; error: string } {
  if (typeof value !== "object" || value === null) {
    return { success: false, error: "Invalid admin users response" };
  }

  if ("success" in value && value.success === true && "data" in value) {
    return { success: true, data: value.data };
  }

  if ("success" in value && value.success === false) {
    return {
      success: false,
      error:
        "error" in value && typeof value.error === "string"
          ? value.error
          : "Admin users request failed",
    };
  }

  return { success: false, error: "Invalid admin users response" };
}

function isAdminUsersDto(value: unknown): value is AdminUsersDto {
  if (typeof value !== "object" || value === null || !("items" in value)) {
    return false;
  }

  const items = value.items;
  return Array.isArray(items) && items.every(isAdminUserDto);
}

function isAdminUserDto(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.email === "string" &&
    row.role === "admin" &&
    typeof row.createdAt === "string"
  );
}

function isAdminInviteResult(value: unknown): value is AdminInviteResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const result = value as Record<string, unknown>;
  return typeof result.email === "string" && result.role === "admin";
}
