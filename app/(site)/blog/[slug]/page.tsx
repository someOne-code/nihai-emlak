import Link from "next/link";

export default async function BlogPostPlaceholder({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <main className="bg-property-light px-4 py-32">
      <section className="mx-auto max-w-screen-md rounded-lg bg-property-surface p-8 shadow-property">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#2F73F2]">BLOG</p>
        <h1 className="mb-4 text-4xl font-bold text-property-midnight dark:text-white">Blog içeriği yakında</h1>
        <p className="mb-2 text-base leading-7 text-property-gray">
          Seçilen yazı: <span className="font-semibold text-property-midnight dark:text-white">{slug}</span>
        </p>
        <p className="mb-8 text-base leading-7 text-property-gray">
          Detay sayfası ayrı bir fazda Payload CMS içerikleriyle tamamlanacak.
        </p>
        <Link
          href="/blog"
          className="inline-flex rounded-lg bg-[#2F73F2] px-6 py-3 font-semibold text-white transition hover:bg-[#1d5fd8]"
        >
          Bloga Dön
        </Link>
      </section>
    </main>
  );
}
