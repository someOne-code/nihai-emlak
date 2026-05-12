import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const homeComponentPaths = [
  "components/home/discover-properties.tsx",
  "components/home/home-features.tsx",
] as const;

function readProjectFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function classNamesFrom(source: string): string[] {
  return [...source.matchAll(/className="([^"]+)"/g)].map((match) => match[1]);
}

test("home template sections use site-owned light and dark background tokens", () => {
  const css = readProjectFile("app/(site)/property-pro.css");

  assert.match(css, /\.property-pro \.bg-property-light\s*\{/);
  assert.match(css, /\.dark \.property-pro \.bg-property-light\s*\{/);
  assert.match(css, /\.property-pro \.bg-property-surface\s*\{/);
  assert.match(css, /\.dark \.property-pro \.bg-property-surface\s*\{/);

  for (const path of homeComponentPaths) {
    const source = readProjectFile(path);

    assert.doesNotMatch(
      source,
      /dark:bg-darkmode/,
      `${path} must not use dark:bg-darkmode because darkmode is not a configured Tailwind color.`,
    );
  }
});

test("home template section roots are theme-aware in both light and dark mode", () => {
  for (const path of homeComponentPaths) {
    const source = readProjectFile(path);
    const sectionClassNames = [...source.matchAll(/<section className="([^"]+)"/g)].map((match) => match[1]);

    assert.equal(sectionClassNames.length, 1, `${path} should expose one home section root.`);

    const [sectionClassName] = sectionClassNames;
    assert.match(sectionClassName, /\bbg-property-light\b/, `${path} should use the shared themed section background.`);
    assert.doesNotMatch(sectionClassName, /\bbg-white\b/, `${path} section root must not stay white in dark mode.`);
  }
});

test("discover property category cards all navigate to the public listings page", () => {
  const source = readProjectFile("components/home/discover-properties.tsx");
  const categoryBlock = source.match(/const propertyCategories = \[([\s\S]*?)\] as const;/);

  assert.ok(categoryBlock, "Discover categories should remain local static data.");

  const labels = [...categoryBlock[1].matchAll(/label: "([^"]+)"/g)].map((match) => match[1]);
  const hrefs = [...categoryBlock[1].matchAll(/href: "([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(labels, ["Daire", "Villa", "Ofis", "Müstakil Ev", "Lüks Konut", "Ticari"]);
  assert.equal(hrefs.length, labels.length);
  assert.deepEqual(
    hrefs,
    labels.map(() => "/listings"),
    "Every Discover Properties category card must send users to the İlanlar page.",
  );
});

test("home template sections include the requested localized descriptions", () => {
  const discover = readProjectFile("components/home/discover-properties.tsx");
  const features = readProjectFile("components/home/home-features.tsx");

  assert.match(
    discover,
    /İhtiyacınıza uygun kiralık ve satılık ilanları kolayca keşfedin\./,
    "Discover Properties should include the requested Turkish description.",
  );
  assert.match(
    features,
    /Kiralama ve satın alma süreçlerinde güvenli, hızlı ve şeffaf bir deneyim sunuyoruz\./,
    "Features should include the requested Turkish description.",
  );
});

test("home template white surfaces have explicit dark-mode surface pairs", () => {
  for (const path of homeComponentPaths) {
    const source = readProjectFile(path);
    const unsafeWhiteSurfaces = classNamesFrom(source).filter(
      (className) => /\bbg-white\b/.test(className) && !/\bbg-property-surface\b/.test(className),
    );

    assert.deepEqual(
      unsafeWhiteSurfaces,
      [],
      `${path} has bg-white surfaces without the shared bg-property-surface dark pair.`,
    );
  }
});

test("home template text tokens keep readable light and dark contrast", () => {
  for (const path of homeComponentPaths) {
    const source = readProjectFile(path);
    const themedTextClasses = classNamesFrom(source).filter((className) => /text-property-midnight/.test(className));

    assert.ok(themedTextClasses.length > 0, `${path} should use the Property text palette.`);

    for (const className of themedTextClasses) {
      assert.match(
        className,
        /dark:text-white/,
        `${path} text class "${className}" must include a dark-mode readable text pair.`,
      );
    }
  }
});
