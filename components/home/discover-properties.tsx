import Link from "next/link";

const propertyCategories = [
  {
    label: "Daire",
    countLabel: "Kiralık ve satılık daireler",
    href: "/listings",
    image: "/property-nextjs-pro/images/property_option/apartment.svg",
  },
  {
    label: "Villa",
    countLabel: "Villa ilanları",
    href: "/listings",
    image: "/property-nextjs-pro/images/property_option/villa.svg",
  },
  {
    label: "Ofis",
    countLabel: "Ofis ve ticari alanlar",
    href: "/listings",
    image: "/property-nextjs-pro/images/property_option/office.svg",
  },
  {
    label: "Müstakil Ev",
    countLabel: "Müstakil konutlar",
    href: "/listings",
    image: "/property-nextjs-pro/images/property_option/house.svg",
  },
  {
    label: "Lüks Konut",
    countLabel: "Prestijli yaşam alanları",
    href: "/listings",
    image: "/property-nextjs-pro/images/property_option/apartment.svg",
  },
  {
    label: "Ticari",
    countLabel: "İş yeri ve mağazalar",
    href: "/listings",
    image: "/property-nextjs-pro/images/property_option/shop.svg",
  },
] as const;

export function DiscoverProperties() {
  return (
    <section className="bg-property-light py-16 md:py-20">
      <div className="container mx-auto max-w-screen-xl px-4 md:max-w-screen-md lg:max-w-screen-xl">
        <h2
          className="mb-4 text-4xl font-bold leading-tight text-property-midnight dark:text-white"
          data-aos="fade-left"
        >
          Gayrimenkul Türlerini Keşfedin
        </h2>
        <p className="mb-12 max-w-2xl text-base leading-7 text-property-gray" data-aos="fade-left" data-aos-delay="100">
          İhtiyacınıza uygun kiralık ve satılık ilanları kolayca keşfedin.
        </p>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 lg:gap-4">
          {propertyCategories.map((category, index) => (
            <Link
              key={category.label}
              href={category.href}
              className="group block"
              data-aos="fade-up"
              data-aos-delay={index * 100}
            >
              <span className="mb-6 flex h-[85px] w-[85px] items-center justify-center rounded-lg border-2 border-property bg-property-surface p-4 transition duration-500 group-hover:-translate-y-1 dark:border-[#224767]">
                <img
                  src={category.image}
                  alt={`${category.label} kategorisi`}
                  width={52}
                  height={52}
                />
              </span>
              <span className="mb-1 block text-[22px] font-semibold leading-[1.2] text-property-midnight/80 transition group-hover:text-property-midnight dark:text-white/70 dark:group-hover:text-white">
                {category.label}
              </span>
              <span className="block text-base text-property-gray">{category.countLabel}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
