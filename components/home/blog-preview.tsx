import { BlogPreviewCard } from "@/components/blog/blog-preview-card";
import type { BlogPreviewPost } from "@/types/blog";

export function BlogPreview({ posts }: { posts: BlogPreviewPost[] }) {
  return (
    <section className="bg-property-light pb-20 pt-12 md:pb-24 md:pt-16">
      <div className="container mx-auto max-w-screen-xl px-4 md:max-w-screen-md lg:max-w-screen-xl">
        <div className="mx-auto mb-12 max-w-2xl text-center" data-aos="fade-up">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#2F73F2]">
            BLOG
          </p>
          <h2 className="mb-4 text-4xl font-bold leading-tight text-property-midnight dark:text-white">
            Güncel İçerikler
          </h2>
          <p className="text-base leading-7 text-property-gray">
            Kiralama, yatırım ve gayrimenkul süreçleri hakkında güncel içerikleri keşfedin.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {posts.slice(0, 3).map((post, index) => (
            <div key={post.slug} data-aos="fade-up" data-aos-delay={index * 100}>
              <BlogPreviewCard post={post} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
