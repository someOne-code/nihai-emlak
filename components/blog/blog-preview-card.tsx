import Link from "next/link";
import Image from "next/image";

import type { BlogPreviewPost } from "@/types/blog";

function formatPublishedDate(value: string | null): string {
  if (!value) return "Güncel";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Güncel";

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function BlogPreviewCard({ post }: { post: BlogPreviewPost }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block overflow-hidden rounded-lg bg-property-surface shadow-[0_2px_16px_rgba(0,0,0,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_10px_32px_rgba(0,0,0,0.14)] dark:shadow-[0_2px_16px_rgba(0,0,0,0.35)]"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <Image
          src={post.coverImageUrl}
          alt={post.coverImageAlt}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
      </div>
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="rounded-full bg-[#2F73F2]/10 px-3 py-1 text-sm font-semibold text-[#2F73F2]">
            {post.categoryLabel}
          </span>
          <time className="text-sm text-property-gray">{formatPublishedDate(post.publishedAt)}</time>
        </div>
        <h3 className="mb-3 text-xl font-bold leading-snug text-property-midnight transition group-hover:text-[#2F73F2] dark:text-white">
          {post.title}
        </h3>
        <p className="mb-5 text-base leading-7 text-property-gray">{post.excerpt}</p>
        <span className="text-base font-semibold text-[#2F73F2]">Devamını Oku</span>
      </div>
    </Link>
  );
}
