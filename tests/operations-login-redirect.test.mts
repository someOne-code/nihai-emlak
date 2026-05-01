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
  assert.match(source, /router\.push\(safeRedirectTo/);
  assert.doesNotMatch(source, /router\.push\("\/protected"\)/);
});
