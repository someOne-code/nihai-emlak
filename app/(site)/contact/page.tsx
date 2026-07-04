import type { Metadata } from "next";

import { PublicFooter } from "@/components/site/public-footer";
import { PublicHeader } from "@/components/site/public-header";

export const metadata: Metadata = {
  title: "İletişim | Umut Emlak",
  description:
    "Umut Emlak ile iletişime geçin. Kayseri'de gayrimenkul danışmanlığı için bizi arayın veya yazın.",
};

export default function ContactPage() {
  return (
    <>
      <PublicHeader />
      <main className="min-h-screen bg-property-light dark:bg-property-dark">
        {/* Hero */}
        <section className="relative overflow-hidden bg-property-hero pb-20 pt-40 dark:bg-[#0a1829]">
          <div className="container relative z-10 mx-auto max-w-screen-xl px-4 text-center">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[#2F73F2]">
              BİZE ULAŞIN
            </p>
            <h1 className="mb-5 text-4xl font-bold leading-[1.15] text-[#102D47] dark:text-white md:text-5xl lg:text-6xl">
              İletişim
            </h1>
            <p className="mx-auto max-w-2xl text-lg leading-8 text-property-gray md:text-xl">
              Sorularınız, talepleriniz veya randevu almak için aşağıdaki
              kanallardan bize ulaşabilirsiniz.
            </p>
          </div>
        </section>

        {/* Contact cards */}
        <section className="py-14 md:py-20">
          <div className="container mx-auto max-w-screen-xl px-4">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {/* Address */}
              <div className="flex flex-col items-start gap-4 rounded-lg bg-property-surface p-8 shadow-property dark:bg-[#0f2035]">
                <span className="text-3xl" aria-hidden="true">
                  📍
                </span>
                <div>
                  <h2 className="mb-1 text-sm font-semibold uppercase tracking-widest text-[#2F73F2]">
                    Adres
                  </h2>
                  <p className="text-base font-medium text-property-midnight dark:text-white">
                    Kayseri, Türkiye
                  </p>
                </div>
              </div>

              {/* Phone */}
              <div className="flex flex-col items-start gap-4 rounded-lg bg-property-surface p-8 shadow-property dark:bg-[#0f2035]">
                <span className="text-3xl" aria-hidden="true">
                  📞
                </span>
                <div>
                  <h2 className="mb-1 text-sm font-semibold uppercase tracking-widest text-[#2F73F2]">
                    Telefon
                  </h2>
                  <a
                    href="tel:+8500000000"
                    className="text-base font-medium text-property-midnight hover:text-[#2F73F2] dark:text-white dark:hover:text-[#2F73F2]"
                  >
                    +(850) 000 0000
                  </a>
                </div>
              </div>

              {/* Email */}
              <div className="flex flex-col items-start gap-4 rounded-lg bg-property-surface p-8 shadow-property dark:bg-[#0f2035]">
                <span className="text-3xl" aria-hidden="true">
                  📧
                </span>
                <div>
                  <h2 className="mb-1 text-sm font-semibold uppercase tracking-widest text-[#2F73F2]">
                    E-posta
                  </h2>
                  <a
                    href="mailto:info@umutemlak.com"
                    className="text-base font-medium text-property-midnight hover:text-[#2F73F2] dark:text-white dark:hover:text-[#2F73F2]"
                  >
                    info@umutemlak.com
                  </a>
                </div>
              </div>

              {/* Hours */}
              <div className="flex flex-col items-start gap-4 rounded-lg bg-property-surface p-8 shadow-property dark:bg-[#0f2035]">
                <span className="text-3xl" aria-hidden="true">
                  🕐
                </span>
                <div>
                  <h2 className="mb-1 text-sm font-semibold uppercase tracking-widest text-[#2F73F2]">
                    Çalışma Saatleri
                  </h2>
                  <p className="text-base font-medium text-property-midnight dark:text-white">
                    Pazartesi - Cuma
                  </p>
                  <p className="text-property-gray">09:00 - 18:00</p>
                </div>
              </div>
            </div>

            {/* CTA banner */}
            <div className="mt-12 rounded-lg bg-property-surface p-8 text-center shadow-property md:p-12 dark:bg-[#0f2035]">
              <h2 className="mb-3 text-2xl font-semibold text-property-midnight dark:text-white">
                Size nasıl yardımcı olabiliriz?
              </h2>
              <p className="text-property-gray">
                Kayseri ve çevresinde gayrimenkul almak, satmak veya kiralamak
                için uzman danışmanlarımız yanınızda.
              </p>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
