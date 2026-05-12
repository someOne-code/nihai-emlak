import Link from "next/link";

const companyStats = [
  {
    value: "Kontrollü İlanlar",
    description: "Her ilan yayın öncesi incelenir",
  },
  {
    value: "Uzman Kadro",
    description: "Alanında deneyimli danışmanlar",
  },
  {
    value: "7/24 Destek",
    description: "Online talep ve iletişim",
  },
  {
    value: "Şeffaf Süreç",
    description: "Baştan sona açık ve güvenilir",
  },
] as const;

export function CompanyInfo() {
  return (
    <section className="bg-property-light pb-20 pt-12 md:pb-24 md:pt-16">
      <div className="container mx-auto max-w-screen-xl px-4 md:max-w-screen-md lg:max-w-screen-xl">
        {/* Heading */}
        <div className="mb-10 max-w-2xl" data-aos="fade-right">
          <h2 className="mb-4 text-4xl font-bold leading-tight text-property-midnight dark:text-white">
            Gayrimenkul Sürecinizi Tek Yerden Yönetin
          </h2>
          <p className="text-base leading-7 text-property-gray">
            Kiralık ve satılık ilanları inceleyin, danışmanlarla iletişime geçin
            ve kiralama sürecindeki ödeme adımlarını güvenli şekilde yönetin.
          </p>
        </div>

        {/* Stats bar – inspired by template company-info */}
        <div className="company-info-stats-bg rounded-lg bg-[#2F73F2]">
          <div className="grid grid-cols-2 md:grid-cols-4">
            {companyStats.map((stat, index) => (
              <div
                key={stat.value}
                className={`flex flex-col items-center justify-center px-4 py-10 lg:flex-row lg:gap-4 ${
                  index < companyStats.length - 1
                    ? "border-b border-white/20 md:border-b-0 md:border-r"
                    : ""
                }`}
                data-aos="fade-up"
                data-aos-delay={index * 100}
              >
                <p className="text-xl font-bold leading-snug text-white sm:text-2xl lg:text-[28px]">
                  {stat.value}
                </p>
                <p className="mt-1 text-center text-sm text-white/80 lg:mt-0 lg:text-base">
                  {stat.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-10 flex flex-col gap-4 sm:flex-row" data-aos="fade-up" data-aos-delay="200">
          <Link
            href="/listings"
            className="inline-flex items-center justify-center rounded-lg bg-[#2F73F2] px-8 py-3.5 text-lg font-semibold text-white transition hover:bg-[#1d5fd8]"
          >
            İlanları İncele
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center rounded-lg border-2 border-[#2F73F2] px-8 py-3.5 text-lg font-semibold text-[#2F73F2] transition hover:bg-[#2F73F2] hover:text-white dark:text-white"
          >
            İletişime Geç
          </Link>
        </div>
      </div>
    </section>
  );
}
