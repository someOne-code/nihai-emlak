import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock3 } from "lucide-react";

import { PublicFooter } from "@/components/site/public-footer";
import { PublicHeader } from "@/components/site/public-header";
import { getPublishedBlogDetailPost } from "@/lib/api/blog";
import type { BlogDetailPost } from "@/types/blog";

type BlogDetailPageProps = {
  params: Promise<{ slug: string }>;
};

function decodeSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

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

export async function generateMetadata({
  params,
}: BlogDetailPageProps): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = decodeSlug(rawSlug);
  const post = await getPublishedBlogDetailPost(slug);

  if (!post) notFound();

  const title = post.seoTitle ?? post.title;
  const description = post.seoDescription ?? post.excerpt;
  const canonical = `/blog/${post.slug}`;

  return {
    title: `${title} | Nihai Emlak`,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      type: "article",
      url: canonical,
      images: [
        {
          url: post.coverImageUrl,
          alt: post.coverImageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [post.coverImageUrl],
    },
  };
}

export default async function BlogDetailPage({ params }: BlogDetailPageProps) {
  const { slug: rawSlug } = await params;
  const slug = decodeSlug(rawSlug);
  const post = await getPublishedBlogDetailPost(slug);

  if (!post) notFound();

  return (
    <>
      <PublicHeader />
      <main>
        <BlogDetailArticle post={post} />
      </main>
      <PublicFooter />
    </>
  );
}

function BlogDetailArticle({ post }: { post: BlogDetailPost }) {
  return (
    <article>
      <section className="relative overflow-x-hidden bg-property-hero bg-cover pb-16 pt-32 md:pb-20 md:pt-40">
        <div className="container mx-auto max-w-screen-xl px-4 md:max-w-screen-md lg:max-w-screen-xl">
          <Link
            href="/blog"
            className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-[#2F73F2] transition hover:text-[#1d5fd8]"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Bloga Dön
          </Link>
          <div className="max-w-4xl">
            <span className="inline-flex rounded-md bg-[#2F73F2] px-3 py-2 text-sm font-bold text-white shadow-[0_8px_20px_rgba(47,115,242,0.22)]">
              {post.categoryLabel}
            </span>
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium text-property-gray">
              <time dateTime={post.publishedAt ?? undefined} className="inline-flex items-center gap-2">
                <CalendarDays aria-hidden="true" className="size-4" />
                {formatPublishedDate(post.publishedAt)}
              </time>
              <span className="inline-flex items-center gap-2">
                <Clock3 aria-hidden="true" className="size-4" />
                {post.readTime} okuma
              </span>
            </div>
            <h1 className="mt-5 text-4xl font-bold leading-tight text-[#102D47] dark:text-white md:text-5xl">
              {post.title}
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-[#668199]">
              {post.excerpt}
            </p>
          </div>
        </div>
      </section>

      <section className="bg-property-light pb-16 pt-10 md:pb-24 md:pt-14">
        <div className="container mx-auto max-w-screen-xl px-4 md:max-w-screen-md lg:max-w-screen-xl">
          <div className="overflow-hidden rounded-lg bg-property-surface shadow-[0_14px_44px_rgba(16,45,71,0.10)]">
            <div className="relative aspect-[16/9] overflow-hidden bg-[#dbe7f0]">
              <Image
                src={post.coverImageUrl}
                alt={post.coverImageAlt}
                fill
                priority
                sizes="(min-width: 1280px) 1200px, 100vw"
                className="object-cover"
              />
            </div>
            <div className="mx-auto max-w-3xl px-6 py-10 md:px-10 md:py-14">
              <div className="space-y-6">
                {post.contentParagraphs.map((paragraph) => (
                  <p key={paragraph} className="text-lg leading-8 text-property-gray">
                    {paragraph}
                  </p>
                ))}
              </div>
              <div className="mt-12 border-t border-[#dbe7f0] pt-8">
                <Link
                  href="/blog"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#2F73F2] px-6 py-3 text-base font-semibold text-white transition hover:bg-[#1d5fd8]"
                >
                  <ArrowLeft aria-hidden="true" className="size-4" />
                  Bloga Dön
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </article>
  );
}
