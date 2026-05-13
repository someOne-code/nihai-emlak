import Image from "next/image";
import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="relative z-10 bg-[#102D47] dark:bg-[#0e1624]">
      <div className="container mx-auto px-0 pb-5 pt-10 md:max-w-screen-md lg:max-w-screen-xl sm:px-6 lg:px-8">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 flex items-center px-4 md:col-span-4 sm:px-0">
            <Link href="/" className="mb-6 inline-block max-w-40">
              <Image
                src="/property-nextjs-pro/images/logo/logo-white.svg"
                alt="logo"
                width={156}
                height={38}
                unoptimized
              />
            </Link>
          </div>
          <div className="col-span-12 grid grid-cols-12 gap-4 px-4 md:col-span-8 sm:px-0">
            <div className="col-span-12 w-full lg:col-span-6">
              <h4 className="mb-4 text-lg text-white dark:text-white">Adres</h4>
              <p className="mb-6 text-base text-[#668199]">
                Nihai Emlak, Kayseri merkezli gayrimenkul yönetimi ve danışmanlığı
              </p>
              <div className="flex items-center gap-2">
                <SocialLink label="Facebook">
                  <path d="M16.294 8.86875H14.369H13.6815V8.18125V6.05V5.3625H14.369H15.8128C16.1909 5.3625 16.5003 5.0875 16.5003 4.675V1.03125C16.5003 0.653125 16.2253 0.34375 15.8128 0.34375H13.3034C10.5878 0.34375 8.69714 2.26875 8.69714 5.12187V8.1125V8.8H8.00964H5.67214C5.19089 8.8 4.74402 9.17812 4.74402 9.72812V12.2031C4.74402 12.6844 5.12214 13.1313 5.67214 13.1313H7.94089H8.62839V13.8188V20.7281C8.62839 21.2094 9.00652 21.6562 9.55652 21.6562H12.7878C12.994 21.6562 13.1659 21.5531 13.3034 21.4156C13.4409 21.2781 13.544 21.0375 13.544 20.8312V13.8531V13.1656H14.2659H15.8128C16.2596 13.1656 16.6034 12.8906 16.6721 12.4781V12.4438V12.4094L17.1534 10.0375C17.1878 9.79688 17.1534 9.52187 16.9471 9.24687C16.8784 9.075 16.569 8.90312 16.294 8.86875Z" />
                </SocialLink>
                <SocialLink label="X">
                  <path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75Zm-.86 13.028h1.36L4.323 2.145H2.865z" />
                </SocialLink>
                <SocialLink label="Instagram">
                  <path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.9 3.9 0 0 0-1.417.923A3.9 3.9 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.852.174 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.9 3.9 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.9 3.9 0 0 0-.923-1.417A3.9 3.9 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0zm-.717 1.442h.718c2.136 0 2.389.007 3.232.046.78.035 1.204.166 1.486.275.373.145.64.319.92.599s.453.546.598.92c.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.5 2.5 0 0 1-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.843.038-1.096.047-3.232.047s-2.39-.009-3.233-.047c-.78-.036-1.203-.166-1.485-.276a2.5 2.5 0 0 1-.92-.598 2.5 2.5 0 0 1-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.233s.008-2.388.046-3.231c.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92s.546-.453.92-.598c.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045zm4.988 1.328a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92m-4.27 1.122a4.109 4.109 0 1 0 0 8.217 4.109 4.109 0 0 0 0-8.217m0 1.441a2.667 2.667 0 1 1 0 5.334 2.667 2.667 0 0 1 0-5.334" />
                </SocialLink>
              </div>
            </div>
            <div className="col-span-12 w-full lg:col-span-6">
              <h4 className="mb-4 text-lg text-white dark:text-white">Hızlı Bağlantılar</h4>
              <ul>
                <li>
                  <Link href="/contact" className="mb-3 inline-block text-base text-[#668199] hover:text-white">
                    İletişim
                  </Link>
                </li>
                <li>
                  <Link href="/listings" className="mb-3 inline-block text-base text-[#668199] hover:text-white">
                    İlanlar
                  </Link>
                </li>
                <li>
                  <Link href="/blog" className="mb-3 inline-block text-base text-[#668199] hover:text-white">
                    Blog
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-[#224767] py-8">
        <div className="container mx-auto flex max-w-screen-xl flex-col items-center px-4 lg:flex-row sm:px-6 lg:px-8">
          <div className="mb-4 max-w-full text-center lg:mb-0 lg:max-w-45 lg:text-left">
            <div className="flex flex-wrap gap-4 text-base text-black/50 lg:flex-nowrap lg:gap-11 sm:text-lg md:text-xl">
              <p className="text-white">
                Telefon:
                <Link href="#" className="text-[#668199] hover:text-white"> +(690) 2560 0020</Link>
              </p>
              <p className="text-white">
                E-posta:
                <Link href="#" className="text-[#668199] hover:text-white"> real@property.com</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

function SocialLink({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <a
      aria-label={label}
      href="#"
      className="rounded-md bg-white/50 p-1 text-[#102D47] hover:bg-[#2F73F2]"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 20 20"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        className="fill-current"
      >
        {children}
      </svg>
    </a>
  );
}
