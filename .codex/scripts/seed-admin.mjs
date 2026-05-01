#!/usr/bin/env node
// Dev-only: create (or upgrade) a Supabase admin user for /admin/* smoke testing.
//
// Usage:
//   node .codex/scripts/seed-admin.mjs <email> <password>
//
// Requires .env.local with:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// This script is intended for local development only. It uses the service role
// key (RLS bypass) to create an email-confirmed user and set profiles.role='admin'.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadDotEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function fail(message) {
  console.error(`[seed-admin] ${message}`);
  process.exit(1);
}

async function main() {
  loadDotEnvLocal();

  const [, , email, password] = process.argv;
  if (!email || !password) {
    fail("Usage: node .codex/scripts/seed-admin.mjs <email> <password>");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) fail("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!serviceKey) fail("SUPABASE_SERVICE_ROLE_KEY is not set");

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1) Find or create the auth user.
  let userId = null;

  // listUsers paginates; for dev volumes a single page is fine.
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listError) fail(`listUsers failed: ${listError.message}`);

  const existing = list?.users?.find(
    (u) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
  );

  if (existing) {
    userId = existing.id;
    console.log(`[seed-admin] Found existing user ${email} (${userId}).`);
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (updateError) fail(`updateUserById failed: ${updateError.message}`);
  } else {
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError) fail(`createUser failed: ${createError.message}`);
    userId = created.user?.id;
    if (!userId) fail("createUser returned no user id");
    console.log(`[seed-admin] Created user ${email} (${userId}).`);
  }

  // 2) Ensure profiles row + admin role. The profiles table is expected to be
  // populated by an auth trigger; upsert defensively in case it is not.
  const { error: upsertError } = await supabase
    .from("profiles")
    .upsert({ id: userId, role: "admin" }, { onConflict: "id" });
  if (upsertError) fail(`profiles upsert failed: ${upsertError.message}`);

  // 3) Verify.
  const { data: profile, error: selectError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();
  if (selectError) fail(`profile verify failed: ${selectError.message}`);
  if (!profile || profile.role !== "admin") {
    fail(`profile not admin after upsert (role=${profile?.role ?? "null"})`);
  }

  console.log(`[seed-admin] OK: ${email} is admin (profile.id=${profile.id}).`);
}

main().catch((err) => {
  console.error("[seed-admin] unexpected error:", err);
  process.exit(1);
});
