export type AdminDisplayImageUrlInput = {
  currentOrigin: string | null | undefined;
  supabaseUrl: string | null | undefined;
};

export function resolveAdminDisplayImageUrl(
  value: string | null | undefined,
  input: AdminDisplayImageUrlInput,
): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;

  if (trimmed.startsWith("/") || trimmed.startsWith("blob:") || trimmed.startsWith("data:image/")) {
    return trimmed;
  }

  const imageOrigin = parseOrigin(trimmed);
  if (!imageOrigin) return null;

  const allowedOrigins = new Set(
    [parseOrigin(input.currentOrigin), parseOrigin(input.supabaseUrl)].filter(
      (origin): origin is string => origin !== null,
    ),
  );

  return allowedOrigins.has(imageOrigin) ? trimmed : null;
}

function parseOrigin(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}
