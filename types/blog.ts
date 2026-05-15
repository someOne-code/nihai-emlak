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
