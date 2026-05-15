import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function readProjectFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("blog detail route renders published posts through the public chrome", () => {
  const page = readProjectFile("app/(site)/blog/[slug]/page.tsx");

  assert.match(page, /import \{ notFound \} from "next\/navigation";/);
  assert.match(page, /import \{ PublicHeader \} from "@\/components\/site\/public-header";/);
  assert.match(page, /import \{ PublicFooter \} from "@\/components\/site\/public-footer";/);
  assert.match(page, /import \{ getPublishedBlogDetailPost \} from "@\/lib\/api\/blog";/);
  assert.match(page, /const post = await getPublishedBlogDetailPost\(slug\);/);
  assert.match(page, /if \(!post\) notFound\(\);/);
  assert.match(page, /<article/);
  assert.match(page, /\{post\.readTime\} okuma/);
  assert.match(page, /Bloga D/);
  assert.doesNotMatch(page, /BlogPostPlaceholder|yakında|yakÄ±nda|Seçilen yazı|SeÃ§ilen yazÄ±/);
});

test("blog detail route exposes dynamic metadata from the published post", () => {
  const page = readProjectFile("app/(site)/blog/[slug]/page.tsx");

  assert.match(page, /export async function generateMetadata/);
  assert.match(page, /getPublishedBlogDetailPost\(slug\)/);
  assert.match(page, /const title = post\.seoTitle \?\? post\.title/);
  assert.match(page, /const description = post\.seoDescription \?\? post\.excerpt/);
  assert.match(page, /title: `\$\{title\} \| Nihai Emlak`/);
  assert.match(page, /description,/);
  assert.match(page, /openGraph:/);
  assert.match(page, /twitter:/);
  assert.match(page, /alternates:/);
  assert.doesNotMatch(page, /notFound\(\)[\s\S]*metadata/);
});

test("blog detail API fetches only published posts by slug with public Payload access", () => {
  const source = readProjectFile("lib/api/blog.ts");

  assert.match(source, /export async function getPublishedBlogDetailPost\(slug: string\)/);
  assert.match(source, /collection: "blog_posts"/);
  assert.match(source, /slug: \{ equals: slug \}/);
  assert.match(source, /status: \{ equals: "published" \}/);
  assert.match(source, /limit: 1/);
  assert.match(source, /depth: 1/);
  assert.match(source, /overrideAccess: false/);
  assert.doesNotMatch(source, /overrideAccess: true|service_role/);
});

test("blog detail content is rendered as safe text paragraphs, not raw HTML", () => {
  const page = readProjectFile("app/(site)/blog/[slug]/page.tsx");
  const source = readProjectFile("lib/api/blog.ts");

  assert.match(source, /contentParagraphs: normalizeBlogContentParagraphs/);
  assert.match(source, /split\(\/\\n\{2,\}\/\)/);
  assert.match(page, /post\.contentParagraphs\.map/);
  assert.match(page, /<p/);
  assert.doesNotMatch(page, /dangerouslySetInnerHTML|sanitizeHtml|DOMPurify/i);
});

test("blog detail surface has no consultant author avatar or byline contract", () => {
  const page = readProjectFile("app/(site)/blog/[slug]/page.tsx");
  const types = readProjectFile("types/blog.ts");

  assert.doesNotMatch(page, /\/consultants|Danışman|DanÄ±ÅŸman|Yazar|author|avatar|byline|profile/i);
  assert.doesNotMatch(types, /author|avatar|byline|consultant/i);
});

test("blog list and preview links continue to target the detail slug route", () => {
  const list = readProjectFile("components/blog/blog-list-page.tsx");
  const preview = readProjectFile("components/blog/blog-preview-card.tsx");

  assert.match(list, /href=\{`\/blog\/\$\{post\.slug\}`\}/);
  assert.match(preview, /href=\{`\/blog\/\$\{post\.slug\}`\}/);
});
