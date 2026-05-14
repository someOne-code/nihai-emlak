import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function readProjectFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("public listings page uses the real endpoint contract without template runtime imports", () => {
  const page = readProjectFile("app/(site)/listings/page.tsx");
  const api = readProjectFile("lib/api/listings.ts");

  assert.match(page, /getPublicListings\(\{/);
  assert.match(page, /limit:\s*(?:limit|input\.limit)/);
  assert.match(page, /offset:\s*(?:offset|input\.offset)/);
  assert.doesNotMatch(page + api, /tmp\/templates|property-nextjs-pro\/package\/src|PropertyContext|updateFilter|\/api\/pagedata/);
  assert.doesNotMatch(api, /sort/);
});

test("public listings page exposes the localized hero, filters, results, and pagination surfaces", () => {
  const page = readProjectFile("app/(site)/listings/page.tsx");
  const filters = readProjectFile("components/listings/listing-filters.tsx");
  const results = readProjectFile("components/listings/listing-results.tsx");
  const empty = readProjectFile("components/listings/listing-empty-state.tsx");

  assert.match(page, /İlanlar/);
  assert.match(page, /Kiralık ve satılık ilanları keşfedin\./);
  assert.match(page, /Ana Sayfa/);
  assert.match(page, /MobileFilterButton/);
  assert.match(page, /getPaginationHref/);

  assert.match(filters, /Gelişmiş Filtre/);
  assert.match(filters, /İlan Tipi/);
  assert.match(filters, /Tümü/);
  assert.match(filters, /Kiralık/);
  assert.match(filters, /Satılık/);
  assert.match(filters, /Şehir/);
  assert.match(filters, /İlanları Bul/);
  assert.match(filters, /Filtreleri Temizle/);

  assert.match(results, /Sıralama/);
  assert.match(results, /Fiyat artan/);
  assert.match(results, /Fiyat azalan/);
  assert.match(results, /Başlık A-Z/);
  assert.match(results, /aria-label="Grid görünümü"/);
  assert.match(results, /aria-label="Liste görünümü"/);
  assert.match(results, /viewMode=\{viewMode\}/);

  assert.match(empty, /Bu kriterlere uygun ilan bulunamadı\./);
  assert.equal(existsSync(join(process.cwd(), "public/property-nextjs-pro/images/not-found/no-results.png")), true);
});

test("public listings filters and pagination only use supported backend query parameters", () => {
  const filters = readProjectFile("components/listings/listing-filters.tsx");
  const page = readProjectFile("app/(site)/listings/page.tsx");
  const api = readProjectFile("lib/api/listings.ts");

  assert.match(filters, /setOptionalParam\(search, "type", type\)/);
  assert.match(filters, /setOptionalParam\(search, "city", city\)/);
  assert.match(filters, /setOptionalParam\(search, "district", district\)/);
  assert.match(filters, /setOptionalParam\(search, "min_price", minPrice\)/);
  assert.match(filters, /setOptionalParam\(search, "max_price", maxPrice\)/);
  assert.match(filters, /setOptionalParam\(search, "min_rooms", minRooms\)/);
  assert.match(filters, /setOptionalParam\(search, "min_bathrooms", minBathrooms\)/);
  assert.match(filters, /setOptionalParam\(search, "min_area", minArea\)/);
  assert.match(filters, /setOptionalParam\(search, "max_area", maxArea\)/);
  assert.match(filters, /search\.set\("is_furnished", furnished\)/);
  assert.doesNotMatch(filters + page, /distance|radius|harita/i);
  assert.doesNotMatch(api, /params\.set\("sort"/);

  assert.match(page, /offset > 0/);
  assert.match(page, /items\.length === limit/);
  assert.match(page, /Math\.max\(0, offset - limit\)/);
  assert.match(page, /offset \+ limit/);
});

test("public listings page fetches filter metadata and passes it to desktop and mobile filters", () => {
  const page = readProjectFile("app/(site)/listings/page.tsx");
  const filters = readProjectFile("components/listings/listing-filters.tsx");
  const api = readProjectFile("lib/api/listings.ts");

  assert.match(api, /getPublicListingFilters/);
  assert.match(api, /\/api\/public\/listing-filters/);
  assert.match(page, /getPublicListingFilters\(\)/);
  assert.match(page, /filters=\{filterMetadata\}/);
  assert.match(filters, /safeFilters\.districts\.filter/);
  assert.match(filters, /disabled=\{!selectedCity\}/);
  assert.match(filters, /priceRange/);
  assert.match(filters, /areaRange/);
});
