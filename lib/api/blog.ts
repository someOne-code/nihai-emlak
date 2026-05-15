import { getPayload } from "payload";

import configPromise from "../../payload.config.ts";
import type { BlogDetailPost, BlogListPost, BlogPreviewPost } from "@/types/blog";

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

export const FALLBACK_BLOG_LIST_POSTS: BlogListPost[] = [
  {
    title: "2024'te İstanbul'da Kira Getirisi En Yüksek 5 Semt",
    slug: "istanbul-kira-getirisi-en-yuksek-5-semt",
    excerpt:
      "Yatırım amaçlı gayrimenkul arayanlar için İstanbul'un en yüksek kira getirisi sunan bölgelerini analiz ettik. Veriye dayalı karşılaştırma ve uzman yorumları.",
    categoryLabel: "Yatırım",
    publishedAt: "2024-03-15",
    readTime: "6 dk",
    coverImageUrl: "/property-nextjs-pro/images/blog/blogdetail-1.jpg",
    coverImageAlt: "İstanbul silüeti ve Galata çevresi",
  },
  {
    title: "Ev Alırken Dikkat Edilmesi Gereken 10 Kritik Nokta",
    slug: "ev-alirken-dikkat-edilmesi-gereken-10-kritik-nokta",
    excerpt:
      "İlk kez ev alacaklar için kapsamlı rehber. Tapu kontrolünden kredi sürecine, ekspertizden sözleşme detaylarına kadar bilmeniz gerekenler.",
    categoryLabel: "Alıcı Rehberi",
    publishedAt: "2024-03-08",
    readTime: "8 dk",
    coverImageUrl: "/property-nextjs-pro/images/blog/blog-image.jpg",
    coverImageAlt: "Ev modeli ve anahtar",
  },
  {
    title: "Kadıköy'de Yaşam Rehberi: Mahalleler, Ulaşım ve Yaşam Kalitesi",
    slug: "kadikoy-yasam-rehberi-mahalleler-ulasim",
    excerpt:
      "Kadıköy'ün en popüler mahallelerini, ulaşım ağını, sosyal olanaklarını ve gayrimenkul piyasasını detaylı inceledik.",
    categoryLabel: "Bölge Rehberi",
    publishedAt: "2024-02-20",
    readTime: "7 dk",
    coverImageUrl: "/property-nextjs-pro/images/properties/prop-11.jpg",
    coverImageAlt: "Modern şehir binaları",
  },
  {
    title: "Gayrimenkul Yatırımında Vergi Avantajları ve Yasal Düzenlemeler",
    slug: "gayrimenkul-yatiriminda-vergi-avantajlari",
    excerpt:
      "Gayrimenkul alım-satım ve kiralamada vergi yükümlülükleri, muafiyetler ve yatırımcılar için yasal avantajlar.",
    categoryLabel: "Hukuk & Vergi",
    publishedAt: "2024-02-10",
    readTime: "5 dk",
    coverImageUrl: "/property-nextjs-pro/images/properties/prop-12.jpg",
    coverImageAlt: "Sözleşme imzalayan kişi",
  },
  {
    title: "İstanbul Konut Piyasası 2024 Q1 Raporu",
    slug: "istanbul-konut-piyasasi-2024-q1-raporu",
    excerpt:
      "2024 ilk çeyrek İstanbul konut piyasası analizi. Fiyat trendleri, talep değişimleri ve bölgesel karşılaştırmalar.",
    categoryLabel: "Piyasa Analizi",
    publishedAt: "2024-04-01",
    readTime: "6 dk",
    coverImageUrl: "/property-nextjs-pro/images/properties/prop-15.jpg",
    coverImageAlt: "Yüksek katlı iş merkezleri",
  },
  {
    title: "Yabancılar İçin Türkiye'de Gayrimenkul Satın Alma Rehberi",
    slug: "yabancilar-icin-turkiyede-gayrimenkul-satin-alma-rehberi",
    excerpt:
      "Yabancı yatırımcılar için Türkiye'de mülk edinme süreci, gerekli belgeler, vatandaşlık programı ve oturum izni bilgileri.",
    categoryLabel: "Alıcı Rehberi",
    publishedAt: "2024-01-25",
    readTime: "9 dk",
    coverImageUrl: "/property-nextjs-pro/images/properties/prop-7.jpg",
    coverImageAlt: "İstanbul'da tarihi cami ve şehir manzarası",
  },
];

