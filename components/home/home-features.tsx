import Image from "next/image";

const features = [
  {
    title: "Güvenilir İlanlar",
    description: "Yayınlanan ilanlar kontrol edilir ve güncel bilgilerle sunulur.",
    image: "/property-nextjs-pro/images/features/rating.svg",
  },
  {
    title: "Kiralama Sürecinde Destek",
    description: "İlk ay kira ödemesi, ek hizmetler ve taşınma süreci tek akışta yönetilebilir.",
    image: "/property-nextjs-pro/images/features/Give-Women's-Rights.svg",
  },
  {
    title: "Danışmanla Hızlı İletişim",
    description: "İlan bazlı mesajlaşma ile ilgili danışmana kolayca ulaşabilirsiniz.",
    image: "/property-nextjs-pro/images/features/live-chat.svg",
  },
] as const;

export function HomeFeatures() {
  return (
    <section className="bg-property-light pb-20 pt-8 md:pb-24 md:pt-12">
      <div className="container mx-auto max-w-screen-xl px-4 md:max-w-screen-md lg:max-w-screen-xl">
        <div className="flex flex-col items-center justify-between gap-12 lg:flex-row lg:gap-0">
          <div className="w-full flex-1">
            <div className="relative" data-aos="fade-right">
              <Image
                src="/property-nextjs-pro/images/features/features_iimage.jpg"
                alt="Modern yaşam alanı"
                width={640}
                height={615}
                className="h-auto w-full"
              />

              <div
                className="absolute bottom-0 left-4 right-4 mx-auto max-w-sm rounded-t-lg bg-property-surface p-4 shadow-lg sm:left-auto sm:right-6"
                data-aos="fade-up"
                data-aos-delay="100"
              >
                <div className="flex items-center gap-4">
                  <Image
                    src="/property-nextjs-pro/images/properties/prop-4.jpg"
                    alt="Öne çıkan konut"
                    width={92}
                    height={68}
                    className="h-[68px] w-[92px] rounded-md object-cover"
                  />
                  <div>
                    <p className="text-lg font-bold text-property-midnight dark:text-white">Seçili portföy</p>
                    <p className="text-sm leading-6 text-property-gray">Kontrollü ilanlar ve hızlı danışman erişimi</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full flex-1">
            <div className="flex h-full flex-col justify-center lg:pl-20">
              <h2
                className="mb-4 text-4xl font-bold leading-tight text-property-midnight dark:text-white"
                data-aos="fade-left"
              >
                Neden Bizi Seçmelisiniz?
              </h2>
              <p className="mb-8 text-base leading-7 text-property-gray" data-aos="fade-left" data-aos-delay="100">
                Kiralama ve satın alma süreçlerinde güvenli, hızlı ve şeffaf bir deneyim sunuyoruz.
              </p>

              <div className="space-y-8 md:space-y-6">
                {features.map((feature) => (
                  <div
                    key={feature.title}
                    className="flex items-center gap-8"
                    data-aos="fade-left"
                    data-aos-delay="100"
                  >
                    <div className="flex h-[110px] w-[110px] shrink-0 items-center justify-center rounded-full bg-[#2F73F2]/20 p-4">
                      <Image src={feature.image} alt="" width={78} height={78} unoptimized />
                    </div>
                    <div>
                      <h3 className="mb-2 text-2xl font-semibold text-property-midnight dark:text-white">
                        {feature.title}
                      </h3>
                      <p className="text-base leading-7 text-property-gray">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
