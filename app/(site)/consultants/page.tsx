import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { ConsultantCard } from "@/components/consultants/consultant-card";
import { PublicFooter } from "@/components/site/public-footer";
import { PublicHeader } from "@/components/site/public-header";
import { listPublishedConsultants } from "@/lib/api/consultants";

const TRUST_ITEMS = [
  "Bölge bilgisi",
  "Şeffaf iletişim",
  "Satılık ve kiralık süreç desteği",
] as const;

export const metadata: Metadata = {
  title: "Danışmanlarımız | Nihai Emlak",
  description: "Gayrimenkul danışmanlarımızı tanıyın ve yayındaki ekip profillerini inceleyin.",
};

export default async function ConsultantsPage() {
  await connection();

  const consultants = await listPublishedConsultants();

  return (
    <>
      <PublicHeader />
      <main className="min-h-screen bg-property-light dark:bg-[#0e1624]">
        <section className="relative overflow-hidden bg-property-hero pb-16 pt-36 md:pb-20 md:pt-40">
          <div className="container relative z-10 mx-auto max-w-screen-xl px-4">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-4xl font-bold leading-[1.12] text-[#102D47] dark:text-white md:text-5xl lg:text-6xl">
                Danışmanlarımız
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-property-gray md:text-xl">
                Gayrimenkul yolculuğunuzda size eşlik edecek danışmanlarımızı tanıyın; yayındaki profillerde yalnızca doğrulanmış ekip bilgilerini ve mevcut iletişim kanallarını gösteriyoruz.
              </p>
            </div>

            <div className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-3">
              {TRUST_ITEMS.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/80 bg-white/70 px-5 py-4 text-center text-sm font-semibold text-[#102D47] shadow-[0_14px_34px_rgba(16,45,71,0.08)] backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-white"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-14 md:py-20">
          <div className="container mx-auto max-w-screen-xl">
            {consultants.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {consultants.map((consultant) => (
                  <ConsultantCard key={consultant.id} consultant={consultant} />
                ))}
              </div>
            ) : (
              <div className="mx-auto max-w-screen-md rounded-2xl border border-[#DDEAF5] bg-property-surface p-8 text-center shadow-[0_18px_50px_rgba(16,45,71,0.10)] dark:border-white/10 md:p-12">
                <h2 className="text-2xl font-semibold text-property-midnight dark:text-white">
                  Danışman bilgileri yakında eklenecek.
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-property-gray">
                  Yayına alınmış danışman profilleri hazır olduğunda bu sayfada görünecek. Bu sırada ilanları inceleyerek ihtiyaçlarınıza uygun seçenekleri keşfedebilirsiniz.
                </p>
                <Link
                  href="/listings"
                  className="mt-7 inline-flex items-center justify-center rounded-xl bg-[#2F73F2] px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(47,115,242,0.22)] transition hover:-translate-y-0.5 hover:bg-blue-700"
                >
                  İlanları incele
                </Link>
              </div>
            )}
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
