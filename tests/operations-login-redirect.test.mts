import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("login form honors safe redirect query after Supabase sign-in", async () => {
  const source = await readFile(
    new URL("../components/login-form.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /useSearchParams/);
  assert.match(source, /searchParams\.get\("redirect"\)/);
  assert.match(source, /redirectTo\.startsWith\("\/"\)/);
  assert.match(source, /!redirectTo\.startsWith\("\/\/"\)/);
  assert.match(source, /window\.location\.assign\(safeRedirectTo\)/);
  assert.doesNotMatch(source, /router\.push\(safeRedirectTo/);
  assert.doesNotMatch(source, /window\.location\.assign\("\/protected"\)/);
});

test("logout button performs a full-page login navigation after Supabase sign-out", async () => {
  const source = await readFile(
    new URL("../components/logout-button.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /supabase\.auth\.signOut\(\)/);
  assert.match(source, /window\.location\.assign\("\/auth\/login"\)/);
  assert.doesNotMatch(source, /useRouter/);
  assert.doesNotMatch(source, /router\.push\("\/auth\/login"\)/);
});