type PayloadBlogPostDoc = {
  title?: unknown;
  slug?: unknown;
  excerpt?: unknown;
  content?: unknown;
  category?: { title?: unknown } | number | string | null;
  publishedAt?: unknown;
  createdAt?: unknown;
  coverImageUrl?: unknown;
  coverImageAlt?: unknown;
  readTime?: unknown;
  seoTitle?: unknown;
  seoDescription?: unknown;
};

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function localImageOrFallback(value: unknown, fallback: string): string {
  const image = stringOrNull(value);
  return image?.startsWith("/") ? image : fallback;
}

function calculateReadTime(content: string | null): string {
  const wordCount = content?.trim().split(/\s+/).filter(Boolean).length ?? 0;
  const minutes = Math.max(1, Math.ceil(wordCount / 180));
  return `${minutes} dk`;
}

function normalizeBlogContentParagraphs(value: unknown): string[] {
  const content = stringOrNull(value);
  if (!content) return [];

  return content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
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

function mapPayloadPostToList(
  doc: PayloadBlogPostDoc,
  fallback: BlogListPost,
): BlogListPost {
  return {
    ...mapPayloadPostToPreview(doc, fallback),
    readTime: stringOrNull(doc.readTime) ?? calculateReadTime(stringOrNull(doc.content)) ?? fallback.readTime,
  };
}

function mapPayloadPostToDetail(doc: PayloadBlogPostDoc): BlogDetailPost | null {
  const title = stringOrNull(doc.title);
  const slug = stringOrNull(doc.slug);
  const excerpt = stringOrNull(doc.excerpt);
  const content = stringOrNull(doc.content);

  if (!title || !slug || !excerpt || !content) return null;

  const category =
    doc.category && typeof doc.category === "object"
      ? stringOrNull(doc.category.title)
      : null;

  return {
    title,
    slug,
    excerpt,
    categoryLabel: category ?? "Blog",
    publishedAt: stringOrNull(doc.publishedAt) ?? stringOrNull(doc.createdAt),
    coverImageUrl: localImageOrFallback(
      doc.coverImageUrl,
      "/property-nextjs-pro/images/blog/blogdetail-1.jpg",
    ),
    coverImageAlt: stringOrNull(doc.coverImageAlt) ?? title,
    readTime: stringOrNull(doc.readTime) ?? calculateReadTime(content),
    contentParagraphs: normalizeBlogContentParagraphs(doc.content),
    seoTitle: stringOrNull(doc.seoTitle),
    seoDescription: stringOrNull(doc.seoDescription),
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

export async function listPublishedBlogListPosts(): Promise<BlogListPost[]> {
  try {
    const payload = await getPayload({ config: configPromise });
    const result = await payload.find({
      collection: "blog_posts",
      where: {
        status: { equals: "published" },
      },
      sort: "-publishedAt",
      limit: 6,
      depth: 1,
      overrideAccess: false,
    });

    const posts = result.docs
      .slice(0, 6)
      .map((doc, index) =>
        mapPayloadPostToList(
          doc as unknown as PayloadBlogPostDoc,
          FALLBACK_BLOG_LIST_POSTS[index] ?? FALLBACK_BLOG_LIST_POSTS[0],
        ),
      );

    return posts.length > 0 ? posts : FALLBACK_BLOG_LIST_POSTS;
  } catch {
    return FALLBACK_BLOG_LIST_POSTS;
  }
}

export async function getPublishedBlogDetailPost(slug: string): Promise<BlogDetailPost | null> {
  try {
    const payload = await getPayload({ config: configPromise });
    const result = await payload.find({
      collection: "blog_posts",
      where: {
        and: [
          { slug: { equals: slug } },
          { status: { equals: "published" } },
        ],
      },
      limit: 1,
      depth: 1,
      overrideAccess: false,
    });

    const doc = result.docs[0] as unknown as PayloadBlogPostDoc | undefined;
    return doc ? mapPayloadPostToDetail(doc) : null;
  } catch {
    return null;
  }
}
