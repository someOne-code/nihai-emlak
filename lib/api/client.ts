import type { ApiResponse } from "@/types/api";

export class ApiFetchError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiFetchError";
    this.status = status;
  }
}

function resolveApiUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  if (typeof window !== "undefined") {
    return path;
  }

  const origin =
    process.env.SITE_URL
    ?? process.env.NEXT_PUBLIC_SITE_URL;

  if (!origin) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SITE_URL or NEXT_PUBLIC_SITE_URL must be configured for server API calls.");
    }

    return new URL(path, "http://127.0.0.1:3000").toString();
  }

  const resolvedOrigin = process.env.NODE_ENV === "development" && new URL(origin).hostname === "localhost"
    ? origin.replace("localhost", "127.0.0.1")
    : origin;

  return new URL(path, resolvedOrigin).toString();
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const response = await fetch(resolveApiUrl(path), {
    ...options,
    headers,
    cache: "no-store",
    credentials: options.credentials ?? "same-origin",
  });

  const json = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok) {
    throw new ApiFetchError(readApiError(json) ?? "İstek başarısız oldu", response.status);
  }

  if (json?.success === false) {
    throw new ApiFetchError(json.error || "Bir hata oluştu", response.status);
  }

  if (!json || json.success !== true) {
    throw new ApiFetchError("Geçersiz API yanıtı", response.status);
  }

  return json.data;
}

function readApiError<T>(json: ApiResponse<T> | null): string | null {
  if (json && json.success === false && json.error) {
    return json.error;
  }

  return null;
}
