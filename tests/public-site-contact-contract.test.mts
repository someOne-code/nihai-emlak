import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function readProjectFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("contact page renders public chrome (header + footer)", () => {
  const page = readProjectFile("app/(site)/contact/page.tsx");

  assert.match(page, /import \{ PublicHeader \} from "@\/components\/site\/public-header";/);
  assert.match(page, /import \{ PublicFooter \} from "@\/components\/site\/public-footer";/);
});

test("contact page has correct metadata title", () => {
  const page = readProjectFile("app/(site)/contact/page.tsx");

  assert.match(page, /İletişim \| Umut Emlak/);
  assert.match(page, /export const metadata/);
});

test("contact page has Turkish h1 heading", () => {
  const page = readProjectFile("app/(site)/contact/page.tsx");

  assert.match(page, /<h1[\s\S]*İletişim/);
});

test("contact page shows Kayseri address", () => {
  const page = readProjectFile("app/(site)/contact/page.tsx");

  assert.match(page, /Kayseri/);
});

test("contact page shows phone number", () => {
  const page = readProjectFile("app/(site)/contact/page.tsx");

  assert.match(page, /\+\(850\) 000 0000/);
});

test("contact page shows email address", () => {
  const page = readProjectFile("app/(site)/contact/page.tsx");

  assert.match(page, /info@umutemlak\.com/);
});

test("contact page shows business hours", () => {
  const page = readProjectFile("app/(site)/contact/page.tsx");

  assert.match(page, /Pazartesi/);
  assert.match(page, /09:00/);
});

test("contact page uses project design tokens", () => {
  const page = readProjectFile("app/(site)/contact/page.tsx");

  assert.match(page, /bg-property-light|bg-property-hero|bg-property-surface/);
});

test("contact page is a pure server component (no use client)", () => {
  const page = readProjectFile("app/(site)/contact/page.tsx");

  assert.doesNotMatch(page, /"use client"/);
});
