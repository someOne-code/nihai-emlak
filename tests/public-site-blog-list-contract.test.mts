import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function readProjectFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("blog list page renders the public chrome and replaces the placeholder with the requested list surface", () => {
  const page = readProjectFile("app/(site)/blog/page.tsx");

  assert.match(page, /import \{ PublicHeader \} from "@\/components\/site\/public-header";/);
  assert.match(page, /import \{ PublicFooter \} from "@\/components\/site\/public-footer";/);
  assert.match(page, /import \{ BlogListPage \} from "@\/components\/blog\/blog-list-page";/);
  assert.match(page, /import \{ listPublishedBlogListPosts \} from "@\/lib\/api\/blog";/);
  assert.match(page, /const posts = await listPublishedBlogListPosts\(\);/);
  assert.match(page, /<BlogListPage posts=\{posts\} \/>/);
  assert.doesNotMatch(page, /BlogIndexPlaceholder|yak[ıi]nda|Ana Sayfaya D[öo]n/);
});

test("blog list component exposes the requested categories and interactive accessible filter buttons", () => {
  const source = readProjectFile("components/blog/blog-list-page.tsx");

  for (const label of ["Tümü", "Yatırım", "Bölge Rehberi", "Alıcı Rehberi", "Hukuk & Vergi", "Piyasa Analizi"]) {
    assert.match(source, new RegExp(label.replace("&", "\\&")));
  }

  assert.match(source, /"use client";/);
  assert.match(source, /useMemo/);
  assert.match(source, /useState/);
  assert.match(source, /aria-pressed=\{activeCategory === category\}/);
  assert.match(source, /onClick=\{\(\) => setActiveCategory\(category\)\}/);
  assert.match(source, /activeCategory === ALL_CATEGORIES_LABEL/);
  assert.match(source, /filteredPosts/);
});

test("blog list filters are derived from published backend post categories", () => {
  const source = readProjectFile("components/blog/blog-list-page.tsx");

  assert.match(source, /const categoryOptions = useMemo/);
  assert.match(source, /new Set\(posts\.map\(\(post\) => post\.categoryLabel\)\)/);
  assert.match(source, /\{categoryOptions\.map\(\(category\) => \{/);
  assert.doesNotMatch(source, /BLOG_CATEGORIES\.map\(\(category\) => \{/);
});

test("blog list cards match the reference anatomy while preserving site image and motion conventions", () => {
  const source = readProjectFile("components/blog/blog-list-page.tsx");

  assert.match(source, /from "next\/image"/);
  assert.match(source, /from "next\/link"/);
  assert.match(source, /<article/);
  assert.match(source, /<time/);
  assert.match(source, /readTime/);
  assert.match(source, /\{post\.readTime\} okuma/);
  assert.match(source, /Devamını oku/);
  assert.match(source, /ArrowRight/);
  assert.doesNotMatch(source, /data-aos=/);
  assert.match(source, /bg-property-hero/);
  assert.match(source, /group-hover:scale-105/);
  assert.match(source, /hover:-translate-y-1/);
  assert.match(source, /grid-cols-1[\s\S]*md:grid-cols-2[\s\S]*xl:grid-cols-3[\s\S]*2xl:grid-cols-4/);
  assert.match(source, /Daha Fazla Y[üu]kle/);
  assert.doesNotMatch(source, /\/consultants|Dan[ıi]şman Profili|consultant|authorName|avatar/i);
});

test("blog list data has render-ready fallback posts with categories, read times, and local covers", () => {
  const source = readProjectFile("lib/api/blog.ts");

  assert.match(source, /FALLBACK_BLOG_LIST_POSTS/);
  assert.match(source, /listPublishedBlogListPosts/);
  assert.match(source, /limit: 6/);
  assert.match(source, /overrideAccess: false/);

  for (const label of ["Yatırım", "Bölge Rehberi", "Alıcı Rehberi", "Hukuk & Vergi", "Piyasa Analizi"]) {
    assert.match(source, new RegExp(`categoryLabel: "${label.replace("&", "\\&")}"`));
  }

  assert.match(source, /readTime: "[0-9]+ dk"/);
  assert.match(source, /coverImageUrl: "\/property-nextjs-pro\/images\//);
  assert.doesNotMatch(source, /authorName|avatarUrl|author: \{/);
  assert.doesNotMatch(source, /service_role|overrideAccess: true/);
});

test("blog category filters do not show the empty state when the selected category has one featured post", () => {
  const source = readProjectFile("components/blog/blog-list-page.tsx");

  assert.match(source, /const hasFilteredPosts = filteredPosts\.length > 0;/);
  assert.match(source, /const isAllCategoriesActive = activeCategory === ALL_CATEGORIES_LABEL;/);
  assert.match(source, /const hasGridPosts = gridPosts\.length > 0;/);
  assert.match(source, /\{hasGridPosts \? \(/);
  assert.match(source, /\{!hasFilteredPosts \? \(/);
  assert.doesNotMatch(source, /gridPosts\.length > 0 \?[\s\S]*Bu kategoride yay/);
});

test("blog featured card is only shown on the all categories view", () => {
  const source = readProjectFile("components/blog/blog-list-page.tsx");

  assert.match(
    source,
    /const featuredPost = isAllCategoriesActive && hasFilteredPosts \? filteredPosts\[0\] : null;/,
  );
  assert.match(source, /\{featuredPost \? <FeaturedBlogCard post=\{featuredPost\} \/> : null\}/);
  assert.doesNotMatch(source, /const featuredPost = hasFilteredPosts \? filteredPosts\[0\] : null;/);
});

test("blog empty state does not keep list-only controls visible", () => {
  const source = readProjectFile("components/blog/blog-list-page.tsx");

  assert.match(source, /\{hasFilteredPosts \? \([\s\S]*Daha Fazla Y/);
  assert.match(source, /\{!hasFilteredPosts \? \([\s\S]*Bu kategoride yay/);
});

test("blog fallback categories stay covered by the public filter tabs", () => {
  const componentSource = readProjectFile("components/blog/blog-list-page.tsx");
  const dataSource = readProjectFile("lib/api/blog.ts");

  const filterBlock = componentSource.match(/const DEFAULT_BLOG_CATEGORY_ORDER = \[([\s\S]*?)\] as const;/)?.[1] ?? "";
  const filterLabels = new Set(
    Array.from(filterBlock.matchAll(/"([^"]+)"/g), (match) => match[1]).filter(
      (label) => label !== "Tümü",
    ),
  );
  const fallbackLabels = new Set(
    Array.from(
      (
        dataSource.match(
          /export const FALLBACK_BLOG_LIST_POSTS: BlogListPost\[] = \[([\s\S]*?)\];/,
        )?.[1] ?? ""
      ).matchAll(/categoryLabel: "([^"]+)"/g),
      (match) => match[1],
    ),
  );

  for (const label of fallbackLabels) {
    assert.ok(filterLabels.has(label), `Missing blog filter for fallback category: ${label}`);
  }

  for (const label of filterLabels) {
    assert.ok(fallbackLabels.has(label), `Missing fallback post for blog filter: ${label}`);
  }
});
