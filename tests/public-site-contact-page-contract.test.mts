import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function readProjectFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("contact page exists and is a TypeScript server component", () => {
  // Will throw ENOENT if the file does not exist — that is the RED state
  const page = readProjectFile("app/(site)/contact/page.tsx");
  assert.ok(page.length > 0, "contact page must not be empty");
});

test("contact page exports metadata with correct Turkish title", () => {
  const page = readProjectFile("app/(site)/contact/page.tsx");

  assert.match(
    page,
    /export const metadata/,
    "must export metadata",
  );
  assert.match(
    page,
    /İletişim \| Umut Emlak/,
    "metadata title must be 'İletişim | Umut Emlak'",
  );
});

test("contact page has an h1 with İletişim heading", () => {
  const page = readProjectFile("app/(site)/contact/page.tsx");

  assert.match(
    page,
    /<h1[\s\S]*İletişim[\s\S]*<\/h1>/,
    "page must contain an <h1> element with 'İletişim' text",
  );
});

test("contact page shows the email address info@umutemlak.com", () => {
  const page = readProjectFile("app/(site)/contact/page.tsx");

  assert.match(
    page,
    /info@umutemlak\.com/,
    "page must contain the email address info@umutemlak.com",
  );
});

test("contact page shows the phone number +(850) 000 0000", () => {
  const page = readProjectFile("app/(site)/contact/page.tsx");

  assert.match(
    page,
    /\+\(850\) 000 0000/,
    "page must contain the phone number +(850) 000 0000",
  );
});

test("contact page shows Kayseri as the city", () => {
  const page = readProjectFile("app/(site)/contact/page.tsx");

  assert.match(
    page,
    /Kayseri/,
    "page must mention Kayseri",
  );
});

test("contact page uses the project design tokens (bg-property classes)", () => {
  const page = readProjectFile("app/(site)/contact/page.tsx");

  assert.match(
    page,
    /bg-property-/,
    "page must use at least one bg-property-* design token to match site aesthetic",
  );
});

test("contact page includes PublicHeader and PublicFooter chrome", () => {
  const page = readProjectFile("app/(site)/contact/page.tsx");

  assert.match(
    page,
    /PublicHeader/,
    "page must include PublicHeader",
  );
  assert.match(
    page,
    /PublicFooter/,
    "page must include PublicFooter",
  );
});

test("contact page is a server component (no 'use client' directive)", () => {
  const page = readProjectFile("app/(site)/contact/page.tsx");

  assert.doesNotMatch(
    page,
    /^["']use client["'];?/m,
    "contact page must be a server component — no 'use client' directive",
  );
});

test("contact page shows working hours in Turkish", () => {
  const page = readProjectFile("app/(site)/contact/page.tsx");

  assert.match(
    page,
    /Pazartesi/,
    "page must show working hours mentioning Pazartesi",
  );
  assert.match(
    page,
    /09:00/,
    "page must show opening time 09:00",
  );
});
