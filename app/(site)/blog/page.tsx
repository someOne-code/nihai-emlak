import Link from "next/link";

export default function BlogIndexPlaceholder() {
  return (
    <main className="bg-property-light px-4 py-32">
      <section className="mx-auto max-w-screen-md rounded-lg bg-property-surface p-8 text-center shadow-property">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#2F73F2]">BLOG</p>
        <h1 className="mb-4 text-4xl font-bold text-property-midnight dark:text-white">Blog içerikleri yakında</h1>
        <p className="mx-auto mb-8 max-w-xl text-base leading-7 text-property-gray">
          Kiralama, yatırım ve gayrimenkul rehberi içerikleri için tam blog sayfası ayrı bir fazda hazırlanacak.
        </p>
        <Link
          href="/"
          className="inline-flex rounded-lg bg-[#2F73F2] px-6 py-3 font-semibold text-white transition hover:bg-[#1d5fd8]"
        >
          Ana Sayfaya Dön
        </Link>
      </section>
    </main>
  );
}
