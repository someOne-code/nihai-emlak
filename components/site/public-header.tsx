"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

type HeaderItem = {
  href: string;
  label: string;
  submenu?: Array<{ href: string; label: string }>;
};

const headerData: HeaderItem[] = [
  { href: "/", label: "Ana Sayfa" },
  { href: "/listings", label: "İlanlar" },
  { href: "/blog", label: "Blog" },
  { href: "/consultants", label: "Danışmanlar" },
  { href: "/contact", label: "İletişim" },
];

export function PublicHeader() {
  const pathUrl = usePathname();
  const { theme, setTheme } = useTheme();
  const [navbarOpen, setNavbarOpen] = useState(false);
  const [sticky, setSticky] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleScroll() {
      setSticky(window.scrollY >= 80);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    if (!navbarOpen) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (
        mobileMenuRef.current
        && !mobileMenuRef.current.contains(event.target as Node)
      ) {
        setNavbarOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [navbarOpen]);

  return (
    <>
      <header
        className={`fixed top-0 z-50 h-24 w-full bg-transparent py-1 transition-all ${
          sticky ? "bg-white shadow-lg dark:bg-[#0e1624] dark:shadow-[rgba(145,158,171,0.2)_0px_0px_2px_0px,rgba(145,158,171,0.12)_0px_12px_24px_-4px]" : "shadow-none"
        }`}
      >
        <div className="container mx-auto flex items-center justify-between px-4 py-6 md:max-w-screen-md lg:max-w-screen-xl">
          <Logo />
          <nav className="hidden flex-grow items-center justify-center gap-6 lg:flex">
            {headerData.map((item) => (
              <HeaderLink key={item.href} item={item} />
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <button
              aria-label="Tema değiştir"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="flex size-8 items-center justify-center text-body-color duration-300 dark:text-white"
              type="button"
            >
              <svg
                viewBox="0 0 16 16"
                className={`hidden size-6 dark:block ${!sticky && pathUrl === "/" ? "text-white" : ""}`}
              >
                <path d="M4.50663 3.2267L3.30663 2.03337L2.36663 2.97337L3.55996 4.1667L4.50663 3.2267ZM2.66663 7.00003H0.666626V8.33337H2.66663V7.00003ZM8.66663 0.366699H7.33329V2.33337H8.66663V0.366699ZM13.6333 2.97337L12.6933 2.03337L11.5 3.2267L12.44 4.1667L13.6333 2.97337ZM11.4933 12.1067L12.6866 13.3067L13.6266 12.3667L12.4266 11.1734L11.4933 12.1067ZM13.3333 7.00003V8.33337H15.3333V7.00003H13.3333ZM7.99996 3.6667C5.79329 3.6667 3.99996 5.46003 3.99996 7.6667C3.99996 9.87337 5.79329 11.6667 7.99996 11.6667C10.2066 11.6667 12 9.87337 12 7.6667C12 5.46003 10.2066 3.6667 7.99996 3.6667ZM7.33329 14.9667H8.66663V13H7.33329V14.9667ZM2.36663 12.36L3.30663 13.3L4.49996 12.1L3.55996 11.16L2.36663 12.36Z" fill="#FFFFFF" />
              </svg>
              <svg
                viewBox="0 0 23 23"
                className={`size-8 text-[#102D47] dark:hidden ${!sticky && pathUrl === "/" ? "text-white" : ""}`}
              >
                <path d="M16.6111 15.855C17.591 15.1394 18.3151 14.1979 18.7723 13.1623C16.4824 13.4065 14.1342 12.4631 12.6795 10.4711C11.2248 8.47905 11.0409 5.95516 11.9705 3.84818C10.8449 3.9685 9.72768 4.37162 8.74781 5.08719C5.7759 7.25747 5.12529 11.4308 7.29558 14.4028C9.46586 17.3747 13.6392 18.0253 16.6111 15.855Z" />
              </svg>
            </button>

            <Link
              href="/auth/login"
              className="hidden rounded-lg border border-[#2F73F2] bg-transparent px-4 py-2 text-[#2F73F2] hover:bg-blue-600 hover:text-white lg:block"
            >
              Giriş Yap
            </Link>
            <Link
              href="/auth/sign-up"
              className="hidden rounded-lg bg-[#2F73F2] px-4 py-2 text-white hover:bg-blue-700 lg:block"
            >
              Kayıt Ol
            </Link>

            <button
              onClick={() => setNavbarOpen((isOpen) => !isOpen)}
              className="block rounded-lg p-2 lg:hidden"
              aria-label="Mobil menüyü aç/kapat"
              type="button"
            >
              <span className="block h-0.5 w-6 bg-black dark:bg-white" />
              <span className="mt-1.5 block h-0.5 w-6 bg-black dark:bg-white" />
              <span className="mt-1.5 block h-0.5 w-6 bg-black dark:bg-white" />
            </button>
          </div>
        </div>

        {navbarOpen ? <div className="fixed left-0 top-0 z-40 size-full bg-black/50" /> : null}
        <div
          ref={mobileMenuRef}
          className={`fixed right-0 top-0 z-50 h-full w-full max-w-xs bg-white shadow-lg transition-transform duration-300 dark:bg-[#0c121e] lg:hidden ${
            navbarOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4">
            <h2 className="text-lg font-bold text-[#102D47] dark:text-white">Menü</h2>
            <button onClick={() => setNavbarOpen(false)} aria-label="Mobil menüyü kapat" type="button">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="dark:text-white">
                <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <nav className="flex flex-col items-start p-4">
            {headerData.map((item) => (
              <MobileHeaderLink key={item.href} item={item} onNavigate={() => setNavbarOpen(false)} />
            ))}
            <div className="mt-4 flex w-full flex-col gap-4">
              <Link
                href="/auth/login"
                className="rounded-lg border border-[#2F73F2] bg-transparent px-4 py-2 text-center text-[#2F73F2] hover:bg-blue-600 hover:text-white"
                onClick={() => setNavbarOpen(false)}
              >
                Giriş Yap
              </Link>
              <Link
                href="/auth/sign-up"
                className="rounded-lg bg-[#2F73F2] px-4 py-2 text-center text-white hover:bg-blue-700"
                onClick={() => setNavbarOpen(false)}
              >
                Kayıt Ol
              </Link>
            </div>
          </nav>
        </div>
      </header>
    </>
  );
}

function Logo() {
  return (
    <Link href="/">
      <Image
        src="/property-nextjs-pro/images/logo/logo.svg"
        alt="logo"
        width={160}
        height={50}
        className="dark:hidden"
        unoptimized
      />
      <Image
        src="/property-nextjs-pro/images/logo/logo-white.svg"
        alt="logo"
        width={160}
        height={50}
        className="hidden dark:block"
        unoptimized
      />
    </Link>
  );
}

function HeaderLink({ item }: { item: HeaderItem }) {
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const path = usePathname();
  const isActive = path === item.href || path.startsWith(`/${item.label.toLowerCase()}`);

  return (
    <div
      className={item.submenu ? "relative" : ""}
      onMouseEnter={() => item.submenu && setSubmenuOpen(true)}
      onMouseLeave={() => setSubmenuOpen(false)}
    >
      <Link
        href={item.href}
        className={`flex py-3 text-base font-normal hover:text-[#2F73F2] dark:text-white dark:hover:text-[#2F73F2] ${
          isActive ? "text-[#2F73F2]" : "text-[#102D47]"
        }`}
      >
        {item.label}
        {item.submenu ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="1.5em" height="1.5em" viewBox="0 0 24 24">
            <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m7 10l5 5l5-5" />
          </svg>
        ) : null}
      </Link>
      {submenuOpen && item.submenu ? (
        <div className="absolute left-0 top-9 mt-0.5 w-60 rounded-lg bg-white py-2 shadow-lg dark:bg-[#0c121e]" data-aos="fade-up" data-aos-duration="300">
          {item.submenu.map((subItem) => (
            <Link
              key={subItem.href}
              href={subItem.href}
              className={`block px-4 py-2 ${
                path === subItem.href ? "bg-[#2F73F2] text-white hover:bg-blue-700" : "text-[#102D47] hover:bg-[#F8FAFC] dark:text-white dark:hover:bg-[#0e1624]"
              }`}
            >
              {subItem.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MobileHeaderLink({
  item,
  onNavigate,
}: {
  item: HeaderItem;
  onNavigate: () => void;
}) {
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const router = useRouter();
  const path = usePathname();
  const isActive = path === item.href || path.startsWith(`/${item.label.toLowerCase()}`);

  function handleNav() {
    if (item.submenu) {
      setSubmenuOpen(!submenuOpen);
      return;
    }
    onNavigate();
    router.push(item.href);
  }

  return (
    <div className="relative w-full">
      <button
        onClick={handleNav}
        className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-black focus:outline-none dark:text-white/60 ${
          isActive ? "bg-[#2F73F2] text-white dark:bg-[#2F73F2] dark:text-white" : ""
        }`}
        type="button"
      >
        {item.label}
        {item.submenu ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="1.5em" height="1.5em" viewBox="0 0 24 24">
            <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m7 10l5 5l5-5" />
          </svg>
        ) : null}
      </button>
      {submenuOpen && item.submenu ? (
        <div className="w-full bg-white px-3 py-2 dark:bg-[#0c121e]">
          {item.submenu.map((subItem) => (
            <Link
              key={subItem.href}
              href={subItem.href}
              onClick={onNavigate}
              className={`block px-3 py-2 ${subItem.href === path ? "text-[#2F73F2]" : "text-[#668199]"}`}
            >
              {subItem.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
