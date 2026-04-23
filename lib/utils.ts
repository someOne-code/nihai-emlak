import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type SupabaseProxyEnvMode =
  | { ok: true; shouldBypassProxyAuth: boolean }
  | { ok: false; error: string };

// Used only to gate Supabase auth UI, not the full app environment readiness.
export const hasEnvVars = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL
  && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

export function resolveSupabaseProxyEnvMode(input: {
  nodeEnv: string | null | undefined;
  supabaseUrl: string | null | undefined;
  supabasePublishableKey: string | null | undefined;
}): SupabaseProxyEnvMode {
  const nodeEnv = typeof input.nodeEnv === "string" ? input.nodeEnv.toLowerCase() : "";
  const isDevOrTest = nodeEnv === "development" || nodeEnv === "test";
  const hasSupabaseEnv = Boolean(
    asNonEmptyString(input.supabaseUrl)
    && asNonEmptyString(input.supabasePublishableKey),
  );

  if (hasSupabaseEnv) {
    return { ok: true, shouldBypassProxyAuth: false };
  }

  if (isDevOrTest) {
    return { ok: true, shouldBypassProxyAuth: true };
  }

  return {
    ok: false,
    error: "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be configured outside development/test",
  };
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return value.trim();
}
