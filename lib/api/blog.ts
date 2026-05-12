import { getPayload } from "payload";

import configPromise from "../../payload.config.ts";
import type { BlogPreviewPost } from "@/types/blog";

export const FALLBACK_BLOG_PREVIEW_POSTS: BlogPreviewPost[] = [
  {
    title: "Kiralama Sürecinde Dikkat Edilecekler",
    slug: "kiralama-surecinde-dikkat-edilecekler",
    excerpt: "Sözleşme, depozito ve ilk ay ödeme adımlarında güvenli ilerlemek için temel notlar.",
    categoryLabel: "Kiralama",
    publishedAt: "2026-05-01",
    coverImageUrl: "/property-nextjs-pro/images/blog/blog-image.jpg",
    coverImageAlt: "Modern bir yaşam alanı",
  },
  {
    title: "Yatırım İçin Bölge Seçimi",
    slug: "yatirim-icin-bolge-secimi",
    excerpt: "Lokasyon, ulaşım ve kira potansiyelini birlikte değerlendirerek doğru portföyü seçin.",
    categoryLabel: "Yatırım",
    publishedAt: "2026-04-18",
    coverImageUrl: "/property-nextjs-pro/images/blog/blogdetail-1.jpg",
    coverImageAlt: "Gayrimenkul rehberi görseli",
  },
  {
    title: "İlan İncelerken Kontrol Listesi",
    slug: "ilan-incelerken-kontrol-listesi",
    excerpt: "Fotoğraf, fiyat, konum ve danışman iletişimi üzerinden hızlı bir ön değerlendirme yapın.",
    categoryLabel: "Rehber",
    publishedAt: "2026-04-05",
    coverImageUrl: "/property-nextjs-pro/images/properties/prop-7.jpg",
    coverImageAlt: "Deniz manzaralı konut",
  },
];

type PayloadBlogPostDoc = {
  title?: unknown;
  slug?: unknown;
  excerpt?: unknown;
  category?: { title?: unknown } | number | string | null;
  publishedAt?: unknown;
  createdAt?: unknown;
  coverImageUrl?: unknown;
  coverImageAlt?: unknown;
};

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function localImageOrFallback(value: unknown, fallback: string): string {
  const image = stringOrNull(value);
  return image?.startsWith("/") ? image : fallback;
}

function mapPayloadPostToPreview(
  doc: PayloadBlogPostDoc,
  fallback: BlogPreviewPost,
): BlogPreviewPost {
  const category =
    doc.category && typeof doc.category === "object"
      ? stringOrNull(doc.category.title)
      : null;

  return {
    title: stringOrNull(doc.title) ?? fallback.title,
    slug: stringOrNull(doc.slug) ?? fallback.slug,
    excerpt: stringOrNull(doc.excerpt) ?? fallback.excerpt,
    categoryLabel: category ?? fallback.categoryLabel,
    publishedAt: stringOrNull(doc.publishedAt) ?? stringOrNull(doc.createdAt) ?? fallback.publishedAt,
    coverImageUrl: localImageOrFallback(doc.coverImageUrl, fallback.coverImageUrl),
    coverImageAlt: stringOrNull(doc.coverImageAlt) ?? fallback.coverImageAlt,
  };
}

export async function listPublishedBlogPreviewPosts(): Promise<BlogPreviewPost[]> {
  try {
    const payload = await getPayload({ config: configPromise });
    const result = await payload.find({
      collection: "blog_posts",
      where: {
        status: { equals: "published" },
      },
      sort: "-publishedAt",
      limit: 3,
      depth: 1,
      overrideAccess: false,
    });

    const posts = result.docs
      .slice(0, 3)
      .map((doc, index) =>
        mapPayloadPostToPreview(
          doc as unknown as PayloadBlogPostDoc,
          FALLBACK_BLOG_PREVIEW_POSTS[index] ?? FALLBACK_BLOG_PREVIEW_POSTS[0],
        ),
      );

    return posts.length > 0 ? posts : FALLBACK_BLOG_PREVIEW_POSTS;
  } catch {
    return FALLBACK_BLOG_PREVIEW_POSTS;
  }
}
