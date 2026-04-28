import assert from "node:assert/strict";
import test from "node:test";

import {
  getPaymentCallbackSmokeCommand,
  getPaymentCallbackSmokeLogPaths,
} from "../.codex/scripts/test-payment-callback-smoke-runner.mjs";

test("payment callback smoke launcher: selects PowerShell script on Windows", () => {
  const command = getPaymentCallbackSmokeCommand("win32");

  assert.deepEqual(command, {
    executable: "powershell.exe",
    args: [
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      ".codex/scripts/test-payment-callback-smoke.ps1",
    ],
  });
});

test("payment callback smoke launcher: selects bash script on Linux", () => {
  const command = getPaymentCallbackSmokeCommand("linux");

  assert.deepEqual(command, {
    executable: "bash",
    args: [".codex/scripts/test-payment-callback-smoke.sh"],
  });
});

test("payment callback smoke launcher: rejects unsupported platforms", () => {
  assert.throws(
    () => getPaymentCallbackSmokeCommand("darwin"),
    /Unsupported platform/,
  );
});

test("payment callback smoke launcher: uses OS temp logs on Windows", () => {
  const paths = getPaymentCallbackSmokeLogPaths(
    "win32",
    "C:\\Users\\umut\\AppData\\Local\\Temp",
  );

  assert.deepEqual(paths, {
    supabaseStart: "C:\\Users\\umut\\AppData\\Local\\Temp\\supabase_start_payment_callback_smoke.log",
    supabaseDbReset: "C:\\Users\\umut\\AppData\\Local\\Temp\\supabase_db_reset_payment_callback_smoke.log",
  });
});

test("payment callback smoke launcher: uses slash temp logs on Linux", () => {
  const paths = getPaymentCallbackSmokeLogPaths("linux", "/tmp");

  assert.deepEqual(paths, {
    supabaseStart: "/tmp/supabase_start_payment_callback_smoke.log",
    supabaseDbReset: "/tmp/supabase_db_reset_payment_callback_smoke.log",
  });
});
