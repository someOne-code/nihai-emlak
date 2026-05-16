import type { Metadata } from "next";

import { ConsultantCard } from "@/components/consultants/consultant-card";
import { PublicFooter } from "@/components/site/public-footer";
import { PublicHeader } from "@/components/site/public-header";
import { listPublishedConsultants } from "@/lib/api/consultants";

export const metadata: Metadata = {
  title: "Danışmanlarımız | Nihai Emlak",
  description: "Gayrimenkul danışmanlarımızı tanıyın ve yayındaki ekip profillerini inceleyin.",
};

export default async function ConsultantsPage() {
  const consultants = await listPublishedConsultants();

  return (
    <>
      <PublicHeader />
      <main className="min-h-screen bg-property-light dark:bg-property-dark">
        <section className="relative overflow-hidden bg-property-hero pb-20 pt-40 dark:bg-[#0a1829]">
          <div className="container relative z-10 mx-auto max-w-screen-xl px-4 text-center">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[#2F73F2]">
              EKİBİMİZ
            </p>
            <h1 className="mb-5 text-4xl font-bold leading-[1.15] text-[#102D47] dark:text-white md:text-5xl lg:text-6xl">
              Danışmanlarımız
            </h1>
            <p className="mx-auto max-w-2xl text-lg leading-8 text-property-gray md:text-xl">
              Yayındaki danışman profillerini, uzmanlık notlarını ve varsa doğrudan iletişim kanallarını buradan inceleyin.
            </p>
          </div>
        </section>

        <section className="py-14 md:py-20">
          <div className="container mx-auto max-w-screen-xl px-4">
            {consultants.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {consultants.map((consultant) => (
                  <ConsultantCard key={consultant.id} consultant={consultant} />
                ))}
              </div>
            ) : (
              <div className="mx-auto max-w-screen-md rounded-lg bg-property-surface p-8 text-center shadow-property md:p-12">
                <h2 className="mb-3 text-2xl font-semibold text-property-midnight dark:text-white">
                  Danışman bilgileri yakında eklenecek.
                </h2>
                <p className="text-property-gray">
                  Yayına alınmış danışman profilleri hazır olduğunda bu sayfada görünecek.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
