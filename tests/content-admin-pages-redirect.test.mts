import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const contentPages = [
  {
    file: "../app/(site)/admin/content/posts/page.tsx",
    redirectPath: "/admin/content/posts",
  },
  {
    file: "../app/(site)/admin/content/categories/page.tsx",
    redirectPath: "/admin/content/categories",
  },
  {
    file: "../app/(site)/admin/content/consultants/page.tsx",
    redirectPath: "/admin/content/consultants",
  },
] as const;

test("content admin pages preserve their exact path through the login redirect", async () => {
  for (const page of contentPages) {
    const source = await readFile(new URL(page.file, import.meta.url), "utf8");

    assert.match(source, /resolveContentAdminAccess\(\{/);
    assert.match(source, new RegExp(`redirectPath:\\s*["']${page.redirectPath}["']`));
  }
});
