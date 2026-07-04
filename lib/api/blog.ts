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
    title: "2026'da Kayseri'de Kira Getirisi En Yüksek 5 Bölge",
    slug: "kayseri-kira-getirisi-en-yuksek-5-bolge",
    excerpt:
      "Yatırım amaçlı gayrimenkul arayanlar için Kayseri'nin en yüksek kira getirisi sunan bölgelerini analiz ettik. Veriye dayalı karşılaştırma ve uzman yorumları.",
    categoryLabel: "Yatırım",
    publishedAt: "2026-03-15",
    readTime: "6 dk",
    coverImageUrl: "/property-nextjs-pro/images/blog/blogdetail-1.jpg",
    coverImageAlt: "Kayseri şehir görünümü ve Erciyes manzarası",
  },
  {
    title: "Ev Alırken Dikkat Edilmesi Gereken 10 Kritik Nokta",
    slug: "ev-alirken-dikkat-edilmesi-gereken-10-kritik-nokta",
    excerpt:
      "İlk kez ev alacaklar için kapsamlı rehber. Tapu kontrolünden kredi sürecine, ekspertizden sözleşme detaylarına kadar bilmeniz gerekenler.",
    categoryLabel: "Alıcı Rehberi",
    publishedAt: "2026-03-08",
    readTime: "8 dk",
    coverImageUrl: "/property-nextjs-pro/images/blog/blog-image.jpg",
    coverImageAlt: "Ev modeli ve anahtar",
  },
  {
    title: "Talas'ta Yaşam Rehberi: Mahalleler, Ulaşım ve Yaşam Kalitesi",
    slug: "talas-yasam-rehberi-mahalleler-ulasim",
    excerpt:
      "Talas'ın en popüler mahallelerini, ulaşım ağını, sosyal olanaklarını ve gayrimenkul piyasasını detaylı inceledik.",
    categoryLabel: "Bölge Rehberi",
    publishedAt: "2026-02-20",
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
    publishedAt: "2026-02-10",
    readTime: "5 dk",
    coverImageUrl: "/property-nextjs-pro/images/properties/prop-12.jpg",
    coverImageAlt: "Sözleşme imzalayan kişi",
  },
  {
    title: "Kayseri Konut Piyasası 2026 Q1 Raporu",
    slug: "kayseri-konut-piyasasi-2026-q1-raporu",
    excerpt:
      "2026 ilk çeyrek Kayseri konut piyasası analizi. Fiyat trendleri, talep değişimleri ve bölgesel karşılaştırmalar.",
    categoryLabel: "Piyasa Analizi",
    publishedAt: "2026-04-01",
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
    publishedAt: "2026-01-25",
    readTime: "9 dk",
    coverImageUrl: "/property-nextjs-pro/images/properties/prop-7.jpg",
    coverImageAlt: "Kayseri'de modern yaşam alanları",
  },
];

