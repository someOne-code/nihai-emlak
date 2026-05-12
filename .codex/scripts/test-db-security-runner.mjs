import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXCLUDES = [
  "gotrue",
  "realtime",
  "storage-api",
  "imgproxy",
  "kong",
  "mailpit",
  "postgrest",
  "postgres-meta",
  "studio",
  "edge-runtime",
  "logflare",
  "vector",
  "supavisor",
].join(",");

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

export function resolveSupabaseDbContainerName({ repoRoot, names }) {
  const expected = `supabase_db_${path.basename(repoRoot)}`;
  if (names.includes(expected)) {
    return expected;
  }

  return null;
}

export function buildSqlLogPath({ repoRoot, sqlPath }) {
  return path.join(repoRoot, ".codex", "logs", `${path.basename(sqlPath)}.log`);
}

function repoRootFromScript() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
}

function commandName(command) {
  if (command !== "npx") {
    return command;
  }
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function run(command, args, options = {}) {
  const resolved = commandName(command);
  // Windows requires shell:true to spawn .cmd/.bat wrappers (e.g. npx.cmd).
  // Plain executables (docker.exe, node.exe) work fine without a shell.
  const needsShell = process.platform === "win32" && resolved.endsWith(".cmd");
  const result = spawnSync(resolved, args, {
    cwd: options.cwd,
    encoding: options.input ? undefined : "utf8",
    input: options.input,
    shell: needsShell,
    windowsHide: true,
  });

  if (options.logPath) {
    const stdout = bufferOrString(result.stdout);
    const stderr = bufferOrString(result.stderr);
    writeFileSync(options.logPath, `${stdout}${stderr}`);
  }

  if (result.error) {
    throw new Error(`${command} could not start: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const excerpt = excerptOutput(bufferOrString(result.stderr) || bufferOrString(result.stdout));
    throw new Error(`${command} ${args.join(" ")} failed with exit ${result.status}${excerpt}`);
  }

  return bufferOrString(result.stdout);
}

function bufferOrString(value) {
  if (!value) {
    return "";
  }
  return Buffer.isBuffer(value) ? value.toString("utf8") : String(value);
}

function excerptOutput(output) {
  const lines = output.trim().split(/\r?\n/).filter(Boolean).slice(0, 20);
  return lines.length > 0 ? `\n${lines.join("\n")}` : "";
}

function listSqlTests(repoRoot) {
  const sqlDir = path.join(repoRoot, "tests", "sql");
  return readdirSync(sqlDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => path.join(sqlDir, name));
}

function ensureLogDir(repoRoot) {
  const logDir = path.join(repoRoot, ".codex", "logs");
  mkdirSync(logDir, { recursive: true });
  return logDir;
}

function dockerContainerNames(repoRoot) {
  const output = run("docker", ["ps", "--format", "{{.Names}}"], { cwd: repoRoot });
  return output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

export function runDbSecurityTests({ repoRoot = repoRootFromScript() } = {}) {
  const logDir = ensureLogDir(repoRoot);
  const startLog = path.join(logDir, "supabase-start-test-db-security.log");
  const resetLog = path.join(logDir, "supabase-db-reset-test-db-security.log");

  try {
    run("docker", ["ps"], { cwd: repoRoot });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      [
        "Docker Desktop Linux engine is not reachable.",
        "Open or restart Docker Desktop, wait until it says it is running, then retry npm run test:db-security.",
        detail,
      ].join("\n"),
    );
  }

  run("npx", ["supabase", "start", "-x", EXCLUDES, "--yes"], { cwd: repoRoot, logPath: startLog });
  run("npx", ["supabase", "db", "reset"], { cwd: repoRoot, logPath: resetLog });

  const container = resolveSupabaseDbContainerName({
    repoRoot,
    names: dockerContainerNames(repoRoot),
  });

  if (!container) {
    throw new Error("No running Supabase DB container found after startup.");
  }

  for (const sqlPath of listSqlTests(repoRoot)) {
    const logPath = buildSqlLogPath({ repoRoot, sqlPath });
    run(
      "docker",
      ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
      {
        cwd: repoRoot,
        input: readFileSync(sqlPath),
        logPath,
      },
    );
  }

  return "test-db-security: ok";
}

if (isMain) {
  try {
    console.log(runDbSecurityTests());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    console.error(`Logs are in ${path.join(repoRootFromScript(), ".codex", "logs")}`);
    process.exit(1);
  }
}
