const services = [
  {
    title: "Uzun Dönem Kiralama",
    description:
      "Profesyonel portföy yönetimi ile güvenilir uzun dönem kiralama çözümleri. Kiracı seçimi, sözleşme yönetimi ve operasyonel destek.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
        <path d="M9 22v-4h6v4" />
        <path d="M8 6h.01" />
        <path d="M16 6h.01" />
        <path d="M12 6h.01" />
        <path d="M12 10h.01" />
        <path d="M12 14h.01" />
        <path d="M16 10h.01" />
        <path d="M16 14h.01" />
        <path d="M8 10h.01" />
        <path d="M8 14h.01" />
      </svg>
    ),
  },
  {
    title: "Yatırım Danışmanlığı",
    description:
      "Veri odaklı bölge analizleri ve getiri hesaplamaları ile gayrimenkul yatırım stratejileri oluşturuyoruz.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    ),
  },
  {
    title: "Portföy Yönetimi",
    description:
      "Mülk sahiplerine vekaletli portföy yönetimi hizmeti. Bakım, kiracı ilişkileri ve gelir optimizasyonu.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    title: "Hukuki Destek",
    description:
      "Kiralama sözleşmeleri, tapu işlemleri ve yasal süreçlerde profesyonel danışmanlık hizmeti.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
] as const;

export function HomeServices() {
  return (
    <section className="bg-property-light pb-20 pt-12 md:pb-24 md:pt-16">
      <div className="container mx-auto max-w-screen-xl px-4 md:max-w-screen-md lg:max-w-screen-xl">
        {/* Section header */}
        <div className="mb-12 text-center" data-aos="fade-up">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#2F73F2]">
            HİZMETLERİMİZ
          </p>
          <h2 className="text-4xl font-bold leading-tight text-property-midnight dark:text-white">
            Profesyonel Çözümler
          </h2>
        </div>

        {/* 2-column grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-8">
          {services.map((service, index) => (
            <div
              key={service.title}
              className="group rounded-2xl bg-property-surface p-8 shadow-[0_2px_16px_rgba(0,0,0,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,0,0,0.10)] dark:shadow-[0_2px_16px_rgba(0,0,0,0.3)]"
              data-aos="fade-up"
              data-aos-delay={index * 100}
            >
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-[#2F73F2]/10 text-[#2F73F2] transition duration-300 group-hover:bg-[#2F73F2] group-hover:text-white">
                {service.icon}
              </div>
              <h3 className="mb-3 text-xl font-bold text-property-midnight dark:text-white">
                {service.title}
              </h3>
              <p className="text-base leading-7 text-property-gray">
                {service.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
