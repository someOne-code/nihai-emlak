import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export type AdminBackofficeE2EConfig = {
  baseUrl: string;
  adminEmail: string;
  adminPassword: string;
};

export type AdminBackofficeE2EReadinessResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

const DEFAULT_BASE_URL = "http://localhost:3000";
const DEFAULT_ADMIN_EMAIL = "smoke-admin@example.test";
const DEFAULT_ADMIN_PASSWORD = "smoke-admin-2026";

const ADMIN_E2E_FILES = [
  "tests/admin-backoffice-e2e-smoke.test.mts",
  "tests/admin-backoffice-listings-e2e.test.mts",
  "tests/admin-backoffice-operations-e2e.test.mts",
  "tests/admin-backoffice-content-e2e.test.mts",
  "tests/admin-backoffice-management-e2e.test.mts",
] as const;

export function resolveAdminBackofficeE2EConfig(
  env: NodeJS.ProcessEnv,
): AdminBackofficeE2EConfig {
  return {
    baseUrl: normalizeBaseUrl(env.E2E_BASE_URL ?? DEFAULT_BASE_URL),
    adminEmail: normalizeEnvValue(env.E2E_ADMIN_EMAIL, DEFAULT_ADMIN_EMAIL),
    adminPassword: normalizeEnvValue(env.E2E_ADMIN_PASSWORD, DEFAULT_ADMIN_PASSWORD),
  };
}

export async function checkAdminBackofficeE2EReadiness(
  config: AdminBackofficeE2EConfig,
  fetchFn: typeof fetch = fetch,
): Promise<AdminBackofficeE2EReadinessResult> {
  let response: Response;
  try {
    response = await fetchFn(new URL("/auth/login", config.baseUrl), {
      method: "GET",
      redirect: "manual",
    });
  } catch {
    return {
      ok: false,
      message: `Admin E2E base URL is not reachable: ${config.baseUrl}`,
    };
  }

  if (response.status < 200 || response.status >= 400) {
    return {
      ok: false,
      message: `Admin E2E login page is not reachable: ${new URL("/auth/login", config.baseUrl).toString()} returned ${response.status}`,
    };
  }

  return { ok: true, message: "Admin E2E readiness checks passed." };
}

export function getAdminBackofficeE2EFiles(): readonly string[] {
  return ADMIN_E2E_FILES;
}

async function main(): Promise<number> {
  const config = resolveAdminBackofficeE2EConfig(process.env);
  const readiness = await checkAdminBackofficeE2EReadiness(config);
  if (!readiness.ok) {
    console.error(readiness.message);
    console.error("Start the app with `npm run dev` and seed the smoke admin before retrying.");
    return 1;
  }

  console.info(readiness.message);
  console.info(`Admin E2E base URL: ${config.baseUrl}`);
  console.info(`Admin E2E email: ${config.adminEmail}`);

  return runNodeTestFiles(config);
}

function runNodeTestFiles(config: AdminBackofficeE2EConfig): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ["--experimental-strip-types", "--test", ...ADMIN_E2E_FILES],
      {
        env: {
          ...process.env,
          E2E_BASE_URL: config.baseUrl,
          E2E_ADMIN_EMAIL: config.adminEmail,
          E2E_ADMIN_PASSWORD: config.adminPassword,
        },
        shell: false,
        stdio: "inherit",
      },
    );

    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", (error) => {
      console.error(error);
      resolve(1);
    });
  });
}

function normalizeBaseUrl(value: string): string {
  const parsed = new URL(value.trim());
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

function normalizeEnvValue(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim() ?? "";
  return trimmed || fallback;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
