import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("chatwoot conversation claim uses conflict-safe first insert", async () => {
  const source = await readFile(
    new URL("../supabase/migrations/20260430100000_32_phase7_chatwoot_conversations.sql", import.meta.url),
    "utf8",
  );

  assert.match(source, /on conflict on constraint chatwoot_conversations_user_listing_key\s*do nothing/is);
  assert.match(source, /if v_mapping\.id is null then[\s\S]*for update/is);
});
