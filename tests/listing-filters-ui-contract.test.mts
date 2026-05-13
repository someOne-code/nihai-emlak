import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function readProjectFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("listing filters render backend-provided city and city-scoped district selects", () => {
  const filters = readProjectFile("components/listings/listing-filters.tsx");

  assert.match(filters, /filters: PublicListingFilters/);
  assert.match(filters, /const cityOptions = safeFilters\.cities/);
  assert.match(filters, /cityOptions\.map/);
  assert.match(filters, /name="city"/);
  assert.match(filters, /setSelectedCity/);
  assert.match(filters, /safeFilters\.districts\.filter\(\(district\) => district\.city === selectedCity\)/);
  assert.match(filters, /disabled=\{!selectedCity\}/);
  assert.doesNotMatch(filters, /<input[\s\S]*name="city"/);
});

test("listing filters submit only supported query keys and reset pagination offset", () => {
  const filters = readProjectFile("components/listings/listing-filters.tsx");

  for (const key of [
    "type",
    "city",
    "district",
    "min_price",
    "max_price",
    "min_rooms",
    "min_bathrooms",
    "min_area",
    "max_area",
    "is_furnished",
  ]) {
    assert.match(filters, new RegExp(`(?:setOptionalParam\\(search, "${key}"|search\\.set\\("${key}")`));
    assert.match(filters, new RegExp(`(?:setOptionalParam\\(search, "${key}"|search\\.delete\\("${key}"\\))`));
  }

  assert.doesNotMatch(filters, /search\.delete\("limit"\)/);
  assert.match(filters, /search\.delete\("offset"\)/);
  assert.doesNotMatch(filters, /distance|radius|map_(?:lat|lng)|search\.set\("map"/i);
  assert.doesNotMatch(filters, /tmp\/templates|property-nextjs-pro\/package\/src|PropertyContext|updateFilter/);
});

test("listing filters normalize safe defaults before reading props", () => {
  const filters = readProjectFile("components/listings/listing-filters.tsx");

  assert.match(filters, /EMPTY_FILTER_VALUES/);
  assert.match(filters, /EMPTY_FILTER_METADATA/);
  assert.match(filters, /const safeValues = normalizeFilterValues/);
  assert.match(filters, /const safeFilters = filters \?\? EMPTY_FILTER_METADATA/);
  assert.doesNotMatch(filters, /useState<[^>]+>\(values\./);
  assert.doesNotMatch(filters, /useState\(values\./);
  assert.doesNotMatch(filters, /const cityOptions = filters\.cities/);
});
