import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

export function getPaymentCallbackSmokeCommand(platform) {
  if (platform === "win32") {
    return {
      executable: "powershell.exe",
      args: [
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        ".codex/scripts/test-payment-callback-smoke.ps1",
      ],
    };
  }

  if (platform === "linux") {
    return {
      executable: "bash",
      args: [".codex/scripts/test-payment-callback-smoke.sh"],
    };
  }

  throw new Error(`Unsupported platform for payment callback smoke test: ${platform}`);
}

export function getPaymentCallbackSmokeLogPaths(platform, tempDir) {
  const join = (...parts) =>
    platform === "win32" ? parts.join("\\") : parts.join("/");

  return {
    supabaseStart: join(tempDir, "supabase_start_payment_callback_smoke.log"),
    supabaseDbReset: join(tempDir, "supabase_db_reset_payment_callback_smoke.log"),
  };
}

export function main() {
  const { executable, args } = getPaymentCallbackSmokeCommand(process.platform);
  const result = spawnSync(executable, [...args, ...process.argv.slice(2)], {
    cwd: repoRoot,
    stdio: "inherit",
    windowsHide: false,
  });

  if (result.error) {
    throw result.error;
  }

  process.exit(result.status ?? 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
