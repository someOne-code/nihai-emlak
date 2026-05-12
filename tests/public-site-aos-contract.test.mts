import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function readProjectFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

test("public site keeps AOS motion controlled by the upstream AOS stylesheet", () => {
  const css = stripCssComments(readProjectFile("app/(site)/property-pro.css"));

  assert.equal(
    /\[data-aos[^\]]*\]/.test(css),
    false,
    "Do not add scoped data-aos rules here; they override aos/dist/aos.css and make template scroll animations look static.",
  );
  assert.equal(
    /aos-animate/.test(css),
    false,
    "Do not override aos-animate in property-pro.css; AOS must add/remove that class on scroll.",
  );
  assert.equal(
    /prefers-reduced-motion/.test(css),
    false,
    "Do not disable AOS transitions in property-pro.css; this site mirrors the Property template motion behavior.",
  );
});

test("public site layout owns AOS css and initialization wrapper", () => {
  const layout = readProjectFile("app/(site)/layout.tsx");

  assert.match(layout, /import "aos\/dist\/aos\.css";/);
  assert.match(layout, /<AosInit>/);
});

test("AOS initialization waits for page load so animation classes do not race React hydration", () => {
  const source = readProjectFile("components/site/aos-init.tsx");

  assert.match(source, /window\.addEventListener\("load", initializeAos/);
  assert.match(source, /window\.setTimeout/);
  assert.match(source, /AOS\.refreshHard\(\)/);
  assert.match(source, /window\.removeEventListener\("load", initializeAos\)/);
});

test("home page renders template-adapted sections after featured listings without changing data flow", () => {
  const page = readProjectFile("app/(site)/page.tsx");

  assert.match(page, /import \{ DiscoverProperties \} from "@\/components\/home\/discover-properties";/);
  assert.match(page, /import \{ HomeFeatures \} from "@\/components\/home\/home-features";/);
  assert.match(page, /<FeaturedListings listings=\{featuredListings\} source=\{featuredListingsSource\} \/>[\s\S]*<DiscoverProperties \/>[\s\S]*<HomeFeatures \/>/);
  assert.match(page, /listPublicListings\(\{ limit: 6 \}\)/);
  assert.doesNotMatch(page, /tmp\/templates|property-nextjs-pro\/package\/src/);
});

test("home discover properties section uses local static categories and copied public assets", () => {
  const discover = readProjectFile("components/home/discover-properties.tsx");

  assert.match(discover, /Gayrimenkul T[üu]rlerini Ke[sş]fedin/);
  assert.match(discover, /const propertyCategories = \[/);
  assert.match(discover, /Daire/);
  assert.match(discover, /Villa/);
  assert.match(discover, /Ofis/);
  assert.match(discover, /M[üu]stakil Ev/);
  assert.match(discover, /L[üu]ks Konut/);
  assert.match(discover, /Ticari/);
  assert.match(discover, /grid-cols-2[\s\S]*lg:grid-cols-6/);
  assert.match(discover, /group-hover:-translate-y-1/);
  assert.match(discover, /data-aos="fade-up"/);
  assert.doesNotMatch(discover, /PropertyContext|updateFilter|\/api\/propertydata|fetch\(/);

  assert.equal(existsSync(join(process.cwd(), "public/property-nextjs-pro/images/properties/prop-1.jpg")), true);
  assert.equal(existsSync(join(process.cwd(), "public/property-nextjs-pro/images/properties/prop-6.jpg")), true);
});

test("home features section is static, localized, image-led, and excludes favorite/calculator UI", () => {
  const features = readProjectFile("components/home/home-features.tsx");

  assert.match(features, /Neden Bizi Se[çc]melisiniz\?/);
  assert.match(features, /G[üu]venilir [İI]lanlar/);
  assert.match(features, /Kiralama S[üu]recinde Destek/);
  assert.match(features, /Dan[ıi][sş]manla H[ıi]zl[ıi] [İI]leti[sş]im/);
  assert.match(features, /\/property-nextjs-pro\/images\/features\/features_iimage\.jpg/);
  assert.match(features, /data-aos="fade-right"/);
  assert.match(features, /data-aos="fade-left"/);
  assert.doesNotMatch(features, /\/api\/propertydata|\/api\/pagedata|fetch\(|favorite|heart|M12 21\.35|Save Your Money|Calculator/);

  assert.equal(existsSync(join(process.cwd(), "public/property-nextjs-pro/images/features/features_iimage.jpg")), true);
});
