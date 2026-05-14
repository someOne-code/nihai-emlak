import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function readProjectFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function extractImageElement(source: string, marker: string, path: string): string {
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, `${path} should render an Image element containing ${marker}.`);

  const start = source.lastIndexOf("<Image", markerIndex);
  const end = source.indexOf("/>", markerIndex);
  assert.notEqual(start, -1, `${path} should use next/image for ${marker}.`);
  assert.notEqual(end, -1, `${path} should close the Image element for ${marker}.`);

  return source.slice(start, end + 2);
}

test("home page renders blog preview after services without disturbing earlier home sections", () => {
  const page = readProjectFile("app/(site)/page.tsx");

  assert.match(page, /import \{ BlogPreview \} from "@\/components\/home\/blog-preview";/);
  assert.match(page, /import \{ listPublishedBlogPreviewPosts \} from "@\/lib\/api\/blog";/);
  assert.match(page, /const blogPreviewPosts = await listPublishedBlogPreviewPosts\(\);/);
  assert.match(page, /<HomeServices \/>[\s\S]*<BlogPreview posts=\{blogPreviewPosts\} \/>[\s\S]*<CompanyInfo \/>/);
  assert.match(page, /<FeaturedListings listings=\{featuredListings\} source=\{featuredListingsSource\} \/>[\s\S]*<DiscoverProperties \/>[\s\S]*<HomeFeatures \/>[\s\S]*<HomeServices \/>/);
  assert.doesNotMatch(page, /tmp\/templates|property-nextjs-pro\/package\/src/);
});

test("public-facing image surfaces use next image optimization instead of raw img tags", () => {
  const imageSurfaces = [
    "app/(site)/page.tsx",
    "components/blog/blog-preview-card.tsx",
    "components/listings/listing-card.tsx",
    "components/listings/listing-detail-gallery.tsx",
    "components/listings/listing-gallery.tsx",
    "components/listings/listing-grid.tsx",
  ] as const;

  for (const path of imageSurfaces) {
    const source = readProjectFile(path);

    assert.match(source, /from "next\/image"/, `${path} should import next/image.`);
    assert.match(source, /<Image\b/, `${path} should render optimized Image components.`);
    assert.doesNotMatch(source, /<img\b/, `${path} should not render raw img elements in public image surfaces.`);
  }
});

test("public listing card images are optimized lazy grid images with stable dimensions", () => {
  const path = "components/listings/listing-card.tsx";
  const source = readProjectFile(path);
  const primaryImage = extractImageElement(source, "src={getListingPrimaryImage(listing)}", path);

  assert.match(source, /imageContainer relative h-\[250px\] w-full overflow-hidden/, `${path} should reserve card image height before the image loads.`);
  assert.match(primaryImage, /\bfill\b/, `${path} card image should fill a stable wrapper.`);
  assert.match(primaryImage, /sizes=\{isList \? "\(min-width: 768px\) 30vw, 100vw" : "\(min-width: 1024px\) 33vw, \(min-width: 640px\) 50vw, 100vw"\}/);
  assert.match(primaryImage, /loading="lazy"/, `${path} card images should be explicitly lazy by default.`);
  assert.doesNotMatch(primaryImage, /\bpriority\b/, `${path} should not apply blanket priority to every listing card.`);
  assert.doesNotMatch(primaryImage, /\bunoptimized\b/, `${path} card photos should use Next image optimization variants.`);
});

test("public listing detail galleries reserve layout and optimize only the above-fold main image", () => {
  const detailPath = "components/listings/listing-detail-gallery.tsx";
  const detailSource = readProjectFile(detailPath);
  const activeImage = extractImageElement(detailSource, "src={activeImage.src}", detailPath);
  const thumbnailImage = extractImageElement(detailSource, "src={img.src}", detailPath);

  assert.match(detailSource, /relative aspect-\[4\/3\] md:aspect-\[16\/9\] w-full max-h-\[500px\]/, `${detailPath} should reserve the main image aspect ratio.`);
  assert.match(activeImage, /\bfill\b/);
  assert.match(activeImage, /sizes="\(min-width: 1280px\) 768px, \(min-width: 1024px\) calc\(100vw - 496px\), 100vw"/);
  assert.match(activeImage, /\bpriority\b/, `${detailPath} should prioritize the above-fold main image only.`);
  assert.doesNotMatch(activeImage, /\bunoptimized\b/);
  assert.match(thumbnailImage, /sizes="128px"/);
  assert.match(thumbnailImage, /loading="lazy"/);
  assert.doesNotMatch(thumbnailImage, /\bpriority\b/);
  assert.doesNotMatch(thumbnailImage, /\bunoptimized\b/);

  const legacyPath = "components/listings/listing-gallery.tsx";
  const legacySource = readProjectFile(legacyPath);
  const primaryImage = extractImageElement(legacySource, "src={primary.src}", legacyPath);
  const secondaryImage = extractImageElement(legacySource, "src={image.src}", legacyPath);

  assert.match(primaryImage, /\bpriority\b/, `${legacyPath} should prioritize only its main image.`);
  assert.match(primaryImage, /sizes="\(min-width: 1280px\) 837px, \(min-width: 1024px\) 66vw, 100vw"/);
  assert.doesNotMatch(primaryImage, /\bunoptimized\b/);
  assert.match(secondaryImage, /sizes="\(min-width: 1280px\) 407px, \(min-width: 1024px\) 33vw, 100vw"/);
  assert.match(secondaryImage, /loading="lazy"/);
  assert.doesNotMatch(secondaryImage, /\bpriority\b/);
  assert.doesNotMatch(secondaryImage, /\bunoptimized\b/);
});

