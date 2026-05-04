import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const SUPABASE_CONFIG_PATH = path.resolve(process.cwd(), "supabase/config.toml");

function readAuthScalar(config: string, key: string): string | null {
  const match = config.match(new RegExp(`^${key}\\s*=\\s*"([^"]+)"`, "m"));
  return match?.[1] ?? null;
}

function readAuthArray(config: string, key: string): string[] {
  const match = config.match(new RegExp(`^${key}\\s*=\\s*\\[([^\\]]*)\\]`, "m"));
  if (!match) return [];
  return match[1]
    .split(",")
    .map((value) => value.trim().replace(/^"|"$/g, ""))
    .filter((value) => value.length > 0);
}

test("local Supabase Auth allows the app origin used by NEXT_PUBLIC_SITE_URL", async () => {
  const config = await readFile(SUPABASE_CONFIG_PATH, "utf8");
  const siteUrl = readAuthScalar(config, "site_url");
  const redirectUrls = readAuthArray(config, "additional_redirect_urls");

  assert.equal(siteUrl, "http://localhost:3000");
  assert.ok(redirectUrls.includes("http://localhost:3000"));
  assert.ok(redirectUrls.includes("http://localhost:3000/**"));
  assert.ok(redirectUrls.includes("http://127.0.0.1:3000"));
  assert.ok(!redirectUrls.includes("https://127.0.0.1:3000"));
});

test("local Supabase Auth keeps email signup enabled without confirmation friction", async () => {
  const config = await readFile(SUPABASE_CONFIG_PATH, "utf8");

  assert.match(config, /^enable_signup\s*=\s*true$/m);
  assert.match(config, /\[auth\.email\][\s\S]*?^enable_signup\s*=\s*true$/m);
  assert.match(config, /\[auth\.email\][\s\S]*?^enable_confirmations\s*=\s*false$/m);
});
