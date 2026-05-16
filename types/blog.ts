export type BlogPreviewPost = {
  title: string;
  slug: string;
  excerpt: string;
  categoryLabel: string;
  publishedAt: string | null;
  coverImageUrl: string;
  coverImageAlt: string;
};

export type BlogListPost = BlogPreviewPost & {
  readTime: string;
};

export type BlogDetailPost = BlogListPost & {
  contentParagraphs: string[];
  seoTitle: string | null;
  seoDescription: string | null;
};