test("public listing image performance budget is documented as a cheap CI contract", () => {
  const contract = readProjectFile("docs/READ_MODEL_CONTRACT.md");

  assert.match(contract, /## Public Listing Image Performance Budget/);
  assert.match(contract, /\/listings/);
  assert.match(contract, /\/listings\/:listingId/);
  assert.match(contract, /meaningful content target.*under 2 seconds/i);
  assert.match(contract, /optimized variants/i);
  assert.match(contract, /below-fold.*lazy/i);
  assert.match(contract, /next\/image/i);
  assert.match(contract, /\bsizes\b/);
  assert.match(contract, /Do not add Lighthouse/i);
});

test("blog preview is a localized three-card public section with working blog links", () => {
  const preview = readProjectFile("components/home/blog-preview.tsx");
  const card = readProjectFile("components/blog/blog-preview-card.tsx");

  assert.match(preview, /BLOG/);
  assert.match(preview, /G[üu]ncel [İI]çerikler/);
  assert.match(preview, /Kiralama, yat[ıi]r[ıi]m ve gayrimenkul s[üu]re[çc]leri hakk[ıi]nda g[üu]ncel i[çc]erikleri ke[sş]fedin\./);
  assert.match(preview, /grid-cols-1[\s\S]*lg:grid-cols-3/);
  assert.match(card, /Devam[ıi]n[ıi] Oku/);
  assert.match(card, /href=\{`\/blog\/\$\{post\.slug\}`\}/);
  assert.match(card, /group-hover:scale-105/);
  assert.doesNotMatch(preview + card, /Save Your Money|Calculator|Mortgage|History|Testimonials|Müşteri Yorumları|Kurumsal Geçmiş|tmp\/templates|property-nextjs-pro\/package\/src/);
});

test("blog preview data uses published Payload Local API access with static fallback", () => {
  const source = readProjectFile("lib/api/blog.ts");

  assert.match(source, /collection: "blog_posts"/);
  assert.match(source, /overrideAccess: false/);
  assert.match(source, /status: \{ equals: "published" \}/);
  assert.match(source, /limit: 3/);
  assert.match(source, /FALLBACK_BLOG_PREVIEW_POSTS/);
  assert.doesNotMatch(source, /\/api\/admin|\/api\/blog_posts|service_role|overrideAccess: true/);

  assert.equal(existsSync(join(process.cwd(), "public/property-nextjs-pro/images/blog/blog-image.jpg")), true);
  assert.equal(existsSync(join(process.cwd(), "public/property-nextjs-pro/images/blog/blogdetail-1.jpg")), true);
});

test("blog placeholder routes exist so preview and footer blog links do not 404", () => {
  assert.equal(existsSync(join(process.cwd(), "app/(site)/blog/page.tsx")), true);
  assert.equal(existsSync(join(process.cwd(), "app/(site)/blog/[slug]/page.tsx")), true);
});

test("public footer removes popular searches while keeping core navigation", () => {
  const footer = readProjectFile("components/site/public-footer.tsx");

  assert.doesNotMatch(footer, /Pop[üu]ler Aramalar|Popular Searches|Kiral[ıi]k [İI]lanlar|Sat[ıi]l[ıi]k [İI]lanlar|Buy Property|Rent Property|Sell Property|Sat[ıi]l[ıi]k Ofisler|Kiral[ıi]k D[üu]kkanlar/);
  assert.match(footer, /href="\/"/);
  assert.match(footer, /href="\/listings"/);
  assert.match(footer, /href="\/blog"/);
  assert.match(footer, /href="\/contact"/);
});

test("public footer does not render newsletter subscription controls", () => {
  const footer = readProjectFile("components/site/public-footer.tsx");

  assert.doesNotMatch(footer, /B[üu]lten|Newsletter|Abone Ol|Subscribe|E-posta adresi|newsletter-email/);
  assert.match(footer, /Telefon:/);
  assert.match(footer, /E-posta:/);
});

test("public chrome avoids strict-CSP inline styles after newsletter removal", () => {
  const layout = readProjectFile("app/(site)/layout.tsx");
  const footer = readProjectFile("components/site/public-footer.tsx");
  const publicChromePaths = [
    "components/site/public-header.tsx",
    "components/site/public-footer.tsx",
    "components/home/discover-properties.tsx",
    "components/home/home-features.tsx",
    "components/listings/listing-card.tsx",
    "components/blog/blog-preview-card.tsx",
  ] as const;

  assert.match(layout, /enableColorScheme=\{false\}/);
  for (const path of publicChromePaths) {
    const source = readProjectFile(path);
    assert.doesNotMatch(source, /style=\{\{/, `${path} should not render inline style attributes under strict CSP.`);
  }
  assert.doesNotMatch(footer, /<input\b(?![^>]*(?:id=|name=))/, "Public footer form fields must have an id or name.");
  assert.doesNotMatch(footer, /newsletter-email|B[Ã¼u]lten|Abone Ol|Subscribe/);
});