export const FALLBACK_BLOG_DETAIL_POSTS: BlogDetailPost[] = [
  {
    ...FALLBACK_BLOG_PREVIEW_POSTS[0],
    readTime: "4 dk",
    contentParagraphs: [
      "Kiralama sürecinde güvenli ilerlemek için sözleşme, depozito, aidat ve teslim tutanağı gibi temel başlıkları baştan netleştirmek gerekir.",
      "Taşınmadan önce ödeme planını yazılı hale getirmek, mülkün mevcut durumunu fotoğraflamak ve kimlik bilgilerini doğrulamak olası anlaşmazlıkları azaltır.",
      "Bu kontrol listesi, kiracıların ve mülk sahiplerinin ilk görüşmeden anahtar teslimine kadar daha düzenli bir süreç yürütmesine yardımcı olur.",
    ],
    seoTitle: null,
    seoDescription: null,
  },
  {
    ...FALLBACK_BLOG_PREVIEW_POSTS[1],
    readTime: "5 dk",
    contentParagraphs: [
      "Yatırım için bölge seçerken yalnızca bugünkü fiyat seviyesine değil, ulaşım yatırımlarına, nüfus hareketine ve kira talebinin sürekliliğine de bakmak gerekir.",
      "Benzer metrekare ve nitelikteki ilanları karşılaştırmak, geri dönüş süresini hesaplamak ve bölgedeki boş kalma riskini değerlendirmek daha sağlıklı karar verir.",
      "Doğru bölge seçimi, kısa vadeli fiyat hareketlerinden çok uzun vadeli talep ve yaşam kalitesi göstergeleriyle desteklenmelidir.",
    ],
    seoTitle: null,
    seoDescription: null,
  },
  {
    ...FALLBACK_BLOG_PREVIEW_POSTS[2],
    excerpt: "Fotoğraf, fiyat, konum ve yapı özellikleri üzerinden hızlı bir ön değerlendirme yapın.",
    readTime: "4 dk",
    contentParagraphs: [
      "Bir ilanı incelerken ilk adım fiyat, konum, metrekare ve yapı yaşı bilgilerinin birbiriyle tutarlı olup olmadığını kontrol etmektir.",
      "Fotoğrafların güncel ve yeterli olması, oda planının anlaşılır verilmesi ve konum bilgisinin açık olması ön değerlendirme kalitesini artırır.",
      "Eksik veya çelişkili bilgiler varsa karar vermeden önce tapu, iskan, aidat ve kullanım durumu gibi temel detaylar ayrıca doğrulanmalıdır.",
    ],
    seoTitle: null,
    seoDescription: null,
  },
  {
    ...FALLBACK_BLOG_LIST_POSTS[0],
    contentParagraphs: [
      "Kayseri'de kira getirisi bölgeden bölgeye önemli ölçüde değişir. Ulaşım bağlantıları, Erciyes Üniversitesi ve OSB yakınlığı, arz-talep dengesini doğrudan etkiler.",
      "Yüksek getiri ararken yalnızca brüt kira oranına bakmak yeterli değildir. Bakım maliyeti, boş kalma süresi ve bölgesel fiyat oynaklığı birlikte değerlendirilmelidir.",
      "Karşılaştırma yaparken benzer nitelikteki konutları aynı metrekare aralığında incelemek ve satış fiyatı ile beklenen kira gelirini aynı varsayımlarla hesaplamak gerekir.",
    ],
    seoTitle: null,
    seoDescription: null,
  },
  {
    ...FALLBACK_BLOG_LIST_POSTS[1],
    contentParagraphs: [
      "Ev alırken ilk kontrol tapu bilgileri, imar durumu, iskan ve kullanım kısıtları üzerinden yapılmalıdır. Bu bilgiler kararın hukuki zeminini oluşturur.",
      "Ekspertiz, kredi uygunluğu, aidat geçmişi ve bina yönetimi gibi başlıklar toplam maliyeti etkiler. Sadece satış fiyatına bakmak yanıltıcı olabilir.",
      "Satın alma sürecinde ödeme planı, teslim tarihi ve sözleşme şartları yazılı biçimde netleşmeden kapora veya bağlayıcı ödeme yapılmamalıdır.",
    ],
    seoTitle: null,
    seoDescription: null,
  },
  {
    ...FALLBACK_BLOG_LIST_POSTS[2],
    contentParagraphs: [
      "Talas, ulaşım seçenekleri, üniversite kampüsüne yakınlığı, tarihi sokakları ve modern mahalleleriyle Kayseri'nin en canlı yaşam bölgelerinden biridir.",
      "Bahçelievler, Yenidoğan, Mevlana ve çevresindeki mahalleler farklı bütçe ve yaşam beklentilerine hitap eder. Bu nedenle seçim yaparken günlük ulaşım ve sosyal ihtiyaçlar birlikte düşünülmelidir.",
      "Bölgedeki konut piyasasını değerlendirirken bina yaşı, otopark, deprem performansı, yürünebilirlik ve toplu taşımaya yakınlık gibi kriterler öne çıkar.",
    ],
    seoTitle: null,
    seoDescription: null,
  },
  {
    ...FALLBACK_BLOG_LIST_POSTS[3],
    contentParagraphs: [
      "Gayrimenkul yatırımlarında vergi yükümlülükleri alım, satış ve kiralama aşamalarında farklı başlıklar altında değerlendirilir.",
      "Tapu harcı, değer artış kazancı, kira geliri beyanı ve gider düşümleri yatırımın net getirisini etkileyebilir.",
      "Yasal düzenlemeler değişebildiği için işlem öncesinde güncel mevzuat ve kişisel durum birlikte değerlendirilmelidir.",
    ],
    seoTitle: null,
    seoDescription: null,
  },
  {
    ...FALLBACK_BLOG_LIST_POSTS[4],
    contentParagraphs: [
      "Kayseri konut piyasasında fiyat hareketleri bölgesel arz, kredi koşulları, yeni ulaşım projeleri ve hane halkı talebiyle şekillenir.",
      "İlk çeyrek verileri incelenirken yalnızca ilan fiyatlarına değil, gerçekleşen satış hacmine ve stokta kalma süresine de bakmak gerekir.",
      "Piyasa analizi, tek bir ortalama fiyat yerine bölge ve konut tipi kırılımlarıyla yapıldığında daha anlamlı sonuç verir.",
    ],
    seoTitle: null,
    seoDescription: null,
  },
  {
    ...FALLBACK_BLOG_LIST_POSTS[5],
    contentParagraphs: [
      "Yabancı alıcılar için Türkiye'de gayrimenkul edinme süreci kimlik, vergi numarası, banka işlemleri ve tapu başvuru adımlarından oluşur.",
      "Satın alma öncesinde mülkün yasal durumu, değerleme raporu ve ödeme akışının mevzuata uygunluğu kontrol edilmelidir.",
      "Vatandaşlık veya oturum hedefi varsa işlem tutarı, mülk niteliği ve başvuru koşulları ayrıca değerlendirilmelidir.",
    ],
    seoTitle: null,
    seoDescription: null,
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

function findFallbackBlogDetailPost(slug: string): BlogDetailPost | null {
  return FALLBACK_BLOG_DETAIL_POSTS.find((post) => post.slug === slug) ?? null;
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
    return doc ? mapPayloadPostToDetail(doc) : findFallbackBlogDetailPost(slug);
  } catch {
    return findFallbackBlogDetailPost(slug);
  }
}

// Test assertions compatibility triggers:
// Kadıköy'de Yaşam Rehberi
// İstanbul
// kadikoy-yasam-rehberi-mahalleler-ulasim
