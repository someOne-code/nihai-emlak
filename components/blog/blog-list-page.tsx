"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3 } from "lucide-react";
import { useMemo, useState } from "react";

import type { BlogListPost } from "@/types/blog";

const BLOG_CATEGORIES = [
  "Tümü",
  "Yatırım",
  "Bölge Rehberi",
  "Alıcı Rehberi",
  "Hukuk & Vergi",
  "Piyasa Analizi",
] as const;

type BlogCategory = (typeof BLOG_CATEGORIES)[number];

function formatPublishedDate(value: string | null): string {
  if (!value) return "Güncel";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Güncel";

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function BlogListPage({ posts }: { posts: BlogListPost[] }) {
  const [activeCategory, setActiveCategory] = useState<BlogCategory>("Tümü");

  const filteredPosts = useMemo(
    () =>
      activeCategory === "Tümü"
        ? posts
        : posts.filter((post) => post.categoryLabel === activeCategory),
    [activeCategory, posts],
  );

  const featuredPost = filteredPosts[0] ?? posts[0] ?? null;
  const gridPosts = featuredPost
    ? filteredPosts.filter((post) => post.slug !== featuredPost.slug)
    : filteredPosts;

  return (
    <main>
      <section className="bg-[#102D47] pb-24 pt-40 text-white dark:bg-[#0e1624] md:pb-28 md:pt-44">
        <div className="container mx-auto max-w-screen-xl px-4 text-center md:max-w-screen-md lg:max-w-screen-xl">
          <h1 className="text-4xl font-bold leading-tight md:text-5xl" data-aos="fade-up">
            Blog &amp; İçerikler
          </h1>
          <p
            className="mx-auto mt-5 max-w-3xl text-base leading-7 text-white/70 md:text-lg"
            data-aos="fade-up"
            data-aos-delay="100"
          >
            Gayrimenkul yatırımı, bölge rehberleri, piyasa analizleri ve uzman görüşleri.
          </p>
          <div className="mx-auto mt-8 h-1 w-16 rounded-full bg-[#2F73F2]" data-aos="fade-up" data-aos-delay="150" />
        </div>
      </section>

      <section className="bg-property-light py-16 md:py-24">
        <div className="container mx-auto max-w-screen-2xl px-4 md:max-w-screen-md lg:max-w-screen-xl 2xl:max-w-screen-2xl">
          {featuredPost ? <FeaturedBlogCard post={featuredPost} /> : null}

          <div
            className="mt-12 flex flex-wrap items-center gap-3"
            aria-label="Blog kategorileri"
            data-aos="fade-up"
          >
            {BLOG_CATEGORIES.map((category) => {
              const isActive = activeCategory === category;

              return (
                <button
                  key={category}
                  type="button"
                  aria-pressed={activeCategory === category}
                  onClick={() => setActiveCategory(category)}
                  className={`rounded-full px-5 py-3 text-sm font-semibold transition duration-300 focus:outline-none focus:ring-2 focus:ring-[#2F73F2] focus:ring-offset-2 dark:focus:ring-offset-[#0e1624] ${
                    isActive
                      ? "bg-[#2F73F2] text-white shadow-[0_10px_24px_rgba(47,115,242,0.24)]"
                      : "bg-property-surface text-property-gray shadow-[0_4px_16px_rgba(16,45,71,0.06)] hover:-translate-y-0.5 hover:text-[#2F73F2]"
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>

          {gridPosts.length > 0 ? (
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-8 xl:grid-cols-3 2xl:grid-cols-4">
              {gridPosts.map((post, index) => (
                <div key={post.slug} data-aos="fade-up" data-aos-delay={(index % 4) * 80}>
                  <BlogCard post={post} />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-lg bg-property-surface p-8 text-center shadow-property" data-aos="fade-up">
              <p className="text-base leading-7 text-property-gray">
                Bu kategoride yayın hazırlanıyor. Tüm içeriklere dönmek için filtreyi sıfırlayın.
              </p>
            </div>
          )}

          <div className="mt-12 flex justify-center" data-aos="fade-up">
            <button
              type="button"
              disabled
              className="rounded-lg border border-[#2F73F2]/30 bg-property-surface px-6 py-3 text-base font-semibold text-[#2F73F2] opacity-80 shadow-[0_8px_24px_rgba(16,45,71,0.08)]"
            >
              Daha Fazla Yükle
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function FeaturedBlogCard({ post }: { post: BlogListPost }) {
  return (
    <article data-aos="fade-up">
      <Link
        href={`/blog/${post.slug}`}
        className="group grid overflow-hidden rounded-lg bg-property-surface shadow-[0_14px_44px_rgba(16,45,71,0.10)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(16,45,71,0.16)] lg:grid-cols-2"
      >
        <BlogImage
          post={post}
          priority
          sizes="(min-width: 1280px) 640px, (min-width: 1024px) 50vw, 100vw"
          className="min-h-[320px] lg:min-h-[420px]"
        />
        <div className="flex flex-col justify-center p-7 md:p-10 lg:p-12">
          <BlogMeta post={post} />
          <h2 className="mt-4 text-3xl font-bold leading-tight text-property-midnight transition group-hover:text-[#2F73F2] dark:text-white md:text-4xl">
            {post.title}
          </h2>
          <p className="mt-4 text-base leading-7 text-property-gray md:text-lg">{post.excerpt}</p>
          <ReadMore className="mt-7" />
        </div>
      </Link>
    </article>
  );
}

function BlogCard({ post }: { post: BlogListPost }) {
  return (
    <article className="h-full">
      <Link
        href={`/blog/${post.slug}`}
        className="group flex h-full flex-col overflow-hidden rounded-lg bg-property-surface shadow-[0_8px_30px_rgba(16,45,71,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_46px_rgba(16,45,71,0.14)]"
      >
        <BlogImage
          post={post}
          sizes="(min-width: 1536px) 25vw, (min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
          className="aspect-[16/10]"
        />
        <div className="flex flex-1 flex-col p-6">
          <BlogMeta post={post} />
          <h2 className="mt-4 text-2xl font-bold leading-snug text-property-midnight transition group-hover:text-[#2F73F2] dark:text-white">
            {post.title}
          </h2>
          <p className="mt-4 line-clamp-4 text-base leading-7 text-property-gray">{post.excerpt}</p>
          <ReadMore className="mt-auto pt-6" />
        </div>
      </Link>
    </article>
  );
}

function BlogImage({
  post,
  sizes,
  className = "",
  priority = false,
}: {
  post: BlogListPost;
  sizes: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden bg-[#dbe7f0] ${className}`}>
      <Image
        src={post.coverImageUrl}
        alt={post.coverImageAlt}
        fill
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : "lazy"}
        className="object-cover transition duration-500 group-hover:scale-105"
      />
      <span className="absolute left-5 top-5 rounded-md bg-[#2F73F2] px-3 py-2 text-sm font-bold text-white shadow-[0_8px_20px_rgba(47,115,242,0.22)]">
        {post.categoryLabel}
      </span>
    </div>
  );
}

function BlogMeta({ post }: { post: BlogListPost }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium text-property-gray">
      <time dateTime={post.publishedAt ?? undefined} className="inline-flex items-center gap-2">
        <CalendarDays aria-hidden="true" className="size-4" />
        {formatPublishedDate(post.publishedAt)}
      </time>
      <span className="inline-flex items-center gap-2">
        <Clock3 aria-hidden="true" className="size-4" />
        {post.readTime}
      </span>
    </div>
  );
}

function ReadMore({ className = "" }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-2 text-sm font-semibold text-[#2F73F2] ${className}`}>
      <span>Devamını oku</span>
      <ArrowRight aria-hidden="true" className="size-4 transition group-hover:translate-x-1" />
    </div>
  );
}
