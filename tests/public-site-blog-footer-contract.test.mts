import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function readProjectFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
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
    assert.doesNotMatch(source, /from "next\/image"/, `${path} should avoid next/image inline styles under strict CSP.`);
    assert.doesNotMatch(source, /<Image\b/, `${path} should use plain img tags under strict CSP.`);
  }
  assert.doesNotMatch(footer, /<input\b(?![^>]*(?:id=|name=))/, "Public footer form fields must have an id or name.");
  assert.doesNotMatch(footer, /newsletter-email|B[Ã¼u]lten|Abone Ol|Subscribe/);
});
