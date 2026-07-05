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

test("public site property-pro.css does not contain data-aos rules", () => {
  const css = stripCssComments(readProjectFile("app/(site)/property-pro.css"));

  assert.equal(
    /\[data-aos[^\]]*\]/.test(css),
    false,
    "Do not add scoped data-aos rules here.",
  );
  assert.equal(
    /aos-animate/.test(css),
    false,
    "Do not add aos-animate rules in property-pro.css.",
  );
});

test("public site layout does not use AOS (removed due to Vercel blank page bug)", () => {
  const layout = readProjectFile("app/(site)/layout.tsx");

  assert.doesNotMatch(layout, /import "aos\/dist\/aos\.css";/, "AOS CSS must not be imported in layout.");
  assert.doesNotMatch(layout, /<AosInit>/, "AosInit wrapper must not be used in layout.");
  assert.doesNotMatch(layout, /from "aos"/, "AOS JS must not be imported in layout.");
});

test("public header keeps scroll stickiness listener passive and independent from mobile menu state", () => {
  const source = readProjectFile("components/site/public-header.tsx");
  const scrollRegistrations = [...source.matchAll(/window\.addEventListener\("scroll"/g)];
  const scrollRegistrationIndex = source.indexOf('window.addEventListener("scroll", handleScroll, { passive: true })');
  const stableEffectDependencyIndex = source.indexOf("  }, []);", scrollRegistrationIndex);
  const outsideClickDependencyIndex = source.indexOf("  }, [navbarOpen]);");

  assert.equal(scrollRegistrations.length, 1, "PublicHeader should register exactly one scroll listener.");
  assert.match(source, /window\.addEventListener\("scroll", handleScroll, \{\s*passive: true\s*\}\)/);
  assert.ok(stableEffectDependencyIndex > scrollRegistrationIndex, "Scroll listener should live in an empty-dependency effect.");
  assert.ok(
    outsideClickDependencyIndex > stableEffectDependencyIndex,
    "navbarOpen-dependent outside-click effect should be separate from the scroll effect.",
  );
});

test("home page renders template-adapted sections after featured listings without changing data flow", () => {
  const page = readProjectFile("app/(site)/page.tsx");

  assert.match(page, /import \{ DiscoverProperties \} from "@\/components\/home\/discover-properties";/);
  assert.match(page, /import \{ HomeFeatures \} from "@\/components\/home\/home-features";/);
  assert.match(page, /<FeaturedListings listings=\{featuredListings\} source=\{featuredListingsSource\} \/>[\s\S]*<DiscoverProperties \/>[\s\S]*<HomeFeatures \/>/);
  assert.match(page, /listPublicListingsForServerPage\(\{ limit: 6 \}\)/);
  assert.doesNotMatch(page, /tmp\/templates|property-nextjs-pro\/package\/src/);
});

test("public listing server pages use direct server read helper instead of self-fetch API client", () => {
  const homePage = readProjectFile("app/(site)/page.tsx");
  const listingsPage = readProjectFile("app/(site)/listings/page.tsx");
  const listingDetailPage = readProjectFile("app/(site)/listings/[id]/page.tsx");

  for (const source of [homePage, listingsPage]) {
    assert.doesNotMatch(source, /@\/lib\/api\/listings/);
    assert.match(
      source,
      /import \{ listPublicListingsForServerPage \} from "@\/lib\/read-models\/public-listings";/,
    );
    assert.match(source, /listPublicListingsForServerPage\(/);
  }

  assert.doesNotMatch(listingDetailPage, /@\/lib\/api\/listings/);
  assert.match(
    listingDetailPage,
    /import \{ getPublicListingDetailForServerPage \} from "@\/lib\/read-models\/public-listings";/,
  );
  assert.match(listingDetailPage, /cache\(getPublicListingDetailForServerPage\)/);
  assert.match(listingDetailPage, /import \{ notFound, redirect \} from "next\/navigation";/);
  assert.match(listingDetailPage, /if \(isUuid\(id\)\) \{\s*redirect\(`\/listings\/\$\{listing\.slug\}`\);\s*\}/);
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
  assert.doesNotMatch(discover, /data-aos/, "data-aos attributes must not be present (AOS removed).");
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
  assert.doesNotMatch(features, /data-aos/, "data-aos attributes must not be present (AOS removed).");
  assert.doesNotMatch(features, /\/api\/propertydata|\/api\/pagedata|fetch\(|favorite|heart|M12 21\.35|Save Your Money|Calculator/);

  assert.equal(existsSync(join(process.cwd(), "public/property-nextjs-pro/images/features/features_iimage.jpg")), true);
});
