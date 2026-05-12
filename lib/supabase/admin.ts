import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = resolveAdminServiceRoleKey(process.env, readLocalEnvFile);

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

type EnvLike = {
  NODE_ENV?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

type LocalEnvReader = () => string | null;

function resolveAdminServiceRoleKey(
  env: EnvLike,
  readLocalEnv: LocalEnvReader,
): string | null {
  const configured = normalizeEnvValue(env.SUPABASE_SERVICE_ROLE_KEY);
  if (isServiceRoleJwt(configured)) {
    return configured;
  }

  if (env.NODE_ENV === "production") {
    return null;
  }

  const localKey = normalizeEnvValue(
    parseDotEnvValue(readLocalEnv(), "SUPABASE_SERVICE_ROLE_KEY"),
  );
  return isServiceRoleJwt(localKey) ? localKey : null;
}

function readLocalEnvFile(): string | null {
  try {
    return readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  } catch {
    return null;
  }
}

function parseDotEnvValue(contents: string | null, key: string): string | null {
  if (!contents) {
    return null;
  }

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1 || trimmed.slice(0, separator).trim() !== key) {
      continue;
    }

    return stripOptionalQuotes(trimmed.slice(separator + 1).trim());
  }

  return null;
}

function stripOptionalQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function normalizeEnvValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function isServiceRoleJwt(value: string | null): value is string {
  if (!value) {
    return false;
  }

  const parts = value.split(".");
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    return false;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(toBase64(parts[1]), "base64").toString("utf8"),
    ) as { role?: unknown };
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

function toBase64(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
}

export const resolveAdminServiceRoleKeyForTest = resolveAdminServiceRoleKey;
