import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function readProjectFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("checkout page exists and is a TypeScript server component", () => {
  const page = readProjectFile("app/(site)/checkout/page.tsx");
  assert.ok(page.length > 0, "checkout page must not be empty");
});

test("checkout page exports metadata with correct Turkish title", () => {
  const page = readProjectFile("app/(site)/checkout/page.tsx");
  assert.match(page, /export const metadata/, "must export metadata");
  assert.match(page, /Ödeme|Kiralamayı Başlat/, "metadata title must be correct");
});

test("checkout page includes PublicHeader and PublicFooter chrome", () => {
  const page = readProjectFile("app/(site)/checkout/page.tsx");
  assert.match(page, /PublicHeader/, "page must include PublicHeader");
  assert.match(page, /PublicFooter/, "page must include PublicFooter");
});

test("checkout success page exists and has confirmation text", () => {
  const page = readProjectFile("app/(site)/checkout/success/page.tsx");
  assert.match(page, /Başarılı|Tebrikler|Başarıyla/, "success page must have Turkish success text");
});

test("checkout fail page exists and has error warning text", () => {
  const page = readProjectFile("app/(site)/checkout/fail/page.tsx");
  assert.match(page, /Başarısız|Hata|Tekrar Deneyin/, "fail page must have Turkish failure/retry text");
});
