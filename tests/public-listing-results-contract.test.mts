import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function readProjectFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("listing results stay client-side and render listings through ListingCard", () => {
  const results = readProjectFile("components/listings/listing-results.tsx");

  assert.match(results, /"use client"/);
  assert.match(results, /import \{ ListingCard \} from "\.\/listing-card"/);
  assert.match(results, /<ListingCard key=\{listing\.id\} listing=\{listing\} viewMode=\{viewMode\} \/>/);
  assert.match(results, /useMemo\(\(\) => sortListings\(listings, sort\), \[listings, sort\]\)/);
  assert.doesNotMatch(results, /\bfetch\(|useRouter|useSearchParams|router\.|window\.location|history\.pushState/);
});

test("listing results expose local sort modes and default to grid view", () => {
  const results = readProjectFile("components/listings/listing-results.tsx");

  assert.match(results, /export type ListingSort = "default" \| "price_asc" \| "price_desc" \| "title_asc"/);
  assert.match(results, /useState<ListingViewMode>\("grid"\)/);
  assert.match(results, /onChange=\{\(event\) => setSort\(event\.target\.value as ListingSort\)\}/);
  assert.match(results, /<option value="default">Varsay\u0131lan<\/option>/);
  assert.match(results, /<option value="price_asc">Fiyat artan<\/option>/);
  assert.match(results, /<option value="price_desc">Fiyat azalan<\/option>/);
  assert.match(results, /<option value="title_asc">Ba\u015fl\u0131k A-Z<\/option>/);
  assert.match(results, /sort === "price_asc"[\s\S]*normalizePrice\(a\.price\) - normalizePrice\(b\.price\)/);
  assert.match(results, /sort === "price_desc"[\s\S]*normalizePrice\(b\.price\) - normalizePrice\(a\.price\)/);
  assert.match(results, /sort === "title_asc"[\s\S]*a\.title\.localeCompare\(b\.title, "tr"\)/);
  assert.match(results, /return nextListings;/);
  assert.match(results, /aria-label="Grid g\u00f6r\u00fcn\u00fcm\u00fc"[\s\S]*aria-pressed=\{viewMode === "grid"\}/);
  assert.match(results, /aria-label="Liste g\u00f6r\u00fcn\u00fcm\u00fc"[\s\S]*aria-pressed=\{viewMode === "list"\}/);
});

test("listing empty state uses the localized copy and no-results image asset", () => {
  const empty = readProjectFile("components/listings/listing-empty-state.tsx");
  const imagePath = "public/property-nextjs-pro/images/not-found/no-results.png";

  assert.match(empty, /src="\/property-nextjs-pro\/images\/not-found\/no-results\.png"/);
  assert.match(empty, /Bu kriterlere uygun ilan bulunamad\u0131\./);
  assert.equal(existsSync(join(process.cwd(), imagePath)), true);
});
